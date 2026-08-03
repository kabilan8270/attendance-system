import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/db';
import {
  signAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} from '../services/token.service';
import { logAudit } from '../services/audit.service';

const SALT_ROUNDS = 12;

const getDeviceInfo = (req: Request): string => req.headers['user-agent']?.slice(0, 250) || 'unknown-device';
const getIp = (req: Request): string => (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';

// ============================================================
// ADMIN LOGIN
// ============================================================
export const adminLogin = async (req: Request, res: Response) => {
  const { adminCode, password } = req.body;

  if (!adminCode || !password) {
    return res.status(400).json({ success: false, message: 'Admin ID and password are required' });
  }

  const result = await query(
    `SELECT id, admin_code, full_name, email, password_hash, role, is_active
     FROM admins WHERE admin_code = $1`,
    [adminCode]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const admin = result.rows[0];

  if (!admin.is_active) {
    return res.status(403).json({ success: false, message: 'This admin account has been disabled' });
  }

  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const accessToken = signAccessToken({ sub: admin.id, userType: 'admin', role: admin.role });
  const refreshToken = await issueRefreshToken(admin.id, 'admin', getDeviceInfo(req), getIp(req));

  await query(`UPDATE admins SET last_login = NOW() WHERE id = $1`, [admin.id]);
  await logAudit(admin.id, 'admin', 'LOGIN', 'admins', admin.id, {}, getIp(req));

  return res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: admin.id,
        adminCode: admin.admin_code,
        fullName: admin.full_name,
        email: admin.email,
        role: admin.role,
      },
    },
  });
};

// ============================================================
// EMPLOYEE LOGIN
// ============================================================
export const employeeLogin = async (req: Request, res: Response) => {
  const { employeeId, password } = req.body;

  if (!employeeId || !password) {
    return res.status(400).json({ success: false, message: 'Employee ID and password are required' });
  }

  const result = await query(
    `SELECT id, employee_id, full_name, email, password_hash, status
     FROM employees WHERE employee_id = $1`,
    [employeeId]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const employee = result.rows[0];

  if (employee.status === 'disabled') {
    return res.status(403).json({ success: false, message: 'This account has been disabled by admin' });
  }

  const match = await bcrypt.compare(password, employee.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const accessToken = signAccessToken({
    sub: employee.id,
    userType: 'employee',
    employeeId: employee.employee_id,
  });
  const refreshToken = await issueRefreshToken(employee.id, 'employee', getDeviceInfo(req), getIp(req));

  await query(`UPDATE employees SET last_login = NOW() WHERE id = $1`, [employee.id]);
  await logAudit(employee.id, 'employee', 'LOGIN', 'employees', employee.id, {}, getIp(req));

  return res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: employee.id,
        employeeId: employee.employee_id,
        fullName: employee.full_name,
        email: employee.email,
      },
    },
  });
};

// ============================================================
// REFRESH ACCESS TOKEN
// ============================================================
export const refreshAccessToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }

  const verified = await verifyRefreshToken(refreshToken);
  if (!verified) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }

  let payload;
  if (verified.userType === 'admin') {
    const result = await query(`SELECT id, role, is_active FROM admins WHERE id = $1`, [verified.userId]);
    if (result.rowCount === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Account not found or disabled' });
    }
    payload = { sub: verified.userId, userType: 'admin' as const, role: result.rows[0].role };
  } else {
    const result = await query(`SELECT id, employee_id, status FROM employees WHERE id = $1`, [verified.userId]);
    if (result.rowCount === 0 || result.rows[0].status === 'disabled') {
      return res.status(401).json({ success: false, message: 'Account not found or disabled' });
    }
    payload = {
      sub: verified.userId,
      userType: 'employee' as const,
      employeeId: result.rows[0].employee_id,
    };
  }

  const newAccessToken = signAccessToken(payload);
  return res.json({ success: true, data: { accessToken: newAccessToken } });
};

// ============================================================
// LOGOUT (revokes the specific device's refresh token)
// ============================================================
export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
};

// ============================================================
// LOGOUT ALL DEVICES
// ============================================================
export const logoutAllDevices = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  await revokeAllRefreshTokensForUser(req.user.id, req.user.userType);
  return res.json({ success: true, message: 'Logged out from all devices' });
};

// ============================================================
// FORGOT PASSWORD (generates reset token; in production this is emailed)
// ============================================================
export const forgotPassword = async (req: Request, res: Response) => {
  const { identifier, userType } = req.body; // identifier = adminCode or employeeId
  if (!identifier || !userType) {
    return res.status(400).json({ success: false, message: 'Identifier and userType are required' });
  }

  const table = userType === 'admin' ? 'admins' : 'employees';
  const idColumn = userType === 'admin' ? 'admin_code' : 'employee_id';

  const result = await query(`SELECT id, email FROM ${table} WHERE ${idColumn} = $1`, [identifier]);

  // Always return success to avoid user enumeration
  if (result.rowCount === 0) {
    return res.json({ success: true, message: 'If the account exists, a reset link has been sent' });
  }

  const user = result.rows[0];
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await query(
    `UPDATE ${table} SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
    [resetTokenHash, expires, user.id]
  );

  // In production: send `resetToken` via email using a mail service (SES/SendGrid).
  // We do not log or return the raw token to the client in production.
  return res.json({
    success: true,
    message: 'If the account exists, a reset link has been sent',
    ...(process.env.NODE_ENV === 'development' ? { devResetToken: resetToken } : {}),
  });
};

// ============================================================
// RESET PASSWORD (via token from forgot-password email link)
// ============================================================
export const resetPassword = async (req: Request, res: Response) => {
  const { token, userType, newPassword } = req.body;
  if (!token || !userType || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token, userType and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  const table = userType === 'admin' ? 'admins' : 'employees';
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await query(
    `SELECT id FROM ${table} WHERE reset_token = $1 AND reset_token_expires > NOW()`,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    `UPDATE ${table} SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
    [passwordHash, result.rows[0].id]
  );

  await revokeAllRefreshTokensForUser(result.rows[0].id, userType);

  return res.json({ success: true, message: 'Password reset successfully. Please log in again.' });
};

// ============================================================
// CHANGE PASSWORD (authenticated user)
// ============================================================
export const changePassword = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }

  const table = req.user.userType === 'admin' ? 'admins' : 'employees';
  const result = await query(`SELECT password_hash FROM ${table} WHERE id = $1`, [req.user.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [newHash, req.user.id]);

  await logAudit(req.user.id, req.user.userType, 'CHANGE_PASSWORD', table, req.user.id, {}, getIp(req));

  return res.json({ success: true, message: 'Password changed successfully' });
};
