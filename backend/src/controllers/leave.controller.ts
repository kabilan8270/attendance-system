import { Request, Response } from 'express';
import { query, getClient } from '../config/db';
import { logAudit } from '../services/audit.service';
import { createNotification } from '../services/notification.service';
import { LeaveType } from '../utils/types';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

const countLeaveDays = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

const getOrCreateBalance = async (employeeId: string, year: number) => {
  const existing = await query(`SELECT * FROM leave_balances WHERE employee_id = $1 AND year = $2`, [
    employeeId,
    year,
  ]);
  if (existing.rowCount && existing.rowCount > 0) return existing.rows[0];

  const created = await query(
    `INSERT INTO leave_balances (employee_id, year) VALUES ($1, $2) RETURNING *`,
    [employeeId, year]
  );
  return created.rows[0];
};

// ============================================================
// EMPLOYEE: SUBMIT LEAVE REQUEST
// ============================================================
export const createLeaveRequest = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'employee') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { leaveType, startDate, endDate, reason } = req.body as {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason?: string;
  };

  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'leaveType, startDate and endDate are required' });
  }
  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ success: false, message: 'endDate cannot be before startDate' });
  }
  if (!['casual', 'medical', 'paid', 'unpaid', 'emergency'].includes(leaveType)) {
    return res.status(400).json({ success: false, message: 'Invalid leaveType' });
  }

  // Guard against overlapping pending/approved requests
  const overlap = await query(
    `SELECT id FROM leave_requests
     WHERE employee_id = $1 AND status IN ('pending','approved')
       AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')`,
    [req.user.id, startDate, endDate]
  );
  if (overlap.rowCount && overlap.rowCount > 0) {
    return res.status(409).json({ success: false, message: 'You already have a leave request overlapping these dates' });
  }

  const result = await query(
    `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.id, leaveType, startDate, endDate, reason || null]
  );

  await logAudit(req.user.id, 'employee', 'CREATE_LEAVE_REQUEST', 'leave_requests', result.rows[0].id, { leaveType }, getIp(req));

  return res.status(201).json({ success: true, data: result.rows[0] });
};

// ============================================================
// EMPLOYEE: CANCEL OWN LEAVE REQUEST (only if still pending)
// ============================================================
export const cancelLeaveRequest = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'employee') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;

  const result = await query(
    `UPDATE leave_requests SET status = 'cancelled'
     WHERE id = $1 AND employee_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, req.user.id]
  );
  if (result.rowCount === 0) {
    return res.status(400).json({ success: false, message: 'Only your own pending requests can be cancelled' });
  }

  await logAudit(req.user.id, 'employee', 'CANCEL_LEAVE_REQUEST', 'leave_requests', id, {}, getIp(req));
  return res.json({ success: true, data: result.rows[0] });
};

// ============================================================
// EMPLOYEE: MY LEAVE REQUESTS + BALANCE
// ============================================================
export const getMyLeaves = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'employee') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const year = new Date().getFullYear();
  const [requests, balance] = await Promise.all([
    query(`SELECT * FROM leave_requests WHERE employee_id = $1 ORDER BY created_at DESC`, [req.user.id]),
    getOrCreateBalance(req.user.id, year),
  ]);

  return res.json({ success: true, data: { requests: requests.rows, balance } });
};

// ============================================================
// ADMIN: LIST ALL LEAVE REQUESTS (filter by status/employee/department)
// ============================================================
export const listLeaveRequestsAdmin = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const { status, employeeName, departmentId, page = '1', limit = '50' } = req.query as Record<string, string>;
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    conditions.push(`lr.status = $${idx}`);
    params.push(status);
    idx += 1;
  }
  if (employeeName) {
    conditions.push(`e.full_name ILIKE $${idx}`);
    params.push(`%${employeeName}%`);
    idx += 1;
  }
  if (departmentId) {
    conditions.push(`e.department_id = $${idx}`);
    params.push(departmentId);
    idx += 1;
  }

  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
  const offset = (parseInt(page, 10) - 1) * limitNum;

  const result = await query(
    `SELECT lr.*, e.full_name, e.employee_id AS employee_code, d.name AS department_name
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY lr.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limitNum, offset]
  );

  return res.json({ success: true, data: result.rows });
};

// ============================================================
// ADMIN: APPROVE LEAVE REQUEST
// Marks the date range as 'leave' in attendance and deducts balance.
// ============================================================
export const approveLeaveRequest = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const { reviewNote } = req.body;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const leaveResult = await client.query(
      `SELECT * FROM leave_requests WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [id]
    );
    if (leaveResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Leave request not found or already reviewed' });
    }

    const leave = leaveResult.rows[0];

    await client.query(
      `UPDATE leave_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
       WHERE id = $3`,
      [req.user.id, reviewNote || null, id]
    );

    // Mark each day in the range as 'leave' in attendance
    await client.query(
      `INSERT INTO attendance (employee_id, attendance_date, status)
       SELECT $1, d::date, 'leave'
       FROM generate_series($2::date, $3::date, '1 day') AS d
       ON CONFLICT (employee_id, attendance_date) DO UPDATE SET status = 'leave'`,
      [leave.employee_id, leave.start_date, leave.end_date]
    );

    // Deduct from balance (skip for unpaid/emergency which don't draw from standard buckets)
    if (['casual', 'medical', 'paid'].includes(leave.leave_type)) {
      const days = countLeaveDays(leave.start_date, leave.end_date);
      const year = new Date(leave.start_date).getFullYear();
      await getOrCreateBalance(leave.employee_id, year); // ensure row exists
      await client.query(
        `UPDATE leave_balances SET ${leave.leave_type}_used = ${leave.leave_type}_used + $1
         WHERE employee_id = $2 AND year = $3`,
        [days, leave.employee_id, year]
      );
    }

    await client.query('COMMIT');

    await createNotification(
      leave.employee_id,
      'employee',
      'Leave Approved',
      `Your ${leave.leave_type} leave request from ${leave.start_date} to ${leave.end_date} has been approved.`,
      'leave_approved'
    );
    await logAudit(req.user.id, 'admin', 'APPROVE_LEAVE', 'leave_requests', id, {}, getIp(req));

    return res.json({ success: true, message: 'Leave approved' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================
// ADMIN: REJECT LEAVE REQUEST
// ============================================================
export const rejectLeaveRequest = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const { reviewNote } = req.body;

  const result = await query(
    `UPDATE leave_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
     WHERE id = $3 AND status = 'pending' RETURNING *`,
    [req.user.id, reviewNote || null, id]
  );
  if (result.rowCount === 0) {
    return res.status(400).json({ success: false, message: 'Leave request not found or already reviewed' });
  }

  await createNotification(
    result.rows[0].employee_id,
    'employee',
    'Leave Rejected',
    `Your ${result.rows[0].leave_type} leave request from ${result.rows[0].start_date} to ${result.rows[0].end_date} has been rejected.${reviewNote ? ` Reason: ${reviewNote}` : ''}`,
    'leave_rejected'
  );
  await logAudit(req.user.id, 'admin', 'REJECT_LEAVE', 'leave_requests', id, {}, getIp(req));

  return res.json({ success: true, data: result.rows[0] });
};

// ============================================================
// ADMIN: CANCEL ANY LEAVE REQUEST
// ============================================================
export const adminCancelLeaveRequest = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;

  const result = await query(
    `UPDATE leave_requests SET status = 'cancelled' WHERE id = $1 RETURNING *`,
    [id]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Leave request not found' });

  await logAudit(req.user.id, 'admin', 'ADMIN_CANCEL_LEAVE', 'leave_requests', id, {}, getIp(req));
  return res.json({ success: true, data: result.rows[0] });
};

// ============================================================
// ADMIN: ADD LEAVE ON BEHALF OF EMPLOYEE (auto-approved)
// ============================================================
export const adminAddLeave = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { employeeId, leaveType, startDate, endDate, reason } = req.body;
  if (!employeeId || !leaveType || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'employeeId, leaveType, startDate, endDate are required' });
  }

  const result = await query(
    `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, reviewed_by, reviewed_at)
     VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW()) RETURNING *`,
    [employeeId, leaveType, startDate, endDate, reason || 'Added by admin', req.user.id]
  );

  await query(
    `INSERT INTO attendance (employee_id, attendance_date, status)
     SELECT $1, d::date, 'leave'
     FROM generate_series($2::date, $3::date, '1 day') AS d
     ON CONFLICT (employee_id, attendance_date) DO UPDATE SET status = 'leave'`,
    [employeeId, startDate, endDate]
  );

  await createNotification(
    employeeId,
    'employee',
    'Leave Added',
    `Admin has added a ${leaveType} leave for you from ${startDate} to ${endDate}.`,
    'leave_added'
  );
  await logAudit(req.user.id, 'admin', 'ADMIN_ADD_LEAVE', 'leave_requests', result.rows[0].id, {}, getIp(req));

  return res.status(201).json({ success: true, data: result.rows[0] });
};
