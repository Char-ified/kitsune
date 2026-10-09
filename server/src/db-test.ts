import pool from './db.js';

await pool.query('CREATE TABLE IF NOT EXISTS test_records (id SERIAL PRIMARY KEY, message TEXT)');

await pool.query("INSERT INTO test_records (message) VALUES ('hello from kitsune')");

const read = await pool.query('SELECT * FROM test_records');

console.log(read.rows);

await pool.end();
