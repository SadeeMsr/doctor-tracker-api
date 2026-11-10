export type HttpErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

/** Transport-level errors (bad JSON, unknown route, rate limit) that never reach the domain. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: HttpErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: HttpErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
