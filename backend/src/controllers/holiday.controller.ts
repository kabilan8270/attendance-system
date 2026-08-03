import { Request, Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../services/audit.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

// Visible to both admin and employee (employees see holidays in their calendar)
export const listHolidays = async (req: Request, res: Response) => {
  const { year } = req.query as Record<string, string>;
  const params: unknown[] = [];
  let where = '';
  if (year) {
    where = `WHERE EXTRACT(YEAR FROM holiday_date) = $1`;
    params.push(year);
  }
  const result = await query(`SELECT * FROM holidays ${where} ORDER BY holiday_date ASC`, params);
  return res.json({ success: true, data: result.rows });
};

export const createHoliday = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { name, holidayDate, description } = req.body;
  if (!name || !holidayDate) {
    return res.status(400).json({ success: false, message: 'name and holidayDate are required' });
  }

  const result = await query(
    `INSERT INTO holidays (name, holiday_date, description) VALUES ($1, $2, $3) RETURNING *`,
    [name, holidayDate, description || null]
  );
  await logAudit(req.user.id, 'admin', 'CREATE_HOLIDAY', 'holidays', result.rows[0].id, { name, holidayDate }, getIp(req));
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateHoliday = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const { name, holidayDate, description } = req.body;

  const result = await query(
    `UPDATE holidays SET
       name = COALESCE($1, name),
       holiday_date = COALESCE($2, holiday_date),
       description = COALESCE($3, description)
     WHERE id = $4 RETURNING *`,
    [name || null, holidayDate || null, description || null, id]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Holiday not found' });

  await logAudit(req.user.id, 'admin', 'UPDATE_HOLIDAY', 'holidays', id, req.body, getIp(req));
  return res.json({ success: true, data: result.rows[0] });
};

export const deleteHoliday = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const result = await query(`DELETE FROM holidays WHERE id = $1 RETURNING id`, [id]);
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Holiday not found' });

  await logAudit(req.user.id, 'admin', 'DELETE_HOLIDAY', 'holidays', id, {}, getIp(req));
  return res.json({ success: true, message: 'Holiday deleted' });
};
