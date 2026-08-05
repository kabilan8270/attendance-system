import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { logAudit } from '../services/audit.service';
import {
  listActiveSessions,
  revokeRefreshTokenById,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} from '../services/token.service';

const SALT_ROUNDS = 12;

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

// Pulls the raw refresh token the client sent for "which device am I on"
// purposes (sessions list highlighting + "logout current device"). Frontend
// sends it via the X-Refresh-Token header; falling back to the body keeps
// this working for callers that prefer a JSON payload instead.
const getCurrentRefreshToken = (req: Request): string | undefined => {
  const header = req.headers['x-refresh-token'];
  if (typeof header === 'string' && header.length > 0) return header;
  if (req.body?.refreshToken) return req.body.refreshToken as string;
  return undefined;
};

const ADMIN_CODE_REGEX = /^[A-Za-z0-9_-]{3,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================
// GET /api/admin/profile
// ============================================================
export const getAdminProfile = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const result = await query(
    `SELECT id, admin_code, full_name, email, role, is_active, last_login, created_at, updated_at
     FROM admins WHERE id = $1`,
    [req.user.id]
  );

  if (result.rowCount === 0) throw new AppError('Admin not found', 404);

  const admin = result.rows[0];
  return res.json({
    success: true,
    data: {
      id: admin.id,
      adminCode: admin.admin_code,
      fullName: admin.full_name,
      email: admin.email,
      role: admin.role,
      isActive: admin.is_active,
      lastLogin: admin.last_login,
      createdAt: admin.created_at,
      updatedAt: admin.updated_at,
    },
  });
};

// ============================================================
// PUT /api/admin/profile
// ============================================================
export const updateAdminProfile = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const { adminCode, fullName, email } = req.body as {
    adminCode?: string;
    fullName?: string;
    email?: string;
  };

  if (!adminCode || !fullName || !email) {
    throw new AppError('adminCode, fullName and email are all required', 400);
  }

  const trimmedAdminCode = adminCode.trim();
  const trimmedFullName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!ADMIN_CODE_REGEX.test(trimmedAdminCode)) {
    throw new AppError(
      'Admin ID must be 3-50 characters and contain only letters, numbers, hyphens or underscores',
      400
    );
  }
  if (trimmedFullName.length < 2 || trimmedFullName.length > 150) {
    throw new AppError('Full name must be between 2 and 150 characters', 400);
  }
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    throw new AppError('Please provide a valid email address', 400);
  }

  // Explicit pre-check for a friendly error message; the DB unique
  // constraints are the real guard against race conditions (see the 23505
  // handler in error.middleware.ts).
  const conflict = await query(
    `SELECT id, admin_code, email FROM admins WHERE (admin_code = $1 OR email = $2) AND id != $3`,
    [trimmedAdminCode, trimmedEmail, req.user.id]
  );
  if (conflict.rowCount && conflict.rowCount > 0) {
    const row = conflict.rows[0];
    if (row.admin_code === trimmedAdminCode) {
      throw new AppError('This Admin ID is already in use by another account', 409);
    }
    throw new AppError('This email is already in use by another account', 409);
  }

  const result = await query(
    `UPDATE admins
     SET admin_code = $1, full_name = $2, email = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING id, admin_code, full_name, email, role, is_active, updated_at`,
    [trimmedAdminCode, trimmedFullName, trimmedEmail, req.user.id]
  );

  if (result.rowCount === 0) throw new AppError('Admin not found', 404);

  const admin = result.rows[0];
  await logAudit(
    req.user.id,
    'admin',
    'UPDATE_PROFILE',
    'admins',
    req.user.id,
    { adminCode: trimmedAdminCode, email: trimmedEmail },
    getIp(req)
  );

  return res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      id: admin.id,
      adminCode: admin.admin_code,
      fullName: admin.full_name,
      email: admin.email,
      role: admin.role,
      isActive: admin.is_active,
      updatedAt: admin.updated_at,
    },
  });
};

// ============================================================
// PUT /api/admin/change-password
// ============================================================
export const changeAdminPassword = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const { currentPassword, newPassword, confirmPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new AppError('currentPassword, newPassword and confirmPassword are all required', 400);
  }
  if (newPassword !== confirmPassword) {
    throw new AppError('New password and confirm password do not match', 400);
  }
  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new AppError('New password must contain at least one letter and one number', 400);
  }
  if (newPassword === currentPassword) {
    throw new AppError('New password must be different from the current password', 400);
  }

  const result = await query(`SELECT password_hash FROM admins WHERE id = $1`, [req.user.id]);
  if (result.rowCount === 0) throw new AppError('Admin not found', 404);

  const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!match) throw new AppError('Current password is incorrect', 401);

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(`UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
    newHash,
    req.user.id,
  ]);

  // Rotating the password invalidates every refresh token for safety. The
  // access token used to make this very request stays valid until it
  // naturally expires (max JWT_ACCESS_EXPIRY, default 15m), so the change
  // doesn't abruptly kick the admin out of their own settings page — but any
  // other device (and this one, once its access token expires) will need to
  // log in again.
  await revokeAllRefreshTokensForUser(req.user.id, 'admin');

  await logAudit(req.user.id, 'admin', 'CHANGE_PASSWORD', 'admins', req.user.id, {}, getIp(req));

  return res.json({
    success: true,
    message: 'Password changed successfully. You have been logged out of all other devices.',
  });
};

// ============================================================
// GET /api/admin/sessions
// ============================================================
export const getAdminSessions = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const currentToken = getCurrentRefreshToken(req);
  const sessions = await listActiveSessions(req.user.id, 'admin', currentToken);

  return res.json({ success: true, data: sessions });
};

// ============================================================
// DELETE /api/admin/logout-device
// Body: { sessionId } to log out a specific listed device, OR omit it (with
// the refresh token sent via X-Refresh-Token header) to log out the current
// device only.
// ============================================================
export const logoutAdminDevice = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const { sessionId } = req.body as { sessionId?: string };

  if (sessionId) {
    const revoked = await revokeRefreshTokenById(sessionId, req.user.id, 'admin');
    if (!revoked) throw new AppError('Session not found or already logged out', 404);
    await logAudit(req.user.id, 'admin', 'LOGOUT_DEVICE', 'refresh_tokens', sessionId, {}, getIp(req));
    return res.json({ success: true, message: 'Device logged out successfully' });
  }

  const currentToken = getCurrentRefreshToken(req);
  if (!currentToken) {
    throw new AppError('sessionId or refreshToken is required', 400);
  }
  await revokeRefreshToken(currentToken);
  await logAudit(req.user.id, 'admin', 'LOGOUT_DEVICE', 'refresh_tokens', null, {}, getIp(req));
  return res.json({ success: true, message: 'Logged out of this device successfully' });
};

// ============================================================
// DELETE /api/admin/logout-all
// ============================================================
export const logoutAdminAllDevices = async (req: Request, res: Response) => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  await revokeAllRefreshTokensForUser(req.user.id, 'admin');
  await logAudit(req.user.id, 'admin', 'LOGOUT_ALL_DEVICES', 'refresh_tokens', null, {}, getIp(req));

  return res.json({ success: true, message: 'Logged out of all devices successfully' });
};
