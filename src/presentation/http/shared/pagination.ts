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

/** `from`/`to` ISO dates with `from <= to`. */
export const dateRangeQuery = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
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
