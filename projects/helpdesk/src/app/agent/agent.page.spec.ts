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
import { assigneeApi, statusApi } from '../tickets/ticket-api-paths';
import AgentPage from './agent.page';
import {
  FINISHED_API,
  MY_TICKETS_API,
  UNASSIGNED_API,
} from './my-tickets.store';

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
    // Tests about one list leave the other lists' loads unanswered.
    for (const url of [UNASSIGNED_API, FINISHED_API]) {
      for (const request of http.match(url)) {
        if (!request.cancelled) {
          request.flush([]);
        }
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
    ).toEqual([
      '#',
      'Subject',
      'Customer',
      'Priority',
      'Status',
      'Due',
      // The status menu's column, named for screen readers only.
      'Change status',
    ]);
    expect(rows()).toEqual([
      [
        '#1003',
        'Overdue',
        'Dana Whitfield',
        'urgent',
        'Open',
        'Overdue 2h',
        'Change status',
      ],
      [
        '#1006',
        'Due soon',
        'Dana Whitfield',
        'normal',
        'Pending',
        'Due in 3h',
        'Change status',
      ],
      [
        '#1001',
        'No SLA',
        'Dana Whitfield',
        'normal',
        'Open',
        'No SLA',
        'Change status',
      ],
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
      ).toEqual(['Unassigned (2)', 'Done (24 h)']);
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

  describe('Done and status changes', () => {
    /** Renders with these tickets in My tickets and these in Done. */
    function renderWithDone(mine: TicketDto[], finished: TicketDto[]) {
      const view = render();
      view.answer(mine);
      view.http.expectOne(UNASSIGNED_API).flush([]);
      view.http.expectOne(FINISHED_API).flush(finished);
      view.detectChanges();
      return view;
    }

    /** Opens the Change status menu on a row of a table, and picks a status. */
    async function choose(
      view: ReturnType<typeof renderWithDone>,
      table: 'mine' | 'done',
      row: number,
      label: string
    ) {
      const menuButtons = view.page.querySelectorAll<HTMLButtonElement>(
        `hd-ticket-table.${table} td.mat-column-statusMenu button`
      );
      menuButtons[row].click();
      view.detectChanges();
      const choice = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '.mat-mdc-menu-panel button[mat-menu-item]'
        ),
      ].find((item) => item.textContent?.trim() === label);
      if (!choice) {
        throw new Error(`No "${label}" in the menu`);
      }
      choice.click();
      view.detectChanges();
    }

    const resolved = ticket(1290, 'Already resolved', null, {
      status: 'resolved',
    });

    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((container) => container.replaceChildren())
    );

    it('lists what the agent finished in the last 24 hours', () => {
      const { page } = renderWithDone([], [resolved]);

      expect(
        [
          ...page.querySelectorAll(
            'hd-ticket-table.done td.mat-column-ticketNumber'
          ),
        ].map((cell) => cell.textContent?.trim())
      ).toEqual(['#1290']);
    });

    it('says so when nothing was finished lately', () => {
      const { page } = renderWithDone([], []);

      expect(
        [...page.querySelectorAll('.message')].map((m) => m.textContent?.trim())
      ).toContain('Nothing finished in the last 24 hours.');
    });

    it('resolves a ticket from its menu, then says so', async () => {
      const view = renderWithDone([ticket(1003, 'Overdue', null)], []);

      await choose(view, 'mine', 0, 'Resolved');

      const call = view.http.expectOne({
        method: 'PUT',
        url: statusApi('ticket-1003'),
      });
      expect(call.request.body).toEqual({ status: 'resolved' });
      const done = {
        ...ticket(1003, 'Overdue', null),
        status: 'resolved' as const,
      };
      call.flush(done);
      view.http.expectOne(MY_TICKETS_API).flush([]);
      view.http.expectOne(FINISHED_API).flush([done]);

      await vi.waitFor(() =>
        expect(snackBar.open).toHaveBeenCalledWith(
          '#1003 is now Resolved',
          undefined,
          expect.objectContaining({ duration: 5000 })
        )
      );
    });

    it('reopens a resolved ticket from Done', async () => {
      const view = renderWithDone([], [resolved]);

      await choose(view, 'done', 0, 'Open');

      const call = view.http.expectOne({
        method: 'PUT',
        url: statusApi('ticket-1290'),
      });
      expect(call.request.body).toEqual({ status: 'open' });
      call.flush({ ...resolved, status: 'open' });
      view.http
        .expectOne(MY_TICKETS_API)
        .flush([{ ...resolved, status: 'open' }]);
      view.http.expectOne(FINISHED_API).flush([]);

      await vi.waitFor(() =>
        expect(snackBar.open).toHaveBeenCalledWith(
          '#1290 is now Open',
          undefined,
          expect.objectContaining({ duration: 5000 })
        )
      );
    });

    it('says why a change was refused', async () => {
      const view = renderWithDone([ticket(1003, 'Overdue', null)], []);

      await choose(view, 'mine', 0, 'Pending');
      view.http
        .expectOne({ method: 'PUT', url: statusApi('ticket-1003') })
        .flush(
          { message: 'No such ticket among yours.' },
          { status: 404, statusText: 'Not Found' }
        );

      await vi.waitFor(() =>
        expect(snackBar.open).toHaveBeenCalledWith(
          'No such ticket among yours.',
          undefined,
          expect.objectContaining({ duration: 5000 })
        )
      );
    });
  });
});
