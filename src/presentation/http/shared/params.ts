import { z } from 'zod';

/** Id format is a persistence detail; the repository treats malformed ids as "not found". */
export const idParams = z.object({ id: z.string().trim().min(1).max(64) });
