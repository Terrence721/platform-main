import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { landingFeature } from './landing.feature';
import { showcaseTickets } from './showcase-tickets';
import { PreviewRow, TicketPreviewStore } from './ticket-preview.store';

const now = new Date('2026-10-02T12:00:00.000Z');

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
