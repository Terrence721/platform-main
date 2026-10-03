import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { CurrentUser, TeamOverview, TicketDto } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { initialSessionState } from '../session/session.feature';
import { AssignTicketDialog } from './assign-ticket.dialog';
import { MemberHistoryDialog } from './member-history.dialog';
import { assigneeApi, memberTicketsApi, MY_TEAM_API } from './my-team.store';
import SupervisorPage from './supervisor.page';

const chris: CurrentUser = {
  id: 'chris.taylor',
  name: 'Chris Taylor',
  role: 'supervisor',
  teamId: 'atlas',
};

/** A ticket with just what the page's tables show. */
const ticket = (ticketNumber: number): TicketDto => ({
  id: `ticket-${ticketNumber}`,
  ticketNumber,
  subject: `Subject ${ticketNumber}`,
  description: '',
  status: 'open',
  priority: 'normal',
  requester: {
    id: 'customer-1',
    name: 'Dana Whitfield',
    email: 'dana.whitfield@example.com',
  },
  assignee: null,
  queue: { id: 'accounts', name: 'Accounts' },
  tags: [],
  slaDueAt: null,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
});

const atlas: TeamOverview = {
  id: 'atlas',
  name: 'Atlas',
  members: [
    { id: 'benny.lind', name: 'Benny Lind', openTickets: 5, overdueTickets: 3 },
    { id: 'ida.idle', name: 'Ida Idle', openTickets: 0, overdueTickets: 0 },
  ],
  unassigned: [ticket(1009), ticket(1008)],
};

describe('SupervisorPage', () => {
  /** What a popup closes with: the chosen agent, or nothing. */
  let closedWith: string | undefined;
  /** Stand-ins for Material's dialog and snack bar, to see what they do. */
  const dialog = {
    open: vi.fn(() => ({ afterClosed: () => of(closedWith) })),
  };
  const snackBar = { open: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render() {
    closedWith = undefined;
    dialog.open.mockClear();
    snackBar.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: chris, checked: true },
          },
        }),
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    const fixture = TestBed.createComponent(SupervisorPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const texts = (selector: string) =>
      [...page.querySelectorAll(selector)].map((element) =>
        element.textContent?.trim()
      );
    return {
      page,
      http,
      texts,
      text: (selector: string) => texts(selector)[0],
      /** Answers the page's request for the team, then renders. */
      answer: (body: TeamOverview | null, status = 200) => {
        http
          .expectOne(MY_TEAM_API)
          .flush(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
        fixture.detectChanges();
      },
      /** The Team member list, found as a user would, by its label. */
      memberList: async () => {
        const field = await TestbedHarnessEnvironment.loader(
          fixture
        ).getHarness(
          MatFormFieldHarness.with({ floatingLabelText: 'Team member' })
        );
        const list = await field.getControl(MatSelectHarness);
        if (!list) {
          throw new Error('No list in the "Team member" field');
        }
        return list;
      },
      /**
       * The open list's options, as text. They sit in an overlay outside
       * the page, read straight from the document: Material's option
       * harness builds a selector jsdom rejects ("Invalid selector").
       */
      optionTexts: () =>
        [...document.querySelectorAll('mat-option')].map((option) =>
          option.textContent?.trim()
        ),
      /** Opens the Team member list and clicks the option with this text. */
      chooseMember: async (text: string) => {
        const field = await TestbedHarnessEnvironment.loader(
          fixture
        ).getHarness(
          MatFormFieldHarness.with({ floatingLabelText: 'Team member' })
        );
        await (await field.getControl(MatSelectHarness))?.open();
        const option = [
          ...document.querySelectorAll<HTMLElement>('mat-option'),
        ].find((element) => element.textContent?.trim() === text);
        if (!option) {
          throw new Error(`No "${text}" in the Team member list`);
        }
        option.click();
        fixture.detectChanges();
      },
      /** The ticket numbers in the ticket table with this class. */
      ticketsIn: (table: 'unassigned' | 'member') =>
        [
          ...page.querySelectorAll(
            `hd-ticket-table.${table} td.mat-column-ticketNumber`
          ),
        ].map((cell) => cell.textContent?.trim()),
      detectChanges: () => fixture.detectChanges(),
    };
  }

  it('is headed My team, and greets the signed-in supervisor', () => {
    const { text, answer } = render();
    answer(atlas);

    expect(text('.eyebrow')).toBe('Supervisor');
    expect(text('h1')).toBe('My team');
    expect(text('.greeting')).toBe('Signed in as Chris Taylor');
  });

  it('shows a spinner while the team loads', () => {
    const { page, answer } = render();

    expect(page.querySelector('mat-spinner')?.getAttribute('aria-label')).toBe(
      'Loading your team'
    );

    answer(atlas);
    expect(page.querySelector('mat-spinner')).toBeNull();
  });

  describe('Team member list', () => {
    it('names the team, and offers each agent with their open work, an idle one at 0', async () => {
      const { answer, texts, memberList, optionTexts } = render();
      answer(atlas);

      expect(texts('h2')[0]).toBe('Atlas');
      const list = await memberList();
      expect(await list.getValueText()).toBe('Choose a team member');
      await list.open();
      expect(optionTexts()).toEqual([
        'None',
        'Benny Lind (5 open · 3 overdue)',
        'Ida Idle (0 open · 0 overdue)',
      ]);
    });

    it('shows no member tickets until someone is chosen', () => {
      const { answer, page } = render();
      answer(atlas);

      expect(page.querySelector('.member-title')).toBeNull();
      expect(page.querySelector('hd-ticket-table.member')).toBeNull();
    });

    it("loads the chosen member's tickets into a table under their name", async () => {
      const {
        answer,
        chooseMember,
        http,
        page,
        text,
        ticketsIn,
        detectChanges,
      } = render();
      answer(atlas);

      await chooseMember('Benny Lind (5 open · 3 overdue)');

      expect(text('.member-title')).toBe("Benny Lind's tickets");
      expect(
        page
          .querySelector('.member-title ~ mat-spinner')
          ?.getAttribute('aria-label')
      ).toBe('Loading tickets for Benny Lind');
      http
        .expectOne(memberTicketsApi('benny.lind'))
        .flush([ticket(1312), ticket(1290)]);
      detectChanges();
      expect(ticketsIn('member')).toEqual(['#1312', '#1290']);
    });

    it("opens the member's 3-month history from their name", async () => {
      const { answer, chooseMember, http, page, detectChanges } = render();
      answer(atlas);
      await chooseMember('Benny Lind (5 open · 3 overdue)');
      http.expectOne(memberTicketsApi('benny.lind')).flush([]);
      detectChanges();

      const link = page.querySelector<HTMLButtonElement>(
        '.member-title .name-link'
      );
      expect(link?.textContent?.trim()).toBe('Benny Lind');
      expect(link?.getAttribute('aria-label')).toBe(
        'Benny Lind, view 3-month history'
      );
      link?.click();

      // The popup's code loads on first click, so the opening is awaited.
      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      expect(dialog.open).toHaveBeenCalledWith(
        MemberHistoryDialog,
        expect.objectContaining({
          data: { id: 'benny.lind', name: 'Benny Lind' },
        })
      );
    });

    it("hides the member's tickets again when None is chosen", async () => {
      const { answer, chooseMember, http, page, detectChanges } = render();
      answer(atlas);
      await chooseMember('Benny Lind (5 open · 3 overdue)');
      http.expectOne(memberTicketsApi('benny.lind')).flush([ticket(1312)]);
      detectChanges();
      expect(page.querySelector('hd-ticket-table.member')).not.toBeNull();

      await chooseMember('None');

      expect(page.querySelector('.member-title')).toBeNull();
      expect(page.querySelector('hd-ticket-table.member')).toBeNull();
    });

    it('says so when the member has no tickets', async () => {
      const { answer, chooseMember, http, text, detectChanges } = render();
      answer(atlas);

      await chooseMember('Ida Idle (0 open · 0 overdue)');
      http.expectOne(memberTicketsApi('ida.idle')).flush([]);
      detectChanges();

      expect(text('.member-title ~ .message')).toBe(
        'No tickets are assigned to Ida Idle.'
      );
    });

    it("says when the member's tickets could not be loaded, and tries again", async () => {
      const { answer, chooseMember, http, page, detectChanges } = render();
      answer(atlas);

      await chooseMember('Benny Lind (5 open · 3 overdue)');
      http
        .expectOne(memberTicketsApi('benny.lind'))
        .flush(null, { status: 500, statusText: 'Error' });
      detectChanges();

      const message = page.querySelector('.member-title ~ .message');
      expect(message?.getAttribute('role')).toBe('alert');
      expect(message?.textContent).toContain(
        "Benny Lind's tickets couldn't be loaded."
      );
      message?.querySelector('button')?.click();
      detectChanges();
      http.expectOne(memberTicketsApi('benny.lind')).flush([]);
    });
  });

  it('shows the unassigned work, with its count', () => {
    const { answer, texts, ticketsIn } = render();

    answer(atlas);

    expect(texts('h2').slice(1)).toEqual(['Unassigned (2)']);
    expect(ticketsIn('unassigned')).toEqual(['#1009', '#1008']);
  });

  it('shows no assigned tickets until a team member is picked', () => {
    const { answer, page } = render();

    answer(atlas);

    // Only the unassigned table; nobody's own tickets.
    expect(
      [...page.querySelectorAll('hd-ticket-table')].map(
        (table) => table.className
      )
    ).toEqual(['unassigned']);
  });

  it('says so when nothing is unassigned', () => {
    const { answer, texts, page } = render();

    answer({ ...atlas, unassigned: [] });

    expect(texts('.message')).toEqual(['Nothing is waiting to be picked up.']);
    expect(page.querySelector('hd-ticket-table')).toBeNull();
  });

  it('says so when the supervisor leads no team', () => {
    const { answer, texts, page } = render();

    answer(null, 404);

    expect(texts('.message')).toEqual(["You don't lead a team yet."]);
    expect(page.querySelector('table')).toBeNull();
  });

  it('says when the team could not be loaded, and tries again', () => {
    const { answer, page, http, detectChanges } = render();

    answer(null, 500);

    const message = page.querySelector('.message');
    expect(message?.getAttribute('role')).toBe('alert');
    expect(message?.textContent).toContain("Your team couldn't be loaded.");

    message?.querySelector('button')?.click();
    detectChanges();
    expect(page.querySelector('mat-spinner')).not.toBeNull();
    http.expectOne(MY_TEAM_API).flush(atlas);
  });

  describe('assigning', () => {
    /** A ticket Benny holds, with this status. */
    const heldByBenny = (
      ticketNumber: number,
      status: TicketDto['status']
    ) => ({
      ...ticket(ticketNumber),
      status,
      assignee: { id: 'benny.lind', name: 'Benny Lind' },
    });

    /** The action buttons in the ticket table with this class. */
    const actionButtons = (page: HTMLElement, table: string) => [
      ...page.querySelectorAll<HTMLButtonElement>(
        `hd-ticket-table.${table} td.mat-column-action button`
      ),
    ];

    it('offers Assign on every unassigned ticket', () => {
      const { answer, page } = render();
      answer(atlas);

      expect(
        actionButtons(page, 'unassigned').map((button) =>
          button.getAttribute('aria-label')
        )
      ).toEqual(['Assign #1009', 'Assign #1008']);
    });

    it("offers Reassign only on a member's open tickets", async () => {
      const { answer, chooseMember, http, page, detectChanges } = render();
      answer(atlas);
      await chooseMember('Benny Lind (5 open · 3 overdue)');
      http
        .expectOne(memberTicketsApi('benny.lind'))
        .flush([heldByBenny(1312, 'open'), heldByBenny(1290, 'closed')]);
      detectChanges();

      expect(
        actionButtons(page, 'member').map((button) =>
          button.getAttribute('aria-label')
        )
      ).toEqual(['Reassign #1312']);
    });

    it('opens "Assign to…" with the ticket and the team\'s agents', async () => {
      const { answer, page } = render();
      answer(atlas);

      actionButtons(page, 'unassigned')[0].click();

      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      expect(dialog.open).toHaveBeenCalledWith(
        AssignTicketDialog,
        expect.objectContaining({
          data: {
            ticketNumber: 1009,
            subject: 'Subject 1009',
            currentAssigneeId: null,
            members: atlas.members,
          },
        })
      );
    });

    it('assigns to the chosen agent, then says so', async () => {
      const { answer, page, http } = render();
      answer(atlas);
      closedWith = 'ida.idle';

      actionButtons(page, 'unassigned')[0].click();

      await vi
        .waitFor(() =>
          http.expectOne({ method: 'PUT', url: assigneeApi('ticket-1009') })
        )
        .then((call) =>
          call.flush({
            ...ticket(1009),
            assignee: { id: 'ida.idle', name: 'Ida Idle' },
          })
        );
      http.expectOne(MY_TEAM_API).flush(atlas);

      await vi.waitFor(() =>
        expect(snackBar.open).toHaveBeenCalledWith(
          '#1009 assigned to Ida Idle',
          undefined,
          expect.objectContaining({ duration: 5000 })
        )
      );
    });

    it('says why an assignment was refused', async () => {
      const { answer, page, http } = render();
      answer(atlas);
      closedWith = 'ida.idle';

      actionButtons(page, 'unassigned')[0].click();

      await vi
        .waitFor(() =>
          http.expectOne({ method: 'PUT', url: assigneeApi('ticket-1009') })
        )
        .then((call) =>
          call.flush(
            { message: 'No such agent on your team.' },
            { status: 404, statusText: 'Not Found' }
          )
        );

      await vi.waitFor(() =>
        expect(snackBar.open).toHaveBeenCalledWith(
          'No such agent on your team.',
          undefined,
          expect.objectContaining({ duration: 5000 })
        )
      );
    });

    it('assigns nothing when the popup is cancelled', async () => {
      const { answer, page } = render();
      answer(atlas);

      actionButtons(page, 'unassigned')[0].click();

      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      // afterEach's verify() fails on any request left unanswered.
      expect(snackBar.open).not.toHaveBeenCalled();
    });
  });
});
