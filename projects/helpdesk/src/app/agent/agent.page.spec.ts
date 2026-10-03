import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CurrentUser, TicketDto } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { initialSessionState } from '../session/session.feature';
import AgentPage from './agent.page';
import { MY_TICKETS_API } from './my-tickets.store';

const NOW = new Date('2026-10-03T12:00:00.000Z');

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};

/** One of Sam's tickets, due at `slaDueAt`. */
const ticket = (
  ticketNumber: number,
  subject: string,
  slaDueAt: string | null,
  changes: Partial<TicketDto> = {}
): TicketDto => ({
  id: `ticket-${ticketNumber}`,
  ticketNumber,
  subject,
  description: '',
  status: 'open',
  priority: 'normal',
  requester: {
    id: 'customer-1',
    name: 'Dana Whitfield',
    email: 'dana.whitfield@example.com',
  },
  assignee: { id: sam.id, name: sam.name },
  queue: { id: 'accounts', name: 'Accounts' },
  tags: [],
  slaDueAt,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
  ...changes,
});

describe('AgentPage', () => {
  beforeEach(() => {
    // Only Date: the page's "time left" is measured from NOW.
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: sam, checked: true },
          },
        }),
      ],
    });
    const fixture = TestBed.createComponent(AgentPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    return {
      page,
      text: (selector: string) =>
        page.querySelector(selector)?.textContent?.trim(),
      /** Answers the page's request for tickets, then renders. */
      answer: (body: TicketDto[] | null, status = 200) => {
        http
          .expectOne(MY_TICKETS_API)
          .flush(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
        fixture.detectChanges();
      },
      /** Each row's cells, as text. */
      rows: () =>
        [...page.querySelectorAll('tr.mat-mdc-row')].map((row) =>
          [...row.querySelectorAll('td')].map((cell) =>
            cell.textContent?.trim()
          )
        ),
      http,
      detectChanges: () => fixture.detectChanges(),
    };
  }

  it('is headed My tickets, and greets the signed-in agent', () => {
    const { text, answer } = render();
    answer([]);

    expect(text('.eyebrow')).toBe('Agent');
    expect(text('h1')).toBe('My tickets');
    expect(text('.greeting')).toBe('Signed in as Sam Rivera');
  });

  it('shows a spinner while the tickets load', () => {
    const { page, answer } = render();

    expect(page.querySelector('mat-spinner')?.getAttribute('aria-label')).toBe(
      'Loading your tickets'
    );

    answer([]);
    expect(page.querySelector('mat-spinner')).toBeNull();
  });

  it('lists the tickets in the order the API sends them', () => {
    const { answer, rows, page } = render();

    answer([
      ticket(1003, 'Overdue', '2026-10-03T10:00:00.000Z', {
        priority: 'urgent',
      }),
      ticket(1006, 'Due soon', '2026-10-03T15:00:00.000Z', {
        status: 'pending',
      }),
      ticket(1001, 'No SLA', null),
    ]);

    expect(
      [...page.querySelectorAll('th')].map((cell) => cell.textContent?.trim())
    ).toEqual(['#', 'Subject', 'Customer', 'Priority', 'Status', 'Due']);
    expect(rows()).toEqual([
      ['#1003', 'Overdue', 'Dana Whitfield', 'urgent', 'Open', 'Overdue 2h'],
      ['#1006', 'Due soon', 'Dana Whitfield', 'normal', 'Pending', 'Due in 3h'],
      ['#1001', 'No SLA', 'Dana Whitfield', 'normal', 'Open', 'No SLA'],
    ]);
  });

  it('marks an overdue ticket', () => {
    const { answer, page } = render();

    answer([
      ticket(1003, 'Overdue', '2026-10-03T10:00:00.000Z'),
      ticket(1006, 'Due later', '2026-10-04T12:00:00.000Z'),
    ]);

    const dueCells = page.querySelectorAll('td.mat-column-due');
    expect(dueCells[0].classList).toContain('overdue');
    expect(dueCells[1].classList).not.toContain('overdue');
  });

  it('says when nothing is assigned', () => {
    const { answer, text, page } = render();

    answer([]);

    expect(text('.message')).toBe('Nothing is assigned to you right now.');
    expect(page.querySelector('table')).toBeNull();
  });

  it('says when the tickets could not be loaded, and tries again', () => {
    const { answer, page, http, detectChanges } = render();

    answer(null, 500);

    const message = page.querySelector('.message');
    expect(message?.getAttribute('role')).toBe('alert');
    expect(message?.textContent).toContain("Your tickets couldn't be loaded.");

    message?.querySelector('button')?.click();
    detectChanges();
    expect(page.querySelector('mat-spinner')).not.toBeNull();
    http.expectOne(MY_TICKETS_API).flush([]);
  });
});
