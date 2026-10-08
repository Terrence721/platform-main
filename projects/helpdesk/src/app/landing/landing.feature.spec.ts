import type { TicketDto } from '@helpdesk/contract';
import { LandingApiActions } from './landing.actions';
import {
  compareBySlaDue,
  initialLandingState,
  landingFeature,
  type LandingState,
} from './landing.feature';

function ticket(overrides: Partial<TicketDto>): TicketDto {
  return {
    id: `t${overrides.ticketNumber ?? 1}`,
    ticketNumber: 1,
    subject: 'Subject',
    description: 'Description',
    status: 'open',
    priority: 'normal',
    requester: { id: 'c1', name: 'Ada Lovelace', email: 'ada@example.com' },
    assignee: null,
    queue: { id: 'q1', name: 'Accounts' },
    tags: [],
    slaDueAt: null,
    createdAt: '2026-10-02T09:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
    ...overrides,
  };
}

const { reducer } = landingFeature;

function loaded(tickets: TicketDto[]): LandingState {
  return reducer(
    initialLandingState,
    LandingApiActions.showcaseTicketsLoaded({ tickets })
  );
}

const numbers = (tickets: TicketDto[]) =>
  tickets.map(({ ticketNumber }) => ticketNumber);

describe('compareBySlaDue', () => {
  const soon = ticket({
    ticketNumber: 2,
    slaDueAt: '2026-10-02T10:00:00.000Z',
  });
  const later = ticket({
    ticketNumber: 1,
    slaDueAt: '2026-10-03T10:00:00.000Z',
  });
  const none = ticket({ ticketNumber: 3, slaDueAt: null });

  it('puts the earlier due time first', () => {
    expect(compareBySlaDue(soon, later)).toBeLessThan(0);
    expect(compareBySlaDue(later, soon)).toBeGreaterThan(0);
  });

  it('puts tickets without an SLA last', () => {
    expect(compareBySlaDue(none, later)).toBeGreaterThan(0);
    expect(compareBySlaDue(later, none)).toBeLessThan(0);
  });

  it('breaks ties by ticket number', () => {
    const sameDue = ticket({ ticketNumber: 9, slaDueAt: soon.slaDueAt });
    const otherNone = ticket({ ticketNumber: 1, slaDueAt: null });

    expect(compareBySlaDue(soon, sameDue)).toBeLessThan(0);
    expect(compareBySlaDue(otherNone, none)).toBeLessThan(0);
  });
});

describe('landing reducer', () => {
  // The preview shows every showcase ticket: there is no status filter.
  it('starts empty and loading, holding only the tickets and their load', () => {
    expect(initialLandingState).toEqual({
      ids: [],
      entities: {},
      loadState: 'loading',
    });
  });

  it('stores loaded tickets in SLA order', () => {
    const state = loaded([
      ticket({ ticketNumber: 1, slaDueAt: null }),
      ticket({ ticketNumber: 2, slaDueAt: '2026-10-03T10:00:00.000Z' }),
      ticket({ ticketNumber: 3, slaDueAt: '2026-10-02T10:00:00.000Z' }),
    ]);

    expect(state.ids).toEqual(['t3', 't2', 't1']);
    expect(state.loadState).toBe('loaded');
  });

  it('replaces the tickets when they load again', () => {
    const state = reducer(
      loaded([ticket({ ticketNumber: 1 })]),
      LandingApiActions.showcaseTicketsLoaded({
        tickets: [ticket({ ticketNumber: 2 })],
      })
    );

    expect(state.ids).toEqual(['t2']);
  });

  it('marks a failed load and keeps the tickets it had', () => {
    const state = reducer(
      loaded([ticket({ ticketNumber: 1 })]),
      LandingApiActions.showcaseTicketsLoadFailed({ error: 'Offline' })
    );

    expect(state.loadState).toBe('failed');
    expect(state.ids).toEqual(['t1']);
  });
});

describe('landing selectors', () => {
  it('lists every ticket in SLA order', () => {
    const landing = loaded([
      ticket({ ticketNumber: 1, status: 'open', slaDueAt: null }),
      ticket({
        ticketNumber: 2,
        status: 'pending',
        slaDueAt: '2026-10-03T10:00:00.000Z',
      }),
      ticket({
        ticketNumber: 3,
        status: 'open',
        slaDueAt: '2026-10-02T10:00:00.000Z',
      }),
    ]);

    expect(numbers(landingFeature.selectAllTickets({ landing }))).toEqual([
      3, 2, 1,
    ]);
  });
});
