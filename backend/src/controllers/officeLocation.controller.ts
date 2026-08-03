import { Request, Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../services/audit.service';

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

export const listOfficeLocations = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const result = await query(`SELECT * FROM office_locations ORDER BY created_at DESC`);
  return res.json({ success: true, data: result.rows });
};

export const createOfficeLocation = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { name, latitude, longitude, radiusMeters } = req.body;
  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'name, latitude and longitude are required' });
  }

  const result = await query(
    `INSERT INTO office_locations (name, latitude, longitude, radius_meters) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, latitude, longitude, radiusMeters ?? 100]
  );
  await logAudit(req.user.id, 'admin', 'CREATE_OFFICE_LOCATION', 'office_locations', result.rows[0].id, { name }, getIp(req));
  return res.status(201).json({ success: true, data: result.rows[0] });
};

export const updateOfficeLocation = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const { name, latitude, longitude, radiusMeters, isActive } = req.body;

  const result = await query(
    `UPDATE office_locations SET
       name = COALESCE($1, name),
       latitude = COALESCE($2, latitude),
       longitude = COALESCE($3, longitude),
       radius_meters = COALESCE($4, radius_meters),
       is_active = COALESCE($5, is_active)
     WHERE id = $6 RETURNING *`,
    [name || null, latitude ?? null, longitude ?? null, radiusMeters ?? null, isActive ?? null, id]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Office location not found' });

  await logAudit(req.user.id, 'admin', 'UPDATE_OFFICE_LOCATION', 'office_locations', id, req.body, getIp(req));
  return res.json({ success: true, data: result.rows[0] });
};

export const deleteOfficeLocation = async (req: Request, res: Response) => {
  if (!req.user || req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const result = await query(`DELETE FROM office_locations WHERE id = $1 RETURNING id`, [id]);
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Office location not found' });

  await logAudit(req.user.id, 'admin', 'DELETE_OFFICE_LOCATION', 'office_locations', id, {}, getIp(req));
  return res.json({ success: true, message: 'Office location deleted' });
};
