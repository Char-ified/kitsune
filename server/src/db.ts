import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to server/.env');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Without this, an idle connection dropped by the database would crash the server.
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

export default pool;
