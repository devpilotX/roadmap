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
 *
 * The pool is cached on globalThis because the Next development server reloads
 * modules on every edit, and a fresh pool per reload would exhaust MySQL's
 * connection limit within a few saves.
 *
 * There is deliberately no `import 'server-only'` here, and there must not be.
 * The CLI scripts in scripts/ and the tests in tests/ both import this module
 * from plain Node, where that package throws on purpose. The protection it gives
 * is not lost: this file imports mysql2 and node:crypto through its callers, so
 * pulling it into a client component fails the build with a clear message anyway.
 * The same applies to every module under lib/db/. The four files under lib/server/
 * that import next/headers do keep the guard, because nothing outside a request
 * can use them at all.
 */

import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { assertDbConfig, config } from '../config';

/**
 * A database row.
 *
 * Deliberately a plain indexed record rather than an intersection with mysql2's
 * RowDataPacket. RowDataPacket declares a `constructor` property and no index
 * signature, and intersecting it makes `{ ...row, extra }` collapse to only the
 * statically known keys, which breaks every shaping function in the codebase.
 */
export type Row = Record<string, any>;
export type SqlParam = string | number | boolean | null | Buffer | Date;

declare global {
  var __roadmapPool: Pool | undefined;
}

export function getPool(): Pool {
  if (globalThis.__roadmapPool) return globalThis.__roadmapPool;
  assertDbConfig();
  const pool = mysql.createPool({
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
    conn.query(
      "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION,ERROR_FOR_DIVISION_BY_ZERO'"
    );
  });
  globalThis.__roadmapPool = pool;
  return pool;
}

/** SELECT returning an array of rows. */
export async function query<T extends Row = Row>(
  sql: string,
  params: SqlParam[] = []
): Promise<T[]> {
  const [rows] = await getPool().execute<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

/** SELECT returning the first row or null. */
export async function one<T extends Row = Row>(
  sql: string,
  params: SqlParam[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length ? rows[0] : null;
}

/** SELECT returning a single scalar, or null when there is no row. */
export async function scalar<T = unknown>(
  sql: string,
  params: SqlParam[] = []
): Promise<T | null> {
  const row = await one(sql, params);
  if (!row) return null;
  const keys = Object.keys(row);
  return keys.length ? (row[keys[0]] as T) : null;
}

/** INSERT, UPDATE or DELETE. Returns { affectedRows, insertId }. */
export async function run(sql: string, params: SqlParam[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

/** The query helpers bound to a single connection inside a transaction. */
export interface Tx {
  raw: PoolConnection;
  query<T extends Row = Row>(sql: string, params?: SqlParam[]): Promise<T[]>;
  one<T extends Row = Row>(sql: string, params?: SqlParam[]): Promise<T | null>;
  run(sql: string, params?: SqlParam[]): Promise<ResultSetHeader>;
}

/**
 * Run a function inside a transaction. Commits on return, rolls back on throw.
 * The callback receives a connection with the same query helpers bound to it.
 */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const api: Tx = {
      raw: conn,
      async query<R extends Row = Row>(sql: string, params: SqlParam[] = []) {
        const [rows] = await conn.execute<RowDataPacket[]>(sql, params);
        return rows as unknown as R[];
      },
      async one<R extends Row = Row>(sql: string, params: SqlParam[] = []) {
        const [rows] = await conn.execute<RowDataPacket[]>(sql, params);
        return rows.length ? (rows[0] as unknown as R) : null;
      },
      async run(sql: string, params: SqlParam[] = []) {
        const [result] = await conn.execute<ResultSetHeader>(sql, params);
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

/**
 * A `LIMIT n OFFSET m` clause built from integers rather than placeholders.
 *
 * This exists because of a real MySQL protocol limitation, not a preference.
 * Every helper in this file uses `execute()`, which is a genuine prepared
 * statement, and MySQL refuses a bound parameter in LIMIT or OFFSET there:
 *
 *   SELECT ... LIMIT ? OFFSET ?     ->  Error: Incorrect arguments to
 *                                       mysqld_stmt_execute
 *
 * That error is a runtime one. It type checks, it lints, and it fails on the
 * first request — which is exactly how five paginated endpoints were nearly
 * shipped broken.
 *
 * Interpolating here is safe, and is the only reason this function exists rather
 * than the caller doing it: both values pass through Math.trunc and are clamped
 * to a bounded range, so what reaches the SQL is always a plain integer. Nothing
 * a caller can pass — a string, a float, NaN, Infinity, a nested object — can
 * emerge as anything other than a number in range.
 *
 * @param limit  rows to return. Clamped to 1..MAX_PAGE_SIZE.
 * @param offset rows to skip. Clamped to 0..MAX_PAGE_OFFSET.
 */
export const MAX_PAGE_SIZE = 1000;
export const MAX_PAGE_OFFSET = 1_000_000;

export function limitOffset(limit: number, offset: number = 0): string {
  const l = Number(limit);
  const o = Number(offset);
  const safeLimit = Number.isFinite(l)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(l)))
    : MAX_PAGE_SIZE;
  const safeOffset = Number.isFinite(o)
    ? Math.min(MAX_PAGE_OFFSET, Math.max(0, Math.trunc(o)))
    : 0;
  return `LIMIT ${safeLimit} OFFSET ${safeOffset}`;
}

export async function closePool(): Promise<void> {
  if (globalThis.__roadmapPool) {
    await globalThis.__roadmapPool.end();
    globalThis.__roadmapPool = undefined;
  }
}

/** True when the database answers. Used by the health check and the runbook. */
export async function ping(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
