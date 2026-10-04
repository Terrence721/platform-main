import { HttpErrorResponse } from '@angular/common/http';

/** The refusals the API explains in its own words. */
const EXPLAINED = [400, 403, 404, 409];

/**
 * The API's own message for a refusal it explains (400, 403, 404, 409), or
 * `fallback` when it cannot (the API down, say).
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof HttpErrorResponse &&
    EXPLAINED.includes(error.status) &&
    typeof error.error?.message === 'string'
  ) {
    return error.error.message;
  }
  return fallback;
}
