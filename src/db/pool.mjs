/**
 * The MySQL connection pool.
 *
 * Three decisions worth knowing:
 *   1. dateStrings is on, so DATE and DATETIME come back as strings. Calendar
 *      dates never become JavaScript Date objects, so they can never shift by a
 *      timezone. Part 12.1 of the build prompt requires exactly this.
 *   2. Every connection sets time_zone to +05:30, so CURDATE() inside triggers
 *      and SQL is Asia/Kolkata. India has no daylight saving, but the offset is
 *      stated explicitly rather than relied upon implicitly.
 *   3. multipleStatements stays off. Every query is parameterised, always.
 */

import mysql from 'mysql2/promise';
import { config } from '../config.mjs';

let pool = null;

export function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    maxIdle: config.db.connectionLimit,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    multipleStatements: false,
    dateStrings: true,
    charset: 'utf8mb4_0900_ai_ci',
    timezone: '+05:30',
    namedPlaceholders: false,
  });
  pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+05:30'");
    conn.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION,ERROR_FOR_DIVISION_BY_ZERO'");
  });
  return pool;
}

/** SELECT returning an array of rows. */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** SELECT returning the first row or null. */
export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/** SELECT returning a single scalar, or null when there is no row. */
export async function scalar(sql, params = []) {
  const row = await one(sql, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length ? row[keys[0]] : null;
}

/** INSERT, UPDATE or DELETE. Returns { affectedRows, insertId }. */
export async function run(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return result;
}

/**
 * Run a function inside a transaction. Commits on return, rolls back on throw.
 * The callback receives a connection with the same query helpers bound to it.
 */
export async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const api = {
      raw: conn,
      async query(sql, params = []) {
        const [rows] = await conn.execute(sql, params);
        return rows;
      },
      async one(sql, params = []) {
        const [rows] = await conn.execute(sql, params);
        return rows.length ? rows[0] : null;
      },
      async run(sql, params = []) {
        const [result] = await conn.execute(sql, params);
        return result;
      },
    };
    const out = await fn(api);
    await conn.commit();
    return out;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // The rollback failure is not the interesting error.
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** True when the database answers. Used by the health check and the runbook. */
export async function ping() {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
