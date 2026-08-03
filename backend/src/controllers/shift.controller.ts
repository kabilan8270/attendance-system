import { Request, Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../services/audit.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

export const listShifts = async (_req: Request, res: Response) => {
  const result = await query(`SELECT * FROM shifts ORDER BY start_time ASC`);
  return res.json({ success: true, data: result.rows });
};

export const createShift = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { name, startTime, endTime, gracePeriodMinutes, isOvernight } = req.body;
  if (!name || !startTime || !endTime) {
    return res.status(400).json({ success: false, message: 'name, startTime and endTime are required' });
  }

  const result = await query(
    `INSERT INTO shifts (name, start_time, end_time, grace_period_minutes, is_overnight)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, startTime, endTime, gracePeriodMinutes ?? 15, isOvernight ?? false]
  );
  await logAudit(req.user.id, 'admin', 'CREATE_SHIFT', 'shifts', result.rows[0].id, { name }, getIp(req));
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateShift = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const { name, startTime, endTime, gracePeriodMinutes, isOvernight } = req.body;

  const result = await query(
    `UPDATE shifts SET
       name = COALESCE($1, name),
       start_time = COALESCE($2, start_time),
       end_time = COALESCE($3, end_time),
       grace_period_minutes = COALESCE($4, grace_period_minutes),
       is_overnight = COALESCE($5, is_overnight)
     WHERE id = $6 RETURNING *`,
    [name || null, startTime || null, endTime || null, gracePeriodMinutes ?? null, isOvernight ?? null, id]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Shift not found' });

  await logAudit(req.user.id, 'admin', 'UPDATE_SHIFT', 'shifts', id, req.body, getIp(req));
  return res.json({ success: true, data: result.rows[0] });
};

export const deleteShift = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const result = await query(`DELETE FROM shifts WHERE id = $1 RETURNING id`, [id]);
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Shift not found' });

  await logAudit(req.user.id, 'admin', 'DELETE_SHIFT', 'shifts', id, {}, getIp(req));
  return res.json({ success: true, message: 'Shift deleted' });
};

export const assignShift = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { employeeId, shiftId } = req.body;
  if (!employeeId || !shiftId) {
    return res.status(400).json({ success: false, message: 'employeeId and shiftId are required' });
  }

  const result = await query(
    `UPDATE employees SET shift_id = $1 WHERE id = $2 RETURNING id, employee_id, shift_id`,
    [shiftId, employeeId]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Employee not found' });

  await logAudit(req.user.id, 'admin', 'ASSIGN_SHIFT', 'employees', employeeId, { shiftId }, getIp(req));
  return res.json({ success: true, data: result.rows[0] });
};
