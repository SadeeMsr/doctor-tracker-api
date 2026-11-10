import { z } from 'zod';

import { INTERVALS } from '../../../application/ports/analytics-query.js';
import { dateRangeQuery } from '../shared/pagination.js';

export const summaryQuery = z
  .object({ interval: z.enum(INTERVALS).default('month') })
  .and(dateRangeQuery);
