export type SortOrder = 'asc' | 'desc';

export interface PageRequest {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}
