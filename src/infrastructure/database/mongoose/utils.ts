import { isValidObjectId } from 'mongoose';

/** Escape user input before embedding it in a RegExp (prevents ReDoS / regex injection). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Anchored, case-insensitive prefix match against a pre-lowercased field. Index-friendly. */
export function prefixRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value.toLowerCase())}`);
}

export function isDuplicateKeyError(
  error: unknown,
): error is { code: 11000; keyValue?: Record<string, unknown> } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export function isObjectId(id: string): boolean {
  return isValidObjectId(id);
}
