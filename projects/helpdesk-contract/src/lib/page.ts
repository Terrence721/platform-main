/** Pages are numbered from 1. */
export const FIRST_PAGE = 1;

/** The page size when a request does not ask for one. */
export const DEFAULT_PAGE_SIZE = 25;

/** The largest page a request may ask for. */
export const MAX_PAGE_SIZE = 100;

/** Which page of a list to return; both parts are optional. */
export interface PageRequest {
  page?: number;
  pageSize?: number;
}

/** One page of a list, with what the app needs for its paginator. */
export interface Page<T> {
  items: T[];
  /** How many items the whole list has, across all pages. */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Turns an optional, untrusted page request into a valid one: a missing or
 * invalid page is the first page, a missing or invalid size the default, and
 * a size above the maximum is cut to the maximum. Fractions are rounded down.
 */
export function normalizePageRequest(
  request: PageRequest = {}
): Required<PageRequest> {
  const page = Math.floor(request.page ?? FIRST_PAGE);
  const pageSize = Math.floor(request.pageSize ?? DEFAULT_PAGE_SIZE);
  return {
    page: Number.isFinite(page) && page >= FIRST_PAGE ? page : FIRST_PAGE,
    pageSize:
      Number.isFinite(pageSize) && pageSize >= 1
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
  };
}

/** How many pages a list has; an empty list has none. */
export function pageCount(
  page: Pick<Page<unknown>, 'total' | 'pageSize'>
): number {
  return Math.ceil(page.total / page.pageSize);
}
