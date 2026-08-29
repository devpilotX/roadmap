/**
 * The API error envelope.
 *
 * Every response is either { ok: true, data } or
 * { ok: false, error: { code, message } }. A SQL error never reaches the client.
 */

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[] | null;
  readonly expose = true;

  constructor(status: number, code: string, message: string, details: ErrorDetail[] | null = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: ErrorDetail[] | null) =>
  new AppError(400, 'BAD_REQUEST', message, details ?? null);

export const unauthorised = (message = 'You need to sign in.') =>
  new AppError(401, 'UNAUTHORISED', message);

export const forbidden = (message = 'That is not yours.') => new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export const unprocessable = (message: string, details?: ErrorDetail[] | null) =>
  new AppError(422, 'UNPROCESSABLE', message, details ?? null);

export const tooMany = (message: string) => new AppError(429, 'RATE_LIMITED', message);

/** A rule from final.md that the user tried to break. Always shown verbatim. */
export const ruleViolation = (message: string) => new AppError(422, 'RULE', message);

interface MysqlError {
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
  message?: string;
}

/**
 * MySQL errors that carry a message the user should actually see, because they
 * come from a trigger or a CHECK constraint that encodes a rule from final.md.
 */
export function translateDbError(err: unknown): AppError | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as MysqlError;

  // SIGNAL SQLSTATE '45000' from a trigger
  if (e.errno === 1644 && e.sqlState === '45000') {
    return new AppError(422, 'RULE', e.sqlMessage || e.message || 'That breaks a rule.');
  }

  // CHECK constraint failed
  if (e.errno === 3819) {
    const which = /CONSTRAINT `?(\w+)`?/.exec(e.sqlMessage ?? '')?.[1] ?? '';
    const known: Record<string, string> = {
      chk_gate_evidence:
        'A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.',
      chk_deal_delivery:
        'A deal cannot move to delivery without an advance date and an advance amount. Fifty per cent advance, always.',
      chk_deal_paid: 'A deal cannot be marked paid without a balance date.',
      chk_rating: 'A rating must be between 1 and 5.',
    };
    return new AppError(
      422,
      'RULE',
      known[which] ?? 'That change breaks a rule set by the roadmap.'
    );
  }

  if (e.errno === 1062) return new AppError(409, 'CONFLICT', 'That already exists.');
  if (e.errno === 1452) {
    return new AppError(400, 'BAD_REQUEST', 'That refers to something which does not exist.');
  }
  return null;
}
