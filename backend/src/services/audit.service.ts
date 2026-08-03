import { query } from '../config/db';
import { UserType } from '../utils/types';

export const logAudit = async (
  userId: string | null,
  userType: UserType | null,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown>,
  ipAddress: string
): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_type, action, entity, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, userType, action, entity, entityId, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    // Audit logging must never crash the primary request flow
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log', err);
  }
};
