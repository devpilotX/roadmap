/**
 * validate.ts | request validation.
 *
 * Every request body, query string and route parameter is parsed by zod at the
 * boundary. A handler never sees an unvalidated value, and never validates.
 */

import { z } from 'zod';
import { AppError, badRequest, unprocessable, type ErrorDetail } from '../errors';
import { isIsoDate } from '../dates';

/* ------------------------------------------------------------ shared types */

export const isoDate = z
  .string()
  .trim()
  .refine(isIsoDate, { message: 'Must be a real date in YYYY-MM-DD form.' });

export const positiveId = z.coerce.number().int().positive().max(9_007_199_254_740_991);

export const weekNumber = z.coerce.number().int().min(1).max(21);

/** Free text stored verbatim. Escaping happens at render time, not here. */
export const text = (max = 2000) => z.string().max(max).trim();

export const optionalText = (max = 2000) =>
  z
    .union([z.string().max(max), z.null(), z.literal('')])
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const t = String(v).trim();
      return t === '' ? null : t;
    })
    .nullable();

/** An absolute http or https URL. Anything else is rejected at the boundary. */
export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Must be a full URL starting with http:// or https://' }
  );

export const optionalHttpUrl = z
  .union([httpUrl, z.literal(''), z.null()])
  .transform((v) => (v === '' || v === null || v === undefined ? null : v))
  .nullable();

export const boolish = z
  .union([
    z.boolean(),
    z.literal('true'),
    z.literal('false'),
    z.literal(1),
    z.literal(0),
    z.literal('1'),
    z.literal('0'),
  ])
  .transform((v) => v === true || v === 'true' || v === 1 || v === '1');

export const minutes = z.coerce.number().int().min(0).max(1440);
export const smallCount = z.coerce.number().int().min(0).max(9999);
export const rupees = z.coerce.number().int().min(0).max(100_000_000);

/* --------------------------------------------------------------- helpers */

function firstIssue(error: z.ZodError): string {
  const issue = error.issues?.[0];
  if (!issue) return 'That input is not valid.';
  const path = issue.path?.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}

function issueList(error: z.ZodError): ErrorDetail[] {
  return (error.issues ?? []).map((i) => ({
    field: i.path?.join('.') ?? '',
    message: i.message,
  }));
}

/** Parses a value, turning a ZodError into the standard 422 envelope. */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw unprocessable(firstIssue(result.error), issueList(result.error));
  }
  return result.data;
}

/**
 * The largest request body this application will read.
 *
 * The Express build set this on the body parser, in front of every route:
 * `express.json({ limit: '256kb' })`. Next imposes no limit on a route handler, so
 * without this a single request could buffer as much memory as it liked before any
 * validation ran. The number is the same 256 kB.
 *
 * The one body that is deliberately allowed to be larger is the lead CSV import,
 * which declares its own ceiling in its schema. It passes `maxBytes` explicitly, so
 * the exception is visible at the call site rather than hidden here.
 */
export const MAX_BODY_BYTES = 256 * 1024;

/**
 * Reads and validates a JSON body.
 *
 * A missing or unparsable body becomes an empty object, which is what the
 * Express build did, so a schema of all optional fields still succeeds.
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
  { maxBytes = MAX_BODY_BYTES }: { maxBytes?: number } = {}
): Promise<z.output<T>> {
  // Refuse on the declared length first, so an oversized body is rejected before
  // it is read rather than after.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw badRequest('That request is larger than this application accepts.');
  }

  let raw: unknown = {};
  try {
    const text = await request.text();
    // A chunked request sends no content-length, so the real size is checked too.
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw badRequest('That request is larger than this application accepts.');
    }
    raw = text ? JSON.parse(text) : {};
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw unprocessable('The request body was not valid JSON.');
  }
  return parse(schema, raw ?? {});
}

/** Validates the query string of a request. */
export function parseQuery<T extends z.ZodType>(request: Request, schema: T): z.output<T> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    // Only the first value of a repeated parameter is used, matching Express.
    if (!(key in raw)) raw[key] = value;
  }
  return parse(schema, raw);
}

/** Validates the dynamic route parameters. */
export function parseParams<T extends z.ZodType>(
  params: Record<string, string | string[] | undefined>,
  schema: T
): z.output<T> {
  return parse(schema, params);
}

export { z };
