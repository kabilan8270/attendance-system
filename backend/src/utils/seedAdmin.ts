/**
 * Run once after migrating the schema:
 *   ts-node src/utils/seedAdmin.ts
 * Creates the first super_admin account so you can log in and start
 * configuring departments, shifts, office GPS location, etc.
 */
import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { pool } from '../config/db';

const run = async () => {
  const adminCode = process.env.SEED_ADMIN_CODE || 'ADMIN001';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@company.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO admins (admin_code, full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'super_admin')
     ON CONFLICT (admin_code) DO NOTHING`,
    [adminCode, 'Super Administrator', email, passwordHash]
  );

  // eslint-disable-next-line no-console
  console.log(`Super admin ready. Login ID: ${adminCode}  Password: ${password}`);
  // eslint-disable-next-line no-console
  console.log('IMPORTANT: change this password immediately after first login.');

  await pool.end();
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
