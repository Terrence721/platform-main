import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { CurrentUser, TicketDto } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { initialSessionState } from '../session/session.feature';
import { assigneeApi } from '../supervisor/my-team.store';
import AgentPage from './agent.page';
import { MY_TICKETS_API, UNASSIGNED_API } from './my-tickets.store';

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

  /** Stands in for Material's snack bar, to see what it says. */
  const snackBar = { open: vi.fn() };

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    // Tests about My tickets leave the Unassigned load unanswered.
    for (const request of http.match(UNASSIGNED_API)) {
      if (!request.cancelled) {
        request.flush([]);
      }
    }
    http.verify();
    vi.useRealTimers();
  });

  function render() {
    snackBar.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: sam, checked: true },
          },
        }),
        { provide: MatSnackBar, useValue: snackBar },
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
    // Unassigned may still be loading; My tickets' own spinner has gone.
    expect(
      page.querySelector('mat-spinner[aria-label="Loading your tickets"]')
    ).toBeNull();
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

  describe('Unassigned', () => {
    /** A ticket nobody holds. */
    const unassignedTicket = (ticketNumber: number) =>
      ticket(ticketNumber, `Subject ${ticketNumber}`, null, { assignee: null });

    /** Renders with My tickets empty and these unassigned tickets. */
    function renderWithUnassigned(unassigned: TicketDto[]) {
      const view = render();
      view.answer([]);
      view.http.expectOne(UNASSIGNED_API).flush(unassigned);
      view.detectChanges();
      return view;
    }

    /** The Take it buttons, in order. */
    const takeButtons = (page: HTMLElement) => [
      ...page.querySelectorAll<HTMLButtonElement>(
        'hd-ticket-table.unassigned td.mat-column-action button'
      ),
    ];

    it('lists the unassigned tickets with a count, each with Take it', () => {
      const { page } = renderWithUnassigned([
        unassignedTicket(1312),
        unassignedTicket(1290),
      ]);

      expect(
        [...page.querySelectorAll('h2')].map((h) => h.textContent?.trim())
      ).toEqual(['Unassigned (2)']);
      expect(
        takeButtons(page).map((button) => button.getAttribute('aria-label'))
      ).toEqual(['Take it #1312', 'Take it #1290']);
    });

    it('says so when nothing is waiting', () => {
      const { page } = renderWithUnassigned([]);

      expect(
        [...page.querySelectorAll('.message')].map((m) => m.textContent?.trim())
      ).toEqual([
        'Nothing is assigned to you right now.',
        'Nothing is waiting to be picked up.',
      ]);
    });

    it('says when they could not be loaded, and tries again', () => {
      const view = render();
      view.answer([]);
      view.http
        .expectOne(UNASSIGNED_API)
        .flush(null, { status: 500, statusText: 'Error' });
      view.detectChanges();

      const message = [...view.page.querySelectorAll('.message')].find((m) =>
        m.textContent?.includes("The unassigned tickets couldn't be loaded.")
      );
      expect(message?.getAttribute('role')).toBe('alert');
      message?.querySelector('button')?.click();
      view.http.expectOne(UNASSIGNED_API).flush([]);
    });

    it('takes a ticket for the signed-in agent, then says it is theirs', async () => {
      const { page, http } = renderWithUnassigned([unassignedTicket(1312)]);

      takeButtons(page)[0].click();

      const call = http.expectOne({
        method: 'PUT',
        url: assigneeApi('ticket-1312'),
      });
      expect(call.request.body).toEqual({ assigneeId: 'sam.rivera' });
      call.flush(ticket(1312, 'Subject 1312', null));
      http
        .expectOne(MY_TICKETS_API)
        .flush([ticket(1312, 'Subject 1312', null)]);
      http.expectOne(UNASSIGNED_API).flush([]);

      await vi.waitFor(() =>
        expect(snackBar.open).toHaveBeenCalledWith(
          '#1312 is yours',
          undefined,
          expect.objectContaining({ duration: 5000 })
        )
      );
    });

    it('says when someone took it first', async () => {
      const { page, http } = renderWithUnassigned([unassignedTicket(1312)]);

      takeButtons(page)[0].click();
      http
        .expectOne({ method: 'PUT', url: assigneeApi('ticket-1312') })
        .flush(
          { message: 'Someone else has taken this ticket.' },
          { status: 409, statusText: 'Conflict' }
        );

      await vi.waitFor(() =>
        expect(snackBar.open).toHaveBeenCalledWith(
          'Someone else has taken this ticket.',
          undefined,
          expect.objectContaining({ duration: 5000 })
        )
      );
    });
  });
});
