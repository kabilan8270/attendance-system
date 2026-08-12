import { Pool, PoolClient, QueryResult } from 'pg';
import { getClient } from '../config/db';
import { AppError } from '../middleware/error.middleware';

// ============================================================
// CONSTANTS
// ============================================================

export const INDIA_TZ = 'Asia/Kolkata';

/**
 * Maximum number of hours an attendance record can stay "open" from its
 * first IN punch. Any punch arriving after this window belongs to a NEW
 * attendance record instead of closing out the old one (requirement #4).
 */
export const MAX_ATTENDANCE_WINDOW_HOURS = 16;

/**
 * Fallback duty hours used only if an employee has no shift assigned yet.
 * Every real shift must define its own duty_hours (requirement #7) — this
 * constant exists purely so the app never crashes for an unassigned
 * employee, and is intentionally NOT used anywhere in the 16-hour or
 * present/late decision once a shift is assigned.
 */
export const DEFAULT_DUTY_HOURS = 8;

// Explicit column list (never `SELECT/RETURNING *`) so attendance_date is
// always handed back to callers as a plain 'YYYY-MM-DD' string rather than
// whatever JS representation node-postgres happens to parse DATE columns
// into. Comparing/consuming that value as a string elsewhere (frontend
// calendar keys, admin tables, exports) must never silently break.
export const attendanceColumnsSql = (alias = ''): string => {
  const p = alias ? `${alias}.` : '';
  return `${p}id, ${p}employee_id, to_char(${p}attendance_date, 'YYYY-MM-DD') AS attendance_date,
          ${p}check_in_time, ${p}check_out_time, ${p}check_in_lat, ${p}check_in_lng,
          ${p}check_out_lat, ${p}check_out_lng, ${p}check_in_face_match_score, ${p}check_out_face_match_score,
          ${p}status, ${p}working_hours, ${p}notes, ${p}created_at, ${p}updated_at`;
};

// ============================================================
// TYPES
// ============================================================

export interface AttendanceRow {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | Date | null;
  check_out_time: string | Date | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_in_face_match_score: number | null;
  check_out_face_match_score: number | null;
  status: string;
  working_hours: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftInfo {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  duty_hours: number;
  grace_period_minutes: number;
  is_overnight: boolean;
}

export interface PunchMeta {
  latitude: number;
  longitude: number;
  faceMatchScore?: number | null;
}

export interface PunchResult {
  action: 'IN' | 'OUT';
  record: AttendanceRow;
}

// ============================================================
// INDIA TIMEZONE HELPERS (Asia/Kolkata, never server/browser local time)
// ============================================================

/** The India-local calendar date (YYYY-MM-DD) for a given instant. */
export const getIndiaDate = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

/** A human-readable India-local date + time string, for logs/audit trails. */
export const getIndiaDateTimeString = (date: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);

// ============================================================
// CORE CALCULATIONS
// ============================================================

/** Working hours between two instants, as a plain (possibly fractional) number of hours. */
export const calculateWorkingHours = (checkIn: Date, checkOut: Date): number =>
  (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

/**
 * Requirement #8 (present/late rule):
 *   actual_working_hours >= shift.duty_hours  -> present
 *   actual_working_hours <  shift.duty_hours  -> late
 * This is intentionally the ONLY thing that decides present vs late.
 * The 16-hour rule (below) is a completely separate concept that decides
 * which attendance ROW a punch belongs to, not the status.
 */
export const determineAttendanceStatus = (
  actualWorkingHours: number,
  dutyHours: number
): 'present' | 'late' => (actualWorkingHours >= dutyHours ? 'present' : 'late');

/** Looks up the duty_hours (and other shift info) assigned to an employee. */
export const getEmployeeShift = async (
  client: PoolClient | Pool,
  employeeId: string
): Promise<ShiftInfo | null> => {
  const result: QueryResult = await client.query(
    `SELECT s.id, s.name, s.start_time, s.end_time, s.duty_hours,
            s.grace_period_minutes, s.is_overnight
     FROM employees e
     JOIN shifts s ON s.id = e.shift_id
     WHERE e.id = $1`,
    [employeeId]
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    start_time: row.start_time,
    end_time: row.end_time,
    duty_hours: Number(row.duty_hours),
    grace_period_minutes: row.grace_period_minutes,
    is_overnight: row.is_overnight,
  };
};

/**
 * The most recent "real" attendance record for an employee (i.e. one that
 * actually has a check_in_time — admin placeholder rows such as a leave/
 * holiday override with no check-in yet don't count).
 *
 * Deliberately NOT filtered by check_out_time IS NULL and NOT scoped by
 * attendance_date. Two reasons:
 *   - An overnight shift's record may belong to "yesterday" and must be
 *     found purely from check_in_time, never by comparing calendar dates
 *     (requirement #5, #9, #18).
 *   - Requirement #6 (multiple punches): every punch inside the 16-hour
 *     window updates the SAME record's check_out_time again, using the
 *     ORIGINAL check_in_time and the LATEST punch. If this lookup excluded
 *     rows that already have a check_out_time, a third punch would no
 *     longer find the record a second punch had already updated, and would
 *     incorrectly be treated as starting a new attendance. Ownership of a
 *     punch is decided purely by elapsed hours since the first IN
 *     (requirement #4), never by whether check_out_time happens to be set.
 *
 * Uses `FOR UPDATE` so it must be called inside a transaction that already
 * holds the per-employee advisory lock acquired in processAttendancePunch.
 */
export const findLatestPunchableAttendance = async (
  client: PoolClient,
  employeeId: string
): Promise<AttendanceRow | null> => {
  const result = await client.query(
    `SELECT ${attendanceColumnsSql()}
     FROM attendance
     WHERE employee_id = $1
       AND check_in_time IS NOT NULL
     ORDER BY check_in_time DESC
     LIMIT 1
     FOR UPDATE`,
    [employeeId]
  );
  return result.rowCount ? (result.rows[0] as AttendanceRow) : null;
};

// ============================================================
// PUNCH HANDLERS (internal — always run inside the same transaction)
// ============================================================

/**
 * The punch attaches to an existing attendance record as its latest OUT
 * (elapsed since that record's first IN is <= 16h). Preserves the original
 * check_in_time / attendance_date untouched; only check_out_time,
 * working_hours and status move — and they move on EVERY such punch, not
 * just the final one, so mid-window punches simply get overwritten by the
 * next one (requirement #6: first punch stays check_in_time, latest valid
 * punch becomes check_out_time).
 */
const attachOutPunch = async (
  client: PoolClient,
  employeeId: string,
  targetAttendance: AttendanceRow,
  punchTime: Date,
  meta: PunchMeta
): Promise<PunchResult> => {
  const firstInTime = new Date(targetAttendance.check_in_time as string);
  const workingHours = calculateWorkingHours(firstInTime, punchTime);

  const shift = await getEmployeeShift(client, employeeId);
  const dutyHours = shift ? shift.duty_hours : DEFAULT_DUTY_HOURS;
  const status = determineAttendanceStatus(workingHours, dutyHours);

  const update = await client.query(
    `UPDATE attendance
     SET check_out_time = $1,
         check_out_lat = $2,
         check_out_lng = $3,
         check_out_face_match_score = $4,
         working_hours = $5,
         status = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING ${attendanceColumnsSql()}`,
    [
      punchTime,
      meta.latitude,
      meta.longitude,
      meta.faceMatchScore ?? null,
      workingHours.toFixed(2),
      status,
      targetAttendance.id,
    ]
  );

  return { action: 'OUT', record: update.rows[0] as AttendanceRow };
};

/**
 * The punch starts a brand-new attendance cycle for the current India
 * calendar date, derived from the actual punch instant (requirement #2, #9).
 * Reached only when there is no attachable record within the 16-hour window
 * (requirement #4).
 *
 * UNIQUE(employee_id, attendance_date) means at most one row can ever exist
 * for this date, so this is an upsert rather than a plain insert, to cover:
 *   - the normal case: no row for today yet -> insert.
 *   - an admin already created a placeholder row for today (e.g. a leave/
 *     holiday override) with no check-in yet -> the employee's real punch
 *     fills it in as today's IN.
 *   - a same-calendar-day 16h+ overrun: the employee's previous attendance
 *     record on this exact date is now stale (per the 16-hour rule above)
 *     but the unique constraint means a second row for the same date isn't
 *     possible — so this punch resets that row into a fresh IN rather than
 *     being blocked outright, which would leave the employee unable to mark
 *     attendance at all.
 * In every case the row ends up with check_in_time = this punch, and no
 * check_out_time yet, exactly as a fresh IN should.
 */
const createNewInPunch = async (
  client: PoolClient,
  employeeId: string,
  punchTime: Date,
  meta: PunchMeta
): Promise<PunchResult> => {
  const indiaDate = getIndiaDate(punchTime);

  const upsert = await client.query(
    `INSERT INTO attendance
      (employee_id, attendance_date, check_in_time, check_in_lat, check_in_lng, check_in_face_match_score, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (employee_id, attendance_date) DO UPDATE
       SET check_in_time = EXCLUDED.check_in_time,
           check_in_lat = EXCLUDED.check_in_lat,
           check_in_lng = EXCLUDED.check_in_lng,
           check_in_face_match_score = EXCLUDED.check_in_face_match_score,
           check_out_time = NULL,
           check_out_lat = NULL,
           check_out_lng = NULL,
           check_out_face_match_score = NULL,
           working_hours = NULL,
           status = EXCLUDED.status,
           updated_at = NOW()
     RETURNING ${attendanceColumnsSql()}`,
    [employeeId, indiaDate, punchTime, meta.latitude, meta.longitude, meta.faceMatchScore ?? null, 'present']
  );

  return { action: 'IN', record: upsert.rows[0] as AttendanceRow };
};

// ============================================================
// PUBLIC ENTRY POINT
// ============================================================

/**
 * The ONE decision engine for every attendance punch, shared by the
 * authenticated employee "Mark Attendance" action and the public face
 * kiosk (requirement #17). The backend — never the frontend — decides
 * whether a punch is an IN or an OUT.
 *
 * Rules applied, in order:
 *   1. If the employee has a most-recent attendance record and this punch
 *      arrives within 16 hours of that record's first IN, the punch
 *      attaches to it as the latest check_out_time (requirement #3, #4, #6)
 *      — even if an earlier punch already set a check_out_time on it, since
 *      multiple punches inside the window keep overwriting the same record.
 *   2. Otherwise (no prior record, or the most recent one is >16h stale)
 *      the punch starts a new attendance record for the current India
 *      calendar date (requirement #2, #4, #9).
 *
 * Everything runs inside a single transaction serialized per-employee via
 * a Postgres advisory lock, so two near-simultaneous punches can never
 * create duplicate rows or race each other into inconsistent state
 * (requirement #12).
 */
export const processAttendancePunch = async (
  employeeId: string,
  punchTime: Date,
  meta: PunchMeta
): Promise<PunchResult> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [employeeId]);

    const latestAttendance = await findLatestPunchableAttendance(client, employeeId);

    let result: PunchResult;

    if (latestAttendance) {
      const firstInTime = new Date(latestAttendance.check_in_time as string);
      const elapsedHours = calculateWorkingHours(firstInTime, punchTime);

      if (elapsedHours >= 0 && elapsedHours <= MAX_ATTENDANCE_WINDOW_HOURS) {
        result = await attachOutPunch(client, employeeId, latestAttendance, punchTime, meta);
        await client.query('COMMIT');
        return result;
      }
      // Stale (>16h old): leave that old record untouched and fall through
      // to start a new IN below (requirement #4).
    }

    result = await createNewInPunch(client, employeeId, punchTime, meta);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
};
