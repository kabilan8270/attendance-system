import { Request, Response } from 'express';
import { query } from '../config/db';
import { verifyWithinOfficeGeofence } from '../services/geo.service';
import { verifyEmployeeFace } from '../services/face.service';
import { logAudit } from '../services/audit.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

const getLateThresholdMinutes = async (): Promise<number> => {
  const result = await query(`SELECT value FROM settings WHERE key = 'late_threshold_minutes'`);
  return result.rowCount ? Number(result.rows[0].value) : 15;
};

/**
 * Determines whether a check-in counts as "late" based on the employee's
 * assigned shift start time + grace period.
 */
const isLateCheckIn = async (
  employeeId: string,
  checkInTime: Date
): Promise<boolean> => {
  const shiftResult = await query(
    `SELECT s.start_time, s.grace_period_minutes
     FROM employees e
     JOIN shifts s ON s.id = e.shift_id
     WHERE e.id = $1`,
    [employeeId]
  );

  if (shiftResult.rowCount === 0) {
    // No shift assigned — fall back to global late-threshold setting against 9:00 AM default
    return false;
  }

  const { start_time, grace_period_minutes } = shiftResult.rows[0];
  const [h, m] = start_time.split(':').map(Number);

  const shiftStart = new Date(checkInTime);
  shiftStart.setHours(h, m, 0, 0);
  shiftStart.setMinutes(shiftStart.getMinutes() + grace_period_minutes);

  return checkInTime > shiftStart;
};

// ============================================================
// CHECK IN
// ============================================================
export const checkIn = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'employee') {
    return res.status(403).json({ success: false, message: 'Only employees can mark attendance' });
  }

  const { latitude, longitude, faceDescriptor, livenessScore, livenessPassed } = req.body;

  if (
    latitude === undefined ||
    longitude === undefined ||
    !Array.isArray(faceDescriptor) ||
    livenessScore === undefined ||
    livenessPassed === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: 'latitude, longitude, faceDescriptor, livenessScore and livenessPassed are all required',
    });
  }

  const employeeId = req.user.id;
  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];

  // ---- Step 1: GPS geofence check (must pass BEFORE face check per business rules) ----
  const geoResult = await verifyWithinOfficeGeofence(latitude, longitude);
  if (!geoResult.allowed) {
    await logAudit(employeeId, 'employee', 'CHECK_IN_BLOCKED_GEOFENCE', 'attendance', null, geoResult as unknown as Record<string, unknown>, getIp(req));
    return res.status(403).json({ success: false, message: geoResult.reason, code: 'GEOFENCE_FAILED' });
  }

  // ---- Step 2: Face verification with liveness ----
  const faceResult = await verifyEmployeeFace({
    employeeId,
    submittedDescriptor: faceDescriptor,
    livenessScore,
    livenessPassed,
  });

  if (!faceResult.success) {
    await logAudit(
      employeeId,
      'employee',
      'CHECK_IN_BLOCKED_FACE',
      'attendance',
      null,
      { reason: faceResult.reason, matchScore: faceResult.matchScore },
      getIp(req)
    );
    // CRITICAL: attendance must NOT be saved if face verification fails.
    return res.status(403).json({ success: false, message: faceResult.reason, code: 'FACE_VERIFICATION_FAILED' });
  }

  // ---- Step 3: check for existing attendance row today / already checked in ----
  const existing = await query(
    `SELECT id, check_in_time FROM attendance WHERE employee_id = $1 AND attendance_date = $2`,
    [employeeId, todayDateStr]
  );

  if (existing.rowCount && existing.rows[0].check_in_time) {
    return res.status(409).json({ success: false, message: 'You have already checked in today' });
  }

  // ---- Step 4: determine late status ----
  const late = await isLateCheckIn(employeeId, today);
  const status = late ? 'late' : 'present';

  let attendanceRow;
  if (existing.rowCount) {
    const update = await query(
      `UPDATE attendance
       SET check_in_time = $1, check_in_lat = $2, check_in_lng = $3,
           check_in_face_match_score = $4, status = $5
       WHERE id = $6
       RETURNING *`,
      [today, latitude, longitude, faceResult.matchScore, status, existing.rows[0].id]
    );
    attendanceRow = update.rows[0];
  } else {
    const insert = await query(
      `INSERT INTO attendance
        (employee_id, attendance_date, check_in_time, check_in_lat, check_in_lng, check_in_face_match_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [employeeId, todayDateStr, today, latitude, longitude, faceResult.matchScore, status]
    );
    attendanceRow = insert.rows[0];
  }

  await logAudit(employeeId, 'employee', 'CHECK_IN_SUCCESS', 'attendance', attendanceRow.id, {
    matchScore: faceResult.matchScore,
    status,
  }, getIp(req));

  return res.json({
    success: true,
    message: late
      ? 'Checked in successfully (marked as late)'
      : 'Checked in successfully',
    data: attendanceRow,
  });
};

// ============================================================
// CHECK OUT
// ============================================================
export const checkOut = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'employee') {
    return res.status(403).json({ success: false, message: 'Only employees can mark attendance' });
  }

  const { latitude, longitude, faceDescriptor, livenessScore, livenessPassed } = req.body;

  if (
    latitude === undefined ||
    longitude === undefined ||
    !Array.isArray(faceDescriptor) ||
    livenessScore === undefined ||
    livenessPassed === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: 'latitude, longitude, faceDescriptor, livenessScore and livenessPassed are all required',
    });
  }

  const employeeId = req.user.id;
  const todayDateStr = new Date().toISOString().split('T')[0];

  const geoResult = await verifyWithinOfficeGeofence(latitude, longitude);
  if (!geoResult.allowed) {
    return res.status(403).json({ success: false, message: geoResult.reason, code: 'GEOFENCE_FAILED' });
  }

  const faceResult = await verifyEmployeeFace({
    employeeId,
    submittedDescriptor: faceDescriptor,
    livenessScore,
    livenessPassed,
  });

  if (!faceResult.success) {
    return res.status(403).json({ success: false, message: faceResult.reason, code: 'FACE_VERIFICATION_FAILED' });
  }

  const existing = await query(
    `SELECT id, check_in_time, check_out_time FROM attendance WHERE employee_id = $1 AND attendance_date = $2`,
    [employeeId, todayDateStr]
  );

  if (existing.rowCount === 0 || !existing.rows[0].check_in_time) {
    return res.status(400).json({ success: false, message: 'You must check in before checking out' });
  }
  if (existing.rows[0].check_out_time) {
    return res.status(409).json({ success: false, message: 'You have already checked out today' });
  }

  const checkOutTime = new Date();
  const checkInTime = new Date(existing.rows[0].check_in_time);
  const workingHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

  const halfDaySetting = await query(`SELECT value FROM settings WHERE key = 'half_day_hours'`);
  const halfDayThreshold = halfDaySetting.rowCount ? Number(halfDaySetting.rows[0].value) : 4;

  const finalStatusUpdate = workingHours < halfDayThreshold ? 'half_day' : null;

  const update = await query(
    `UPDATE attendance
     SET check_out_time = $1, check_out_lat = $2, check_out_lng = $3,
         check_out_face_match_score = $4, working_hours = $5,
         status = COALESCE($6, status)
     WHERE id = $7
     RETURNING *`,
    [
      checkOutTime,
      latitude,
      longitude,
      faceResult.matchScore,
      workingHours.toFixed(2),
      finalStatusUpdate,
      existing.rows[0].id,
    ]
  );

  await logAudit(employeeId, 'employee', 'CHECK_OUT_SUCCESS', 'attendance', existing.rows[0].id, {
    workingHours: workingHours.toFixed(2),
  }, getIp(req));

  return res.json({ success: true, message: 'Checked out successfully', data: update.rows[0] });
};

// ============================================================
// EMPLOYEE: MY ATTENDANCE HISTORY
// ============================================================
export const getMyAttendance = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'employee') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { from, to, month, year } = req.query;
  const conditions: string[] = ['employee_id = $1'];
  const params: unknown[] = [req.user.id];
  let idx = 2;

  if (from && to) {
    conditions.push(`attendance_date BETWEEN $${idx} AND $${idx + 1}`);
    params.push(from, to);
    idx += 2;
  } else if (month && year) {
    conditions.push(`EXTRACT(MONTH FROM attendance_date) = $${idx} AND EXTRACT(YEAR FROM attendance_date) = $${idx + 1}`);
    params.push(month, year);
    idx += 2;
  }

  const result = await query(
    `SELECT * FROM attendance WHERE ${conditions.join(' AND ')} ORDER BY attendance_date DESC`,
    params
  );

  return res.json({ success: true, data: result.rows });
};

// ============================================================
// ADMIN: VIEW ATTENDANCE (with search/filter/pagination)
// ============================================================
export const getAttendanceAdmin = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const {
    date,
    from,
    to,
    month,
    year,
    departmentId,
    employeeName,
    employeeCode,
    status,
    page = '1',
    limit = '50',
  } = req.query as Record<string, string>;

  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let idx = 1;

  if (date) {
    conditions.push(`a.attendance_date = $${idx}`);
    params.push(date);
    idx += 1;
  }
  if (from && to) {
    conditions.push(`a.attendance_date BETWEEN $${idx} AND $${idx + 1}`);
    params.push(from, to);
    idx += 2;
  }
  if (month && year) {
    conditions.push(`EXTRACT(MONTH FROM a.attendance_date) = $${idx} AND EXTRACT(YEAR FROM a.attendance_date) = $${idx + 1}`);
    params.push(month, year);
    idx += 2;
  }
  if (departmentId) {
    conditions.push(`e.department_id = $${idx}`);
    params.push(departmentId);
    idx += 1;
  }
  if (employeeName) {
    conditions.push(`e.full_name ILIKE $${idx}`);
    params.push(`%${employeeName}%`);
    idx += 1;
  }
  if (employeeCode) {
    conditions.push(`e.employee_id ILIKE $${idx}`);
    params.push(`%${employeeCode}%`);
    idx += 1;
  }
  if (status) {
    conditions.push(`a.status = $${idx}`);
    params.push(status);
    idx += 1;
  }

  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
  const offset = (parseInt(page, 10) - 1) * limitNum;

  const result = await query(
    `SELECT a.*, e.full_name, e.employee_id AS employee_code, d.name AS department_name
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.attendance_date DESC, e.full_name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limitNum, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE ${conditions.join(' AND ')}`,
    params
  );

  return res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: parseInt(page, 10),
      limit: limitNum,
      total: parseInt(countResult.rows[0].count, 10),
    },
  });
};

// ============================================================
// ADMIN: MANUALLY MARK / OVERRIDE ATTENDANCE (e.g. WFH, holiday override)
// ============================================================
export const adminUpsertAttendance = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { employeeId, attendanceDate, status, notes } = req.body;
  if (!employeeId || !attendanceDate || !status) {
    return res.status(400).json({ success: false, message: 'employeeId, attendanceDate and status are required' });
  }

  const result = await query(
    `INSERT INTO attendance (employee_id, attendance_date, status, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (employee_id, attendance_date)
     DO UPDATE SET status = $3, notes = $4
     RETURNING *`,
    [employeeId, attendanceDate, status, notes || null]
  );

  await logAudit(req.user.id, 'admin', 'ADMIN_ATTENDANCE_OVERRIDE', 'attendance', result.rows[0].id, {
    status,
  }, getIp(req));

  return res.json({ success: true, data: result.rows[0] });
};
