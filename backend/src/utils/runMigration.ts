/**
 * Applies database/schema.sql to whatever DATABASE_URL points at.
 *
 * Usage (from backend/):
 *   npm run migrate
 *
 * This is meant for the *first* deploy against a fresh Supabase Postgres
 * database. schema.sql is not idempotent (CREATE TABLE without IF NOT
 * EXISTS), so running it twice against the same database will fail with
 * "already exists" errors — that's expected, not a bug. If you need to
 * change the schema later, write a new incremental .sql migration instead
 * of re-running this one.
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

const SCHEMA_PATH = path.join(__dirname, '../../../database/schema.sql');

const run = async () => {
  if (!process.env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is not set. Add it to backend/.env (see .env.example) before running migrations.');
    process.exit(1);
  }

  if (!fs.existsSync(SCHEMA_PATH)) {
    // eslint-disable-next-line no-console
    console.error(`Schema file not found at ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');

  // eslint-disable-next-line no-console
  console.log('Applying database/schema.sql ...');

  const client = await pool.connect();
  try {
    // node-postgres sends an un-parameterized query string via the simple
    // query protocol, which Postgres itself splits on ';' and runs as one
    // implicit transaction — this is what lets a file containing a
    // plpgsql function body (with semicolons inside $$ ... $$) execute
    // correctly in a single call instead of being naively split here.
    await client.query(sql);
    // eslint-disable-next-line no-console
    console.log('✅ Schema applied successfully.');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('❌ Migration failed:', (err as Error).message);
    // eslint-disable-next-line no-console
    console.error(
      'If this says a table/type/trigger "already exists", the schema has already been applied — ' +
        'that is expected on a second run and is not itself an error to fix.'
    );
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
