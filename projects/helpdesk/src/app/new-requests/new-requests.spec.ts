import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import type {
  PendingRequest,
  QueueSummary,
  TicketDto,
} from '@helpdesk/contract';
import { NEVER, of } from 'rxjs';
import { LiveUpdates } from '../live/live-updates';
import { Sounds } from '../sound/sounds';
import { DismissRequestDialog } from './dismiss-request.dialog';
import { NewRequests, timeAgo } from './new-requests';
import {
  NEW_REQUESTS_API,
  NewRequestsStore,
  QUEUES_API,
} from './new-requests.store';
import { TurnIntoTicketDialog } from './turn-into-ticket.dialog';

const QUEUES: QueueSummary[] = [{ id: 'billing', name: 'Billing' }];

/** Grace, twice: her first request, and again two hours ago. */
const first = {
  id: 'request-1',
  reference: 'R-1001',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  category: 'billing',
  impact: 'blocked',
  subject: 'Charged twice?',
  description: 'Two charges for October.',
  where: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  suggestedQueueId: 'billing',
  possibleDuplicates: { openTickets: [], earlierRequests: [] },
} as PendingRequest;
const again = {
  ...first,
  id: 'request-2',
  reference: 'R-1002',
  impact: 'slowed',
  subject: 'Charged twice again?',
  description: 'I see two charges for October on my statement.',
  where: 'Invoice INV-2026-10',
  createdAt: '2026-10-09T10:00:00.000Z',
  possibleDuplicates: {
    openTickets: [
      { ticketNumber: 1002, subject: 'Refund for a double charge' },
    ] as TicketDto[],
    earlierRequests: [
      { reference: 'R-1001' },
    ] as PendingRequest['possibleDuplicates']['earlierRequests'],
  },
} as PendingRequest;

const NOW = new Date('2026-10-09T12:00:00.000Z');

describe('timeAgo', () => {
  it.each([
    ['2026-10-09T11:59:40.000Z', 'just now'],
    ['2026-10-09T11:59:00.000Z', '1 minute ago'],
    ['2026-10-09T11:15:00.000Z', '45 minutes ago'],
    ['2026-10-09T11:00:00.000Z', '1 hour ago'],
    ['2026-10-09T09:00:00.000Z', '3 hours ago'],
    ['2026-10-08T12:00:00.000Z', '1 day ago'],
    ['2026-10-06T12:00:00.000Z', '3 days ago'],
  ])('says %s as %j', (at, words) => {
    expect(timeAgo(at, NOW)).toBe(words);
  });
});

// Supervisors' New requests (#1026): the pending requests as cards, oldest
// first, each decided from its own buttons.
describe('NewRequests', () => {
  /** What a popup closes with: the new ticket, true, or nothing. */
  let closedWith: unknown;
  let openIds: string[];
  const dialog = {
    open: vi.fn((_: unknown, config?: MatDialogConfig) => {
      if (config?.id) {
        openIds.push(config.id);
      }
      return { afterClosed: () => of(closedWith) };
    }),
    getDialogById: (id: string) => (openIds.includes(id) ? {} : undefined),
  };
  const snackBar = { open: vi.fn() };

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  function render() {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    closedWith = undefined;
    openIds = [];
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The supervisor page provides it.
        NewRequestsStore,
        { provide: LiveUpdates, useValue: { updates: NEVER } },
        { provide: Sounds, useValue: { play: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    const fixture = TestBed.createComponent(NewRequests);
    fixture.detectChanges();
    const section = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    return {
      section,
      fixture,
      text: (element: Element | null | undefined) =>
        element?.textContent?.replace(/\s+/g, ' ').trim(),
      answer: (requests: PendingRequest[] | null, status = 200) => {
        const queues = http.expectOne(QUEUES_API);
        http.expectOne(NEW_REQUESTS_API).flush(requests, {
          status,
          statusText: status === 200 ? 'OK' : 'Error',
        });
        if (status === 200) {
          queues.flush(QUEUES);
        }
        fixture.detectChanges();
      },
      cards: () => [...section.querySelectorAll('.request')],
      button: (card: Element, label: string) =>
        [...card.querySelectorAll<HTMLButtonElement>('button')].find(
          (candidate) => candidate.textContent?.trim() === label
        ),
    };
  }

  /** Lets a popup still on its way finish opening, if it is going to. */
  const settle = () => vi.waitFor(() => expect(dialog.open).toHaveBeenCalled());

  it('is headed New requests, with how many wait, one card each, oldest first', () => {
    const { section, answer, cards, text } = render();
    answer([first, again]);

    expect(text(section.querySelector('h2'))).toBe('New requests · 2');
    expect(cards().map((card) => text(card.querySelector('h3')))).toEqual([
      'Charged twice?',
      'Charged twice again?',
    ]);
  });

  it('shows what each request is, who sent it, and what it says', () => {
    const { answer, cards, text } = render();
    answer([first, again]);
    const card = cards()[1];

    expect(text(card.querySelector('.meta'))).toBe(
      "R-1002 · 2 hours ago · Billing · It's slowing me down"
    );
    expect(text(card.querySelector('.from'))).toBe(
      'Grace Hopper <grace@example.com> · Invoice INV-2026-10'
    );
    expect(text(card.querySelector('.description'))).toBe(
      'I see two charges for October on my statement.'
    );
  });

  it('shows possible duplicates only where there are some', () => {
    const { answer, cards, text } = render();
    answer([first, again]);

    expect(cards()[0].querySelector('.duplicates')).toBeNull();
    expect(text(cards()[1].querySelector('.duplicates'))).toBe(
      'Possible duplicates: open ticket #1002 Refund for a double charge · earlier request R-1001'
    );
  });

  it('says so when no request waits', () => {
    const { section, answer, text } = render();
    answer([]);

    expect(text(section.querySelector('h2'))).toBe('New requests · 0');
    expect(text(section.querySelector('.empty'))).toBe('No new requests.');
  });

  it('says when the requests could not be loaded, and tries again', () => {
    const { section, answer, fixture } = render();
    answer(null, 500);

    const message = section.querySelector('.message');
    expect(message?.getAttribute('role')).toBe('alert');
    message?.querySelector('button')?.click();
    fixture.detectChanges();
    answer([]);
  });

  it('opens Turn into ticket with the request and the queues, then says what it became', async () => {
    const { answer, cards, button } = render();
    answer([first, again]);
    closedWith = { ticketNumber: 1061 };

    button(cards()[1], 'Turn into ticket')?.click();

    await settle();
    expect(dialog.open).toHaveBeenCalledWith(
      TurnIntoTicketDialog,
      expect.objectContaining({
        id: 'ticket-request-2',
        data: { request: again, queues: QUEUES },
      })
    );
    await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalledOnce());
    expect(snackBar.open).toHaveBeenCalledWith(
      'R-1002 is now ticket #1061, in Unassigned.',
      undefined,
      expect.objectContaining({ duration: 5000 })
    );
  });

  it('opens Dismiss with the request, then says it was dismissed', async () => {
    const { answer, cards, button } = render();
    answer([first]);
    closedWith = true;

    button(cards()[0], 'Dismiss')?.click();

    await settle();
    expect(dialog.open).toHaveBeenCalledWith(
      DismissRequestDialog,
      expect.objectContaining({
        id: 'dismiss-request-1',
        data: { request: first },
      })
    );
    await vi.waitFor(() =>
      expect(snackBar.open).toHaveBeenCalledWith(
        'R-1001 dismissed.',
        undefined,
        expect.objectContaining({ duration: 5000 })
      )
    );
  });

  it('says nothing when a popup is cancelled', async () => {
    const { answer, cards, button } = render();
    answer([first]);

    button(cards()[0], 'Dismiss')?.click();

    await settle();
    expect(snackBar.open).not.toHaveBeenCalled();
  });
});
