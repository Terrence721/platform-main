import {
  DEFAULT_PAGE_SIZE,
  FIRST_PAGE,
  MAX_PAGE_SIZE,
  normalizePageRequest,
  Page,
  pageCount,
  PageRequest,
} from './page';

describe('paging defaults', () => {
  it('numbers pages from 1, 25 to a page, at most 100', () => {
    expect([FIRST_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE]).toEqual([
      1, 25, 100,
    ]);
  });
});

describe('normalizePageRequest', () => {
  it('uses the defaults when nothing is asked for', () => {
    expect(normalizePageRequest()).toEqual({ page: 1, pageSize: 25 });
    expect(normalizePageRequest({})).toEqual({ page: 1, pageSize: 25 });
  });

  it('keeps a valid request', () => {
    expect(normalizePageRequest({ page: 3, pageSize: 50 })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it.each([0, -1, 0.5, NaN, Infinity, -Infinity])(
    'turns the page %s into the first page',
    (page) => {
      expect(normalizePageRequest({ page }).page).toBe(1);
    }
  );

  it.each([0, -5, 0.5, NaN, Infinity])(
    'turns the page size %s into the default',
    (pageSize) => {
      expect(normalizePageRequest({ pageSize }).pageSize).toBe(25);
    }
  );

  it.each([
    [100, 100],
    [101, 100],
    [150, 100],
  ])('limits the page size %s to %s', (pageSize, expected) => {
    expect(normalizePageRequest({ pageSize }).pageSize).toBe(expected);
  });

  it('rounds fractions down', () => {
    expect(normalizePageRequest({ page: 2.7, pageSize: 10.9 })).toEqual({
      page: 2,
      pageSize: 10,
    });
  });

  it('returns no optional parts', () => {
    expectTypeOf(normalizePageRequest()).toEqualTypeOf<{
      page: number;
      pageSize: number;
    }>();
    expectTypeOf<PageRequest>().toEqualTypeOf<{
      page?: number;
      pageSize?: number;
    }>();
  });
});

describe('pageCount', () => {
  it.each([
    [0, 25, 0],
    [1, 25, 1],
    [25, 25, 1],
    [26, 25, 2],
    [101, 25, 5],
  ])('%s items at %s a page make %s pages', (total, pageSize, expected) => {
    expect(pageCount({ total, pageSize })).toBe(expected);
  });

  it('accepts a whole page of any item type', () => {
    const page: Page<{ id: string }> = {
      items: [{ id: 'a' }],
      total: 1,
      page: 1,
      pageSize: 25,
    };
    expectTypeOf(page.items).toEqualTypeOf<{ id: string }[]>();
    expect(pageCount(page)).toBe(1);
  });
});
