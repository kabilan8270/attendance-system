import { query } from '../config/db';
import { UserType } from '../utils/types';

export const createNotification = async (
  userId: string,
  userType: UserType,
  title: string,
  message: string,
  type = 'general'
): Promise<void> => {
  await query(
    `INSERT INTO notifications (user_id, user_type, title, message, type) VALUES ($1, $2, $3, $4, $5)`,
    [userId, userType, title, message, type]
  );
};

/** Notify every active employee (e.g. new holiday added) */
export const notifyAllEmployees = async (title: string, message: string, type = 'general'): Promise<void> => {
  const employees = await query(`SELECT id FROM employees WHERE status = 'active'`);
  await Promise.all(
    employees.rows.map((e) => createNotification(e.id, 'employee', title, message, type))
  );
};
