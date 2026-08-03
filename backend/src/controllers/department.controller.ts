import { Request, Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../services/audit.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

export const listDepartments = async (_req: Request, res: Response) => {
  const result = await query(
    `SELECT d.*, COUNT(e.id)::int AS employee_count
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id
     GROUP BY d.id
     ORDER BY d.name ASC`
  );
  return res.json({ success: true, data: result.rows });
};

export const createDepartment = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name is required' });

  const result = await query(
    `INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *`,
    [name, description || null]
  );
  await logAudit(req.user.id, 'admin', 'CREATE_DEPARTMENT', 'departments', result.rows[0].id, { name }, getIp(req));
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateDepartment = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const { name, description } = req.body;

  const result = await query(
    `UPDATE departments SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *`,
    [name || null, description || null, id]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Department not found' });

  await logAudit(req.user.id, 'admin', 'UPDATE_DEPARTMENT', 'departments', id, req.body, getIp(req));
  return res.json({ success: true, data: result.rows[0] });
};

export const deleteDepartment = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const result = await query(`DELETE FROM departments WHERE id = $1 RETURNING id`, [id]);
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Department not found' });

  await logAudit(req.user.id, 'admin', 'DELETE_DEPARTMENT', 'departments', id, {}, getIp(req));
  return res.json({ success: true, message: 'Department deleted' });
};
