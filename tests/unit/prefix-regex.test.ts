import { describe, expect, it } from 'vitest';

import { prefixRegex } from '../../src/infrastructure/database/mongoose/utils.js';

/** Search must use an anchored prefix (index-friendly) and never trust user input as regex. */
describe('prefixRegex', () => {
  it('is anchored and lower-cased, so it can use the nameLower index', () => {
    const pattern = prefixRegex('Ayesha');

    expect(pattern.source).toBe('^ayesha');
    expect(pattern.test('ayesha rahman')).toBe(true);
    expect(pattern.test('dr ayesha')).toBe(false);
  });

  it('escapes regex syntax in user input', () => {
    const pattern = prefixRegex('a.*(b');

    expect(pattern.test('a.*(b smith')).toBe(true);
    expect(pattern.test('axxxb')).toBe(false);
  });
});
