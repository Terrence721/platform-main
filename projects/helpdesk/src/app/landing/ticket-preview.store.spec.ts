import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { landingFeature } from './landing.feature';
import { showcaseTickets } from './showcase-tickets';
import {
  PreviewRow,
  slaLabel,
  TicketPreviewStore,
} from './ticket-preview.store';

const now = new Date('2026-10-02T12:00:00.000Z');
const at = (minutes: number) =>
  new Date(now.getTime() + minutes * 60_000).toISOString();

describe('slaLabel', () => {
  it.each([
    [null, 'No SLA', 'none'],
    [at(-25), 'Overdue 25m', 'overdue'],
    [at(-2 * 24 * 60), 'Overdue 2d', 'overdue'],
    [at(0), 'Due in 0m', 'soon'],
    [at(2 * 60 + 15), 'Due in 2h 15m', 'soon'],
    [at(4 * 60), 'Due in 4h', 'soon'],
    [at(4 * 60 + 1), 'Due in 4h 1m', 'ok'],
    [at(28 * 60), 'Due in 1d 4h', 'ok'],
    [at(3 * 24 * 60), 'Due in 3d', 'ok'],
  ] as const)('labels %s as "%s" (%s)', (dueAt, text, tone) => {
    expect(slaLabel(dueAt, now)).toEqual({ text, tone });
  });
});

describe('TicketPreviewStore', () => {
  const tickets = showcaseTickets(now);

  afterEach(() => {
    vi.useRealTimers();
  });

  function setUp() {
    vi.useFakeTimers({ now });
    TestBed.configureTestingModule({
      providers: [provideMockStore(), TicketPreviewStore],
    });
    TestBed.inject(MockStore).overrideSelector(
      landingFeature.selectAllTickets,
      tickets
    );
    const store = TestBed.inject(TicketPreviewStore);
    let rows: PreviewRow[] = [];
    store.rows$.subscribe((latest) => (rows = latest));
    return { store, rows: () => rows };
  }

  const labels = (rows: PreviewRow[]) => rows.map(({ sla }) => sla.text);

  it('gives each ticket its SLA label at the current time', () => {
    const { rows } = setUp();

    expect(rows().map(({ ticket }) => ticket.ticketNumber)).toEqual([
      1042, 1039, 1035, 1031,
    ]);
    expect(labels(rows())).toEqual([
      'Overdue 25m',
      'Due in 2h',
      'Due in 1d 4h',
      'Due in 3d',
    ]);
  });

  it('keeps the labels current once a minute', () => {
    const { rows } = setUp();

    vi.advanceTimersByTime(60_000);
    expect(labels(rows())[0]).toBe('Overdue 26m');

    vi.advanceTimersByTime(59 * 60_000);
    expect(labels(rows())).toEqual([
      'Overdue 1h 25m',
      'Due in 1h',
      'Due in 1d 3h',
      'Due in 2d 23h',
    ]);
  });

  it('opens a row, closes it again, and switches to another', () => {
    const { store, rows } = setUp();
    const expanded = () =>
      rows()
        .filter((row) => row.expanded)
        .map(({ ticket }) => ticket.ticketNumber);

    expect(expanded()).toEqual([]);

    store.toggleExpanded('showcase-1039');
    expect(expanded()).toEqual([1039]);

    store.toggleExpanded('showcase-1039');
    expect(expanded()).toEqual([]);

    store.toggleExpanded('showcase-1042');
    store.toggleExpanded('showcase-1035');
    expect(expanded()).toEqual([1035]);
  });

  it('stops the clock when it is destroyed', () => {
    const { store } = setUp();
    expect(vi.getTimerCount()).toBe(1);

    store.ngOnDestroy();

    expect(vi.getTimerCount()).toBe(0);
  });
});
