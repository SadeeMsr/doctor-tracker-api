interface Entry<T> {
  expiresAt: number;
  value: Promise<T>;
}

/**
 * In-process TTL cache of promises. Caching the promise (not the result) also collapses
 * concurrent identical requests into one query. Per process: use Redis when running several
 * instances.
 */
export class TtlCache {
  readonly #entries = new Map<string, Entry<unknown>>();
  readonly #ttlMs: number;
  readonly #maxEntries: number;

  constructor({ ttlMs, maxEntries = 500 }: { ttlMs: number; maxEntries?: number }) {
    this.#ttlMs = ttlMs;
    this.#maxEntries = maxEntries;
  }

  getOrLoad<T>(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.#entries.get(key) as Entry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    // Promise.resolve subscribes exactly once, so a lazy thenable (e.g. a Mongoose query) runs
    // once and every caller shares the same settled promise.
    const value = Promise.resolve(load());
    this.#entries.set(key, { expiresAt: Date.now() + this.#ttlMs, value });
    // Never cache failures: the next caller retries.
    value.catch(() => this.#entries.delete(key));

    if (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) this.#entries.delete(oldest);
    }
    return value;
  }
}
