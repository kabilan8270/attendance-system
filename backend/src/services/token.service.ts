import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db';
import { JwtAccessPayload, UserType } from '../utils/types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT secrets are not configured. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in .env');
}

export const signAccessToken = (payload: JwtAccessPayload): string => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
};

export const verifyAccessToken = (token: string): JwtAccessPayload => {
  return jwt.verify(token, ACCESS_SECRET) as JwtAccessPayload;
};

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const refreshExpiryToDate = (): Date => {
  const match = REFRESH_EXPIRY.match(/^(\d+)([smhd])$/);
  const now = new Date();
  if (!match) {
    now.setDate(now.getDate() + 30);
    return now;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(now.getTime() + value * multipliers[unit]);
};

/**
 * Issues a refresh token and persists its hash in the DB.
 * Multiple simultaneous refresh tokens per user are allowed by design,
 * so a user can be logged in on unlimited devices at once.
 */
export const issueRefreshToken = async (
  userId: string,
  userType: UserType,
  deviceInfo: string,
  ipAddress: string
): Promise<string> => {
  const rawToken = jwt.sign({ sub: userId, userType, jti: uuidv4() }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });

  await query(
    `INSERT INTO refresh_tokens (user_id, user_type, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, userType, hashToken(rawToken), deviceInfo, ipAddress, refreshExpiryToDate()]
  );

  return rawToken;
};

export const verifyRefreshToken = async (
  rawToken: string
): Promise<{ userId: string; userType: UserType } | null> => {
  try {
    const decoded = jwt.verify(rawToken, REFRESH_SECRET) as {
      sub: string;
      userType: UserType;
    };

    const tokenHash = hashToken(rawToken);
    const result = await query(
      `SELECT id FROM refresh_tokens
       WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rowCount === 0) return null;

    return { userId: decoded.sub, userType: decoded.userType };
  } catch {
    return null;
  }
};

export const revokeRefreshToken = async (rawToken: string): Promise<void> => {
  const tokenHash = hashToken(rawToken);
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
};

export const revokeAllRefreshTokensForUser = async (
  userId: string,
  userType: UserType
): Promise<void> => {
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND user_type = $2`,
    [userId, userType]
  );
};
