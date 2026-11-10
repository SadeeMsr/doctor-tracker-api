import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { DomainError, type DomainErrorCode } from '../../../domain/shared/errors.js';
import { HttpError } from '../errors/http-error.js';

const DOMAIN_STATUS: Record<DomainErrorCode, { status: number; code: HttpError['code'] }> = {
  NOT_FOUND: { status: 404, code: 'NOT_FOUND' },
  CONFLICT: { status: 409, code: 'CONFLICT' },
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
  INVALID_INPUT: { status: 422, code: 'VALIDATION_ERROR' },
};

function isBodyParseError(error: unknown): boolean {
  return error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
}

/** Translate any thrown value into an HTTP error. Unknown errors become an opaque 500. */
function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  if (error instanceof DomainError) {
    const { status, code } = DOMAIN_STATUS[error.code];
    return new HttpError(status, code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return new HttpError(
      422,
      'VALIDATION_ERROR',
      'Request validation failed',
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  if (isBodyParseError(error)) return new HttpError(400, 'BAD_REQUEST', 'Malformed JSON body');

  return new HttpError(500, 'INTERNAL_ERROR', 'Something went wrong');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

export function createErrorHandler({ exposeStack }: { exposeStack: boolean }): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const httpError = toHttpError(error);

    if (httpError.status >= 500) {
      req.log.error({ err: error }, 'Unhandled error');
    } else {
      req.log.warn({ code: httpError.code, message: httpError.message }, 'Request failed');
    }

    const stack =
      exposeStack && httpError.status >= 500 && error instanceof Error ? error.stack : undefined;

    res.status(httpError.status).json({
      error: {
        code: httpError.code,
        message: httpError.message,
        ...(httpError.details !== undefined && { details: httpError.details }),
        ...(stack && { details: { stack } }),
        ...(typeof req.id === 'string' && { requestId: req.id }),
      },
    });
  };
}
