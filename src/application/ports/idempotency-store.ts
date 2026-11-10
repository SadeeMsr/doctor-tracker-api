/** The response replayed for a repeated request. */
export interface StoredResponse {
  statusCode: number;
  body: unknown;
  location?: string;
}

export type IdempotencyClaim =
  | { status: 'claimed' }
  | { status: 'processing'; requestHash: string }
  | { status: 'completed'; requestHash: string; response: StoredResponse };

/**
 * Remembers the outcome of requests sent with an `Idempotency-Key`, so a retried request is
 * answered with the original response instead of being executed twice.
 *
 * Contract:
 * - `claim` is atomic: of two concurrent claims for the same key, exactly one gets `claimed`.
 * - An unfinished claim older than the store's lock timeout is considered abandoned (the
 *   process died mid-request) and can be claimed again.
 * - `release` forgets a claim so the key can be retried (used after 5xx / aborted requests).
 * - Records expire after 24 hours.
 */
export interface IdempotencyStore {
  claim(key: string, requestHash: string): Promise<IdempotencyClaim>;
  complete(key: string, response: StoredResponse): Promise<void>;
  release(key: string): Promise<void>;
}
