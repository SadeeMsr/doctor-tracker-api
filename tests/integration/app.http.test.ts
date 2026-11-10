import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildTestApp } from '../support/app.js';
import { buildInMemoryContainer } from '../support/in-memory-container.js';

// The whole HTTP stack on in-memory adapters: no database needed.
const app = buildTestApp(buildInMemoryContainer());

describe('app', () => {
  it('answers unknown routes with the JSON error envelope and a request id', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
