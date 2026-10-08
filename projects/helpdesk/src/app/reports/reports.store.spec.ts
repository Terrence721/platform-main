import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type {
  ReportChoices,
  ReportsResponse,
  TeamReport,
} from '@helpdesk/contract';
import {
  INITIAL_REPORT_PICK,
  openTickets,
  type ReportPick,
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
  agents: [],
  choices: { teams: [], agents: [] },
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

  it('says a refresh failed, until the next load', () => {
    const store = TestBed.inject(ReportsStore);
    request().flush(REPORT);
    expect(store.refreshFailed()).toBe(false);

    store.load();
    request().flush(null, failure);
    expect(store.refreshFailed()).toBe(true);

    store.load();
    expect(store.refreshFailed()).toBe(false);
    request().flush(REPORT);
    expect(store.refreshFailed()).toBe(false);
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

/** What an admin may pick. */
const CHOICES: ReportChoices = {
  teams: [{ teamId: 'atlas', name: 'Team Atlas', leadName: 'Chris Taylor' }],
  agents: [{ agentId: 'sam.rivera', name: 'Sam Rivera', teamId: 'atlas' }],
};

/** Sam's own report: no team rows, his one row. */
const SAM_REPORT: ReportsResponse = {
  ...REPORT,
  scope: { agentId: 'sam.rivera' },
  openByStatus: { new: 1, open: 1, pending: 0 },
  teams: [],
  agents: [
    {
      ...row('Sam Rivera', {
        openByPriority: { low: 1, normal: 0, high: 0, urgent: 1 },
        overdue: 1,
        finished: 3,
        finishedWithDueTime: 3,
        finishedOnTime: 2,
      }),
      agentId: 'sam.rivera',
      teamId: 'atlas',
    },
  ],
  choices: CHOICES,
};

describe('ReportsStore: who the report is for', () => {
  let http: HttpTestingController;

  /** A store, opening on `initial` when given one. */
  function create(initial?: ReportPick) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReportsStore,
        ...(initial
          ? [{ provide: INITIAL_REPORT_PICK, useValue: initial }]
          : []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(ReportsStore);
  }

  afterEach(() => http.verify());

  /** The one request for the figures, with its team or agent. */
  const request = () =>
    http.expectOne(
      ({ method, url }) => method === 'GET' && url === REPORTS_API
    );
  const picked = (call: ReturnType<typeof request>) => ({
    team: call.request.params.get('team'),
    agent: call.request.params.get('agent'),
  });

  it("asks for the caller's own default when nothing is picked", () => {
    create();

    expect(picked(request())).toEqual({ team: null, agent: null });
  });

  it('opens on the pick it is given', () => {
    const store = create({ kind: 'agent', agentId: 'sam.rivera' });

    const call = request();
    expect(picked(call)).toEqual({ team: null, agent: 'sam.rivera' });
    call.flush(SAM_REPORT);
    expect(store.report()).toEqual(SAM_REPORT);
  });

  it('switches to a team: the figures go, the choices stay', () => {
    const store = create();
    request().flush({ ...REPORT, scope: 'all', choices: CHOICES });

    store.select({ kind: 'team', teamId: 'atlas' });

    expect(store.loadState()).toBe('loading');
    expect(store.report()).toBeNull();
    expect(store.choices()).toEqual(CHOICES);
    const call = request();
    expect(picked(call)).toEqual({ team: 'atlas', agent: null });
    call.flush(REPORT);
    expect(store.report()).toEqual(REPORT);
  });

  it("refreshes the picked report, not the caller's default", () => {
    const store = create({ kind: 'agent', agentId: 'sam.rivera' });
    request().flush(SAM_REPORT);

    store.load();

    expect(store.refreshing()).toBe(true);
    const call = request();
    expect(picked(call).agent).toBe('sam.rivera');
    call.flush(SAM_REPORT);
  });

  it("sums an agent's report from their own row", () => {
    const store = create({ kind: 'agent', agentId: 'sam.rivera' });

    request().flush(SAM_REPORT);

    expect(store.summary()).toEqual({
      open: 2,
      overdue: 1,
      finished: 3,
      slaMetPercent: 66,
    });
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
    [2, 3, 66],
    [0, 4, 0],
    [5, 5, 100],
  ])('%i on time of %i is %i percent', (onTime, withDueTime, percent) => {
    expect(slaMetPercent(onTime, withDueTime)).toBe(percent);
  });

  // Rounded down: 100% only when every one was on time.
  it.each([
    [995, 1000, 99],
    [199, 200, 99],
  ])(
    '%i on time of %i is %i percent, not 100',
    (onTime, withDueTime, percent) => {
      expect(slaMetPercent(onTime, withDueTime)).toBe(percent);
    }
  );

  it('is none when nothing with a due time was finished', () => {
    expect(slaMetPercent(0, 0)).toBeNull();
  });
});
