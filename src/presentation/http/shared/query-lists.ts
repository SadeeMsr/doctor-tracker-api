import { z } from 'zod';

/** Most values a list filter accepts: more than any real dropdown, small enough to keep `$in` cheap. */
const MAX_LIST_VALUES = 20;

function toList(value: unknown, splitOnComma: boolean): string[] | undefined {
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap((part) => {
      if (typeof part !== 'string') return [];
      return splitOnComma ? part.split(',') : [part];
    })
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/**
 * A multi-value filter written `?x=a,b` or `?x=a&x=b`. Only for values that never contain a comma,
 * such as enums.
 */
export function csvList<T extends z.ZodType<string>>(item: T) {
  return z.preprocess(
    (value) => toList(value, true),
    z.array(item).max(MAX_LIST_VALUES).optional(),
  );
}

/**
 * A multi-value filter written `?x=a&x=b` only. For free text such as hospital names, which may
 * contain commas ("Square Hospital, Dhaka").
 */
export function repeatedList<T extends z.ZodType<string>>(item: T) {
  return z.preprocess(
    (value) => toList(value, false),
    z.array(item).max(MAX_LIST_VALUES).optional(),
  );
}
