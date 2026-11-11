import type { Express } from 'express';
import request from 'supertest';

import type { Container } from '../../src/container.js';

type Services = Container['services'];

export const TEST_ADMIN = {
  email: 'admin@test.dev',
  name: 'Test Admin',
  password: 'Correct-Horse-9',
} as const;

/** Provisions the test admin and returns a cookie-carrying agent that is signed in. */
export async function signIn(app: Express, services: Services) {
  const user = await services.users.provisionAccount(TEST_ADMIN);
  const agent = request.agent(app);
  await agent
    .post('/api/v1/auth/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password })
    .expect(200);
  return { agent, user };
}

/** Parses Set-Cookie headers into { name: { value, attributes } }. */
export function parseSetCookies(header: string[] | string | undefined) {
  const list = Array.isArray(header) ? header : header ? [header] : [];
  return Object.fromEntries(
    list.map((cookie) => {
      const [pair = '', ...attributes] = cookie.split(';').map((part) => part.trim());
      const [name = '', ...value] = pair.split('=');
      return [name, { value: value.join('='), attributes: attributes.map((a) => a.toLowerCase()) }];
    }),
  );
}
