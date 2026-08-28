/**
 * Request validation.
 *
 * Every request body, query string and route parameter is parsed by zod at the
 * boundary. A handler never sees an unvalidated value, and never validates.
 */

import { z } from 'zod';
import { unprocessable } from '../lib/errors.mjs';
import { isIsoDate } from '../lib/dates.mjs';

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
  .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal(1), z.literal(0), z.literal('1'), z.literal('0')])
  .transform((v) => v === true || v === 'true' || v === 1 || v === '1');

export const minutes = z.coerce.number().int().min(0).max(1440);
export const smallCount = z.coerce.number().int().min(0).max(9999);
export const rupees = z.coerce.number().int().min(0).max(100_000_000);

/* --------------------------------------------------------------- middleware */

function firstIssue(error) {
  const issue = error.issues?.[0];
  if (!issue) return 'That input is not valid.';
  const path = issue.path?.length ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}

function issueList(error) {
  return (error.issues ?? []).map((i) => ({
    field: i.path?.join('.') ?? '',
    message: i.message,
  }));
}

/**
 * validate({ body, query, params }) returns an Express middleware. Each schema is
 * optional. The parsed result replaces the raw value, so a handler can only see
 * what passed.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) {
        // Express 5 makes req.query a getter, so the parsed value is stashed
        // alongside rather than assigned over it.
        req.validQuery = schemas.query.parse({ ...req.query });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      return next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(unprocessable(firstIssue(err), issueList(err)));
      }
      return next(err);
    }
  };
}

export { z };
