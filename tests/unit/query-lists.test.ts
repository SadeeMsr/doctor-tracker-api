import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { csvList, repeatedList } from '../../src/presentation/http/shared/query-lists.js';

/** How multi-value filters are read from a query string (`?x=a,b` or `?x=a&x=b`). */
describe('query list parsers', () => {
  const conditions = csvList(z.enum(['critical', 'stable', 'recovering']));
  const hospitals = repeatedList(z.string());

  it('accepts a comma list and repeated keys alike', () => {
    expect(conditions.parse('critical,stable')).toEqual(['critical', 'stable']);
    expect(conditions.parse(['critical', 'stable'])).toEqual(['critical', 'stable']);
  });

  it('treats an empty or missing value as "no filter"', () => {
    expect(conditions.parse(undefined)).toBeUndefined();
    expect(conditions.parse('')).toBeUndefined();
    expect(conditions.parse(' , ')).toBeUndefined();
  });

  it('keeps commas inside free-text values that use repeated keys', () => {
    expect(hospitals.parse(['Square Hospital, Dhaka', 'United Hospital'])).toEqual([
      'Square Hospital, Dhaka',
      'United Hospital',
    ]);
  });

  it('rejects unknown values and oversized lists', () => {
    expect(conditions.safeParse('critical,unknown').success).toBe(false);
    expect(hospitals.safeParse(Array.from({ length: 21 }, (_, i) => `H${String(i)}`)).success).toBe(
      false,
    );
  });
});
