/**
 * The API error envelope.
 *
 * Every response is either { ok: true, data } or
 * { ok: false, error: { code, message } }. A SQL error never reaches the client.
 */

export class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorised = (message = 'You need to sign in.') =>
  new AppError(401, 'UNAUTHORISED', message);
export const forbidden = (message = 'That is not yours.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message) => new AppError(409, 'CONFLICT', message);
export const unprocessable = (message, details) =>
  new AppError(422, 'UNPROCESSABLE', message, details);
export const tooMany = (message) => new AppError(429, 'RATE_LIMITED', message);

/** A rule from final.md that the user tried to break. Always shown verbatim. */
export const ruleViolation = (message) => new AppError(422, 'RULE', message);

export function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function fail(res, status, code, message, details = null) {
  const error = { code, message };
  if (details) error.details = details;
  return res.status(status).json({ ok: false, error });
}

/**
 * MySQL errors that carry a message the user should actually see, because they
 * come from a trigger or a CHECK constraint that encodes a rule from final.md.
 */
export function translateDbError(err) {
  if (!err || typeof err !== 'object') return null;
  // SIGNAL SQLSTATE '45000' from a trigger
  if (err.errno === 1644 && err.sqlState === '45000') {
    return new AppError(422, 'RULE', err.sqlMessage || err.message);
  }
  // CHECK constraint failed
  if (err.errno === 3819) {
    const which = /CONSTRAINT `?(\w+)`?/.exec(err.sqlMessage ?? '')?.[1] ?? '';
    const known = {
      chk_gate_evidence:
        'A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.',
      chk_deal_delivery:
        'A deal cannot move to delivery without an advance date and an advance amount. Fifty per cent advance, always.',
      chk_deal_paid: 'A deal cannot be marked paid without a balance date.',
      chk_rating: 'A rating must be between 1 and 5.',
    };
    return new AppError(422, 'RULE', known[which] ?? 'That change breaks a rule set by the roadmap.');
  }
  if (err.errno === 1062) {
    return new AppError(409, 'CONFLICT', 'That already exists.');
  }
  if (err.errno === 1452) {
    return new AppError(400, 'BAD_REQUEST', 'That refers to something which does not exist.');
  }
  return null;
}
