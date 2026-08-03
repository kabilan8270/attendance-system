import { Request, Response } from 'express';
import { query } from '../config/db';

export const getMyNotifications = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { unreadOnly } = req.query as Record<string, string>;
  const conditions = ['user_id = $1', 'user_type = $2'];
  const params: unknown[] = [req.user.id, req.user.userType];
  if (unreadOnly === 'true') conditions.push('is_read = FALSE');

  const result = await query(
    `SELECT * FROM notifications WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,
    params
  );

  return res.json({ success: true, data: result.rows });
};

export const markNotificationRead = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const { id } = req.params;

  const result = await query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 AND user_type = $3 RETURNING *`,
    [id, req.user.id, req.user.userType]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Notification not found' });

  return res.json({ success: true, data: result.rows[0] });
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  await query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND user_type = $2 AND is_read = FALSE`,
    [req.user.id, req.user.userType]
  );

  return res.json({ success: true, message: 'All notifications marked as read' });
};
