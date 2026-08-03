import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { pool } from './config/db';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Verify DB connectivity before accepting traffic
    await pool.query('SELECT 1');
    // eslint-disable-next-line no-console
    console.log('Database connection established');

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Attendance API server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server — database connection error:', err);
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', async () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, closing server gracefully');
  await pool.end();
  process.exit(0);
});
