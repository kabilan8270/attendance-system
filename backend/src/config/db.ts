import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,

  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,

  max: 20,

  idleTimeoutMillis: 30000,

  connectionTimeoutMillis: 5000,

  allowExitOnIdle: true
};

export const pool = new Pool(poolConfig);

pool.on("connect", () => {
  console.log("✅ PostgreSQL Connected");
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL Error:", err);
});

export const query = async (
  text: string,
  params?: unknown[]
) => {

  const start = Date.now();

  const result = await pool.query(text, params);

  const duration = Date.now() - start;

  if (process.env.NODE_ENV === "development") {

    console.log({
      query: text,
      duration,
      rows: result.rowCount
    });

  }

  return result;
};

export const getClient = () => pool.connect();