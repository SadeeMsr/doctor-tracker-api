import { z } from 'zod';

import type { Page } from '../../../domain/shared/pagination.js';

export const MAX_PAGE_SIZE = 100;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
});

/** Optional trimmed string where `?param=` (empty) means "not provided". */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A date-only `to` (`2026-11-10`) means the end of that day, so the whole day is included. */
const inclusiveEndDate = z.preprocess(
  (value) =>
    typeof value === 'string' && DATE_ONLY.test(value) ? `${value}T23:59:59.999Z` : value,
  z.coerce.date().optional(),
);

/** `from`/`to` dates (ISO or `YYYY-MM-DD`) with `from <= to`. */
export const dateRangeQuery = z
  .object({
    from: z.coerce.date().optional(),
    to: inclusiveEndDate,
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: '`from` must be before `to`',
    path: ['from'],
  });

export function toListResponse<T, R>(page: Page<T>, present: (item: T) => R) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.limit));
  return {
    data: page.items.map(present),
    meta: {
      page: page.page,
      limit: page.limit,
      total: page.total,
      totalPages,
      hasNextPage: page.page < totalPages,
      hasPrevPage: page.page > 1,
    },
  };
}
