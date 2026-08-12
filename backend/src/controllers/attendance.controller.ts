import { Request, Response } from 'express';
import { query } from '../config/db';
import { verifyWithinOfficeGeofence } from '../services/geo.service';
import { verifyEmployeeFace, findActiveEmployeeByFace } from '../services/face.service';
import { logAudit } from '../services/audit.service';
import {
  processAttendancePunch,
  attendanceColumnsSql,
  getIndiaDate,
} from '../services/attendance.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

// ============================================================
// EMPLOYEE: MARK ATTENDANCE (single punch action — no IN/OUT toggle)
// ============================================================
// The frontend sends exactly one "Mark Attendance" request. The backend
// (via processAttendancePunch) is the sole authority on whether this punch
// is an IN or an OUT — it is never derived from frontend state, button
// selection, or localStorage.
export const markAttendance = async (req: Request, res: Response) => {
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
  const punchTime = new Date();

  // ---- Step 1: GPS geofence check (must pass BEFORE face check per business rules) ----
  const geoResult = await verifyWithinOfficeGeofence(latitude, longitude);
  if (!geoResult.allowed) {
    await logAudit(
      employeeId,
      'employee',
      'ATTENDANCE_BLOCKED_GEOFENCE',
      'attendance',
      null,
      geoResult as unknown as Record<string, unknown>,
      getIp(req)
    );
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
      'ATTENDANCE_BLOCKED_FACE',
      'attendance',
      null,
      { reason: faceResult.reason, matchScore: faceResult.matchScore },
      getIp(req)
    );
    // CRITICAL: attendance must NOT be saved if face verification fails.
    return res.status(403).json({ success: false, message: faceResult.reason, code: 'FACE_VERIFICATION_FAILED' });
  }

  // ---- Step 3: backend decides IN vs OUT and applies the 16-hour / present-late rules ----
  const { action, record } = await processAttendancePunch(employeeId, punchTime, {
    latitude: Number(latitude),
    longitude: Number(longitude),
    faceMatchScore: faceResult.matchScore ?? null,
  });

  await logAudit(
    employeeId,
    'employee',
    action === 'IN' ? 'ATTENDANCE_IN_SUCCESS' : 'ATTENDANCE_OUT_SUCCESS',
    'attendance',
    record.id,
    { matchScore: faceResult.matchScore, status: record.status, workingHours: record.working_hours },
    getIp(req)
  );

  return res.json({
    success: true,
    action,
    message:
      action === 'IN'
        ? 'Checked in successfully'
        : `Checked out successfully (${record.status === 'late' ? 'marked as late' : 'marked as present'})`,
    data: record,
  });
};

// ============================================================
// PUBLIC FACE KIOSK: LOGIN-FREE ATTENDANCE
// ============================================================
// Uses exactly the same attendance decision engine as the authenticated
// employee flow (requirement #11) — no separate/duplicated IN-OUT logic.
export const publicFaceAttendance = async (req: Request, res: Response) => {
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
      message: 'latitude, longitude, faceDescriptor, livenessScore and livenessPassed are required',
    });
  }

  const geoResult = await verifyWithinOfficeGeofence(Number(latitude), Number(longitude));
  if (!geoResult.allowed) {
    return res.status(403).json({ success: false, message: geoResult.reason, code: 'GEOFENCE_FAILED' });
  }

  const faceResult = await findActiveEmployeeByFace(
    faceDescriptor,
    Number(livenessScore),
    Boolean(livenessPassed)
  );

  if (!faceResult.success || !faceResult.employee) {
    return res.status(403).json({
      success: false,
      message: faceResult.reason || 'Face not recognized',
      code: 'FACE_NOT_RECOGNIZED',
    });
  }

  const employee = faceResult.employee;
  const punchTime = new Date();

  const { action, record } = await processAttendancePunch(employee.id, punchTime, {
    latitude: Number(latitude),
    longitude: Number(longitude),
    faceMatchScore: faceResult.matchScore ?? null,
  });

  await logAudit(
    employee.id,
    'employee',
    action === 'IN' ? 'PUBLIC_FACE_ATTENDANCE_IN_SUCCESS' : 'PUBLIC_FACE_ATTENDANCE_OUT_SUCCESS',
    'attendance',
    record.id,
    { matchScore: faceResult.matchScore, status: record.status, workingHours: record.working_hours },
    getIp(req)
  );

  return res.json({
    success: true,
    action,
    message:
      action === 'IN'
        ? `Welcome ${employee.full_name}. Check-in recorded.`
        : `Goodbye ${employee.full_name}. Check-out recorded.`,
    employee: {
      id: employee.id,
      employeeId: employee.employee_id,
      fullName: employee.full_name,
    },
    data: record,
  });
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
    `SELECT ${attendanceColumnsSql()} FROM attendance WHERE ${conditions.join(' AND ')} ORDER BY attendance_date DESC, check_in_time DESC`,
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
    `SELECT ${attendanceColumnsSql('a')}, e.full_name, e.employee_id AS employee_code, d.name AS department_name
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
     RETURNING ${attendanceColumnsSql()}`,
    [employeeId, attendanceDate, status, notes || null]
  );

  await logAudit(req.user.id, 'admin', 'ADMIN_ATTENDANCE_OVERRIDE', 'attendance', result.rows[0].id, {
    status,
  }, getIp(req));

  return res.json({ success: true, data: result.rows[0] });
};

// Re-exported so any other module (e.g. reports) that needs "today, India time" uses the same definition.
export { getIndiaDate };
