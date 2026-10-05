import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ReportsResponse, TeamReport } from '@helpdesk/contract';
import {
  openTickets,
  REPORTS_API,
  ReportsStore,
  slaMetPercent,
} from './reports.store';

/** A row with these figures; everything else zero. */
const row = (name: string, figures: Partial<TeamReport> = {}): TeamReport => ({
  teamId: name.toLowerCase(),
  name,
  openByPriority: { low: 0, normal: 0, high: 0, urgent: 0 },
  overdue: 0,
  finished: 0,
  finishedWithDueTime: 0,
  finishedOnTime: 0,
  medianHoursToResolve: null,
  medianHoursToFirstReply: null,
  ...figures,
});

/** Atlas and Unassigned, as the API answers a supervisor. */
const REPORT: ReportsResponse = {
  asOf: '2026-10-05T12:00:00.000Z',
  since: '2026-09-05T12:00:00.000Z',
  scope: { teamId: 'atlas' },
  openByStatus: { new: 3, open: 2, pending: 1 },
  teams: [
    row('Atlas', {
      openByPriority: { low: 1, normal: 0, high: 1, urgent: 1 },
      overdue: 1,
      finished: 3,
      finishedWithDueTime: 2,
      finishedOnTime: 1,
    }),
    {
      ...row('Unassigned', {
        openByPriority: { low: 0, normal: 2, high: 0, urgent: 1 },
        overdue: 1,
        finished: 1,
        finishedWithDueTime: 2,
        finishedOnTime: 2,
      }),
      teamId: null,
    },
  ],
};

describe('ReportsStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReportsStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const request = () => http.expectOne({ method: 'GET', url: REPORTS_API });
  const failure = { status: 500, statusText: 'Server Error' };

  it('starts loading the figures as soon as it is created', () => {
    const store = TestBed.inject(ReportsStore);

    expect(store.loadState()).toBe('loading');
    expect(store.report()).toBeNull();
    request().flush(REPORT);

    expect(store.loadState()).toBe('loaded');
    expect(store.report()).toEqual(REPORT);
  });

  it('says loading failed when the first load does', () => {
    const store = TestBed.inject(ReportsStore);

    request().flush(null, failure);

    expect(store.loadState()).toBe('failed');
    expect(store.report()).toBeNull();
  });

  it('tries again after a failure, showing it is loading', () => {
    const store = TestBed.inject(ReportsStore);
    request().flush(null, failure);

    store.load();

    expect(store.loadState()).toBe('loading');
    expect(store.refreshing()).toBe(false);
    request().flush(REPORT);
    expect(store.loadState()).toBe('loaded');
  });

  it('refreshes with the figures still shown, then shows the new ones', () => {
    const store = TestBed.inject(ReportsStore);
    request().flush(REPORT);

    store.load();

    expect(store.loadState()).toBe('loaded');
    expect(store.refreshing()).toBe(true);
    expect(store.report()).toEqual(REPORT);
    const newer = { ...REPORT, asOf: '2026-10-05T12:05:00.000Z' };
    request().flush(newer);
    expect(store.refreshing()).toBe(false);
    expect(store.report()).toEqual(newer);
  });

  it('keeps the figures shown when a refresh fails', () => {
    const store = TestBed.inject(ReportsStore);
    request().flush(REPORT);

    store.load();
    request().flush(null, failure);

    expect(store.loadState()).toBe('loaded');
    expect(store.refreshing()).toBe(false);
    expect(store.report()).toEqual(REPORT);
  });

  it('lets a newer load replace one still running', () => {
    const store = TestBed.inject(ReportsStore);
    const first = request();

    store.load();
    const second = request();

    expect(first.cancelled).toBe(true);
    second.flush(REPORT);
    expect(store.report()).toEqual(REPORT);
  });

  it('adds up the summary across every row', () => {
    const store = TestBed.inject(ReportsStore);
    request().flush(REPORT);

    expect(store.summary()).toEqual({
      open: 6,
      overdue: 2,
      finished: 4,
      // 3 of 4 finished with a due time were on time.
      slaMetPercent: 75,
    });
  });

  it('has an empty summary before the figures come', () => {
    const store = TestBed.inject(ReportsStore);

    expect(store.summary()).toEqual({
      open: 0,
      overdue: 0,
      finished: 0,
      slaMetPercent: null,
    });
    request().flush(REPORT);
  });
});

describe('openTickets', () => {
  it('counts open work of every priority', () => {
    expect(
      openTickets(
        row('Atlas', {
          openByPriority: { low: 1, normal: 2, high: 3, urgent: 4 },
        })
      )
    ).toBe(10);
  });
});

describe('slaMetPercent', () => {
  it.each([
    [1, 2, 50],
    [2, 3, 67],
    [0, 4, 0],
    [5, 5, 100],
  ])('%i on time of %i is %i%%', (onTime, withDueTime, percent) => {
    expect(slaMetPercent(onTime, withDueTime)).toBe(percent);
  });

  it('is none when nothing with a due time was finished', () => {
    expect(slaMetPercent(0, 0)).toBeNull();
  });
});
