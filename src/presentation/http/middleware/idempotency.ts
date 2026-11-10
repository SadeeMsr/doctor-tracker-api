import { createHash } from 'node:crypto';

import type { Request, RequestHandler, Response } from 'express';

import type { IdempotencyStore } from '../../../application/ports/idempotency-store.js';
import { HttpError } from '../errors/http-error.js';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const REPLAYED_HEADER = 'Idempotent-Replayed';

/** Visible ASCII, 1–255 chars. Clients send a UUID. */
const KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

export interface IdempotencyOptions {
  /** Reject requests without the header. Use on creates that have no natural unique key. */
  required: boolean;
}

export type IdempotencyMiddleware = (options: IdempotencyOptions) => RequestHandler;

function hashBody(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(body ?? null))
    .digest('hex');
}

/**
 * Store the response once it has been sent. 5xx and aborted responses are released instead,
 * so the client can retry the same key.
 */
function recordOutcome(req: Request, res: Response, store: IdempotencyStore, key: string) {
  let body: unknown;
  let hasBody = false;
  const send = res.json.bind(res);
  res.json = (payload: unknown) => {
    body = payload;
    hasBody = true;
    return send(payload);
  };

  const logFailure = (error: unknown) => {
    req.log.error({ err: error }, 'Failed to record idempotent response');
  };

  res.once('finish', () => {
    const location = res.getHeader('location');
    const outcome =
      res.statusCode < 500 && hasBody
        ? store.complete(key, {
            statusCode: res.statusCode,
            body,
            ...(typeof location === 'string' && { location }),
          })
        : store.release(key);
    outcome.catch(logFailure);
  });

  res.once('close', () => {
    if (!res.writableFinished) store.release(key).catch(logFailure);
  });
}

/**
 * `Idempotency-Key` support (see AGENTS.md → Idempotency). A repeated request with the same key
 * and body gets the original response replayed instead of being executed again.
 */
export function createIdempotencyMiddleware(store: IdempotencyStore): IdempotencyMiddleware {
  return ({ required }) =>
    async (req, res, next) => {
      const clientKey = req.get(IDEMPOTENCY_HEADER);

      if (clientKey === undefined) {
        if (required)
          throw new HttpError(400, 'BAD_REQUEST', `${IDEMPOTENCY_HEADER} header is required`);
        next();
        return;
      }
      if (!KEY_PATTERN.test(clientKey)) {
        throw new HttpError(
          400,
          'BAD_REQUEST',
          `${IDEMPOTENCY_HEADER} must be 1-255 visible ASCII characters`,
        );
      }

      // Scoped by user and endpoint, so one user's key can never replay another user's response.
      // `/doctors` and `/doctors/` are the same endpoint, so drop a trailing slash.
      const path = `${req.baseUrl}${req.path}`.replace(/\/+$/, '');
      const key = `${req.auth?.userId ?? 'anonymous'} ${req.method} ${path} ${clientKey}`;
      const requestHash = hashBody(req.body);
      const claim = await store.claim(key, requestHash);

      if (claim.status === 'claimed') {
        recordOutcome(req, res, store, key);
        next();
        return;
      }
      if (claim.requestHash !== requestHash) {
        throw new HttpError(
          422,
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key was already used with a different request',
        );
      }
      if (claim.status === 'processing') {
        throw new HttpError(
          409,
          'IDEMPOTENCY_IN_PROGRESS',
          'A request with this Idempotency-Key is still being processed',
        );
      }

      res.setHeader(REPLAYED_HEADER, 'true');
      if (claim.response.location) res.location(claim.response.location);
      res.status(claim.response.statusCode).json(claim.response.body);
    };
}
