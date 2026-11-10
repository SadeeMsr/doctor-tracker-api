/**
 * Business-level errors. They carry no HTTP knowledge; the presentation layer decides
 * how each one is exposed (status code, body shape).
 */
export type DomainErrorCode =
  'NOT_FOUND' | 'CONFLICT' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(resource: string) {
    super(`${resource} not found`);
  }
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

export class InvalidInputError extends DomainError {
  readonly code = 'INVALID_INPUT';
}
