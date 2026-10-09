import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { CurrentUser, TeamListing, UserAccount } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { initialSessionState } from '../session/session.feature';
import AdminPage, { groupByTeam, plural, savedMessage } from './admin.page';
import { CreateAccountDialog } from './create-account.dialog';
import { ReportsDialog } from '../reports/reports.dialog';
import { EditAccountDialog } from './edit-account.dialog';
import {
  TEAM_ACCOUNTS_API,
  TEAMS_API,
  TeamAccountsStore,
} from './team-accounts.store';

const alex: CurrentUser = {
  id: 'alex.morgan',
  name: 'Alex Morgan',
  role: 'admin',
  teamId: null,
};

const atlas = { id: 'atlas', name: 'Atlas' };
const beacon = { id: 'beacon', name: 'Beacon' };

/** As the API sends them: by name. Alex, an admin, is on no team. */
const ACCOUNTS: UserAccount[] = [
  {
    id: 'alex.morgan',
    name: 'Alex Morgan',
    role: 'admin',
    team: null,
    leadsTeam: false,
    active: true,
  },
  {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    team: atlas,
    leadsTeam: true,
    active: true,
  },
  {
    id: 'dee.parted',
    name: 'Dee Parted',
    role: 'agent',
    team: beacon,
    leadsTeam: false,
    active: false,
  },
  {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    team: atlas,
    leadsTeam: false,
    active: true,
  },
];

/**
 * As the API sends them: by name, with their leads. Comet has nobody on
 * it: it is in no account's team, yet still a team (#1210).
 */
const TEAMS: TeamListing[] = [
  { ...atlas, lead: { id: 'chris.taylor', name: 'Chris Taylor' } },
  { ...beacon, lead: null },
  { id: 'comet', name: 'Comet', lead: null },
];

describe('groupByTeam', () => {
  /** Each group's team, lead and the user IDs in it. */
  const summary = (teams: TeamListing[], accounts: UserAccount[]) =>
    groupByTeam(teams, accounts).map(({ name, lead, accounts: people }) => [
      name,
      lead?.id ?? null,
      people.map(({ id }) => id),
    ]);

  it('gives every team a group, in the teams order, keeping the order within each', () => {
    // Beacon's account comes first in the list; the teams' order still wins.
    expect(summary(TEAMS, [ACCOUNTS[2], ACCOUNTS[1], ACCOUNTS[3]])).toEqual([
      ['Atlas', 'chris.taylor', ['chris.taylor', 'sam.rivera']],
      ['Beacon', null, ['dee.parted']],
      ['Comet', null, []],
    ]);
  });

  // An emptied team stays, so it can be found and joined again (#1210).
  it('keeps a team with nobody on it, empty', () => {
    expect(summary(TEAMS, [])).toEqual([
      ['Atlas', 'chris.taylor', []],
      ['Beacon', null, []],
      ['Comet', null, []],
    ]);
  });

  it('leaves out accounts with no team (admins)', () => {
    const groups = groupByTeam(TEAMS, ACCOUNTS);

    expect(groups.flatMap(({ accounts }) => accounts)).not.toContainEqual(
      expect.objectContaining({ id: 'alex.morgan' })
    );
  });
});

describe('plural', () => {
  it.each([
    [0, 'admin', '0 admins'],
    [1, 'admin', '1 admin'],
    [4, 'account', '4 accounts'],
  ])('says %i %s as "%s"', (count, noun, said) => {
    expect(plural(count, noun)).toBe(said);
  });
});

describe('savedMessage', () => {
  it.each([
    [0, 'Saved Sam Rivera.'],
    [1, 'Saved Sam Rivera. 1 open ticket returned to Unassigned.'],
    [3, 'Saved Sam Rivera. 3 open tickets returned to Unassigned.'],
  ])('with %i tickets handed back: %s', (released, message) => {
    expect(savedMessage('Sam Rivera', released)).toBe(message);
  });
});

describe('AdminPage', () => {
  /**
   * What the popup closes with: Create Account's new user ID, Edit
   * account's true once saved, or nothing when cancelled.
   */
  let closedWith: string | boolean | undefined;
  /** The IDs of the popups opened, which stay open in these tests. */
  let openIds: string[];
  /** Stand-ins for Material's dialog and snack bar, to see what they do. */
  const dialog = {
    open: vi.fn((_: unknown, config?: MatDialogConfig) => {
      if (config?.id) {
        openIds.push(config.id);
      }
      return { afterClosed: () => of(closedWith) };
    }),
    getDialogById: (id: string) => (openIds.includes(id) ? {} : undefined),
  };
  /** Lets a popup still on its way finish opening, if it is going to. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));
  const snackBar = { open: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render() {
    closedWith = undefined;
    openIds = [];
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: alex, checked: true },
          },
        }),
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    const fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    return {
      page,
      http,
      /** The page's own store (it provides one). */
      store: () => fixture.debugElement.injector.get(TeamAccountsStore),
      /** Clicks the Edit button on this account's row. */
      edit: (name: string) =>
        page
          .querySelector<HTMLButtonElement>(`[aria-label="Edit ${name}"]`)
          ?.click(),
      text: (selector: string) =>
        page.querySelector(selector)?.textContent?.trim(),
      /**
       * Answers the page's requests for the accounts and the teams, then
       * renders. A failed one cancels the other.
       */
      answer: (
        body: UserAccount[] | null,
        status = 200,
        teams: TeamListing[] = TEAMS
      ) => {
        const teamsCall = http.expectOne(TEAMS_API);
        http
          .expectOne(TEAM_ACCOUNTS_API)
          .flush(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
        if (status === 200) {
          teamsCall.flush(teams);
        }
        fixture.detectChanges();
      },
      /** Each team section: its heading, and the user IDs in its table. */
      sections: () =>
        [...page.querySelectorAll('section.team')].map((section) => [
          section.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim(),
          [...section.querySelectorAll('td.mat-column-id')].map((cell) =>
            cell.textContent?.trim()
          ),
        ]),
      detectChanges: () => fixture.detectChanges(),
    };
  }

  it('is headed Team accounts, and greets the signed-in admin', () => {
    const { text, answer } = render();
    answer(ACCOUNTS);

    expect(text('.eyebrow')).toBe('Admin');
    expect(text('h1')).toBe('Team accounts');
    expect(text('.greeting')).toBe('Signed in as Alex Morgan');
  });

  it('shows a spinner while the accounts load', () => {
    const { page, answer } = render();

    expect(page.querySelector('mat-spinner')?.getAttribute('aria-label')).toBe(
      'Loading the accounts'
    );
    expect(page.querySelector('section.team')).toBeNull();

    answer(ACCOUNTS);
    expect(page.querySelector('mat-spinner')).toBeNull();
  });

  it('counts the accounts on teams, the teams, and the admins', () => {
    const { text, answer } = render();

    answer(ACCOUNTS);

    expect(text('.summary')?.replace(/\s+/g, ' ')).toBe(
      '3 accounts in 3 teams, and 1 admin'
    );
  });

  it('shows one table per team, teams by name, each with only its people', () => {
    const { sections, answer } = render();

    answer(ACCOUNTS);

    expect(sections()).toEqual([
      ['Atlas · 2 accounts', ['chris.taylor', 'sam.rivera']],
      ['Beacon · 1 account · No lead', ['dee.parted']],
      ['Comet · 0 accounts · No lead', []],
    ]);
  });

  // An emptied team stays on the page, so it can be joined again (#1210).
  it('shows a team with nobody on it, saying so, with no table', () => {
    const { page, answer } = render();

    answer(ACCOUNTS);

    const comet = page.querySelector('section.team[aria-label="Comet"]');
    expect(comet?.querySelector('hd-accounts-table')).toBeNull();
    expect(comet?.querySelector('.empty')?.textContent?.trim()).toBe(
      'No accounts yet.'
    );
  });

  it('says No lead only beside a team without one', () => {
    const { page, answer } = render();

    answer(ACCOUNTS);

    expect(
      [...page.querySelectorAll('section.team')].map((section) =>
        section.querySelector('.no-lead')?.textContent?.trim()
      )
    ).toEqual([undefined, '· No lead', '· No lead']);
  });

  describe('Admins', () => {
    /** Another admin, so the signed-in one is not the only one. */
    const priya: UserAccount = {
      id: 'priya.shah',
      name: 'Priya Shah',
      role: 'admin',
      team: null,
      leadsTeam: false,
      active: true,
    };
    const admins = (page: HTMLElement) => page.querySelector('section.admins');

    it('lists the admins in their own section, after the teams', () => {
      const { page, answer } = render();

      answer([...ACCOUNTS, priya]);

      const section = admins(page);
      expect(
        section?.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim()
      ).toBe('Admins · 2 accounts');
      expect(
        [...(section?.querySelectorAll('td.mat-column-id') ?? [])].map((cell) =>
          cell.textContent?.trim()
        )
      ).toEqual(['alex.morgan', 'priya.shah']);
      // After the last team's table.
      const tables = page.querySelectorAll('section.team');
      expect(
        tables[tables.length - 1].compareDocumentPosition(section as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("offers Edit on another admin's row, not on your own", async () => {
      const { page, answer } = render();
      answer([...ACCOUNTS, priya]);

      const labels = [
        ...(admins(page)?.querySelectorAll('td.mat-column-edit button') ?? []),
      ].map((button) => button.getAttribute('aria-label'));
      expect(labels).toEqual(['Edit Priya Shah']);

      (
        admins(page)?.querySelector(
          '[aria-label="Edit Priya Shah"]'
        ) as HTMLButtonElement
      ).click();
      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      expect(dialog.open).toHaveBeenCalledWith(
        EditAccountDialog,
        expect.objectContaining({
          data: expect.objectContaining({ account: priya }),
        })
      );
    });

    it('has no Admins section when the list has no admins', () => {
      const { page, answer } = render();

      answer(ACCOUNTS.filter(({ role }) => role !== 'admin'));

      expect(admins(page)).toBeNull();
    });
  });

  it('says when the accounts could not be loaded, and tries again', () => {
    const { page, answer, http, detectChanges } = render();

    answer(null, 500);

    const message = page.querySelector('.message');
    expect(message?.getAttribute('role')).toBe('alert');
    expect(message?.textContent).toContain("The accounts couldn't be loaded.");
    message?.querySelector('button')?.click();
    detectChanges();
    expect(page.querySelector('mat-spinner')).not.toBeNull();
    http.expectOne(TEAM_ACCOUNTS_API).flush(ACCOUNTS);
    http.expectOne(TEAMS_API).flush(TEAMS);
  });

  describe('Create Account', () => {
    it('offers Create Account beside the summary and at the bottom', () => {
      const { page, answer } = render();
      answer(ACCOUNTS);

      expect(
        page.querySelector('.summary-row button')?.textContent?.trim()
      ).toContain('Create Account');
      expect(
        page.querySelector('.bottom-actions button')?.textContent?.trim()
      ).toContain('Create Account');
      // At the bottom: after the last team's table.
      const tables = page.querySelectorAll('hd-accounts-table');
      expect(
        tables[tables.length - 1].compareDocumentPosition(
          page.querySelector('.bottom-actions') as Node
        ) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it.each(['.summary-row', '.bottom-actions'])(
      'opens the popup from %s with the teams and who leads each',
      async (where) => {
        const { page, answer } = render();
        answer(ACCOUNTS);

        page.querySelector<HTMLButtonElement>(`${where} button`)?.click();

        // The popup's code loads on the first click.
        await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
        expect(dialog.open).toHaveBeenCalledWith(
          CreateAccountDialog,
          expect.objectContaining({
            data: {
              teams: [
                { id: 'atlas', name: 'Atlas', leadName: 'Chris Taylor' },
                { id: 'beacon', name: 'Beacon', leadName: null },
                { id: 'comet', name: 'Comet', leadName: null },
              ],
            },
          })
        );
      }
    );

    it('confirms a created account in a snack bar', async () => {
      const { page, answer } = render();
      answer(ACCOUNTS);
      closedWith = 'nia.new';

      page.querySelector<HTMLButtonElement>('.summary-row button')?.click();

      await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalledOnce());
      expect(snackBar.open).toHaveBeenCalledWith(
        'Account nia.new created',
        undefined,
        expect.objectContaining({ duration: 5000 })
      );
    });

    // The first time, the popup's code is still on its way when a second
    // click comes, with no backdrop yet to stop it.
    it('opens one popup when Create Account is clicked twice at once', async () => {
      const { page, answer } = render();
      answer(ACCOUNTS);

      const create = page.querySelector<HTMLButtonElement>(
        '.summary-row button'
      );
      create?.click();
      create?.click();

      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalled());
      await settle();
      expect(dialog.open).toHaveBeenCalledOnce();
    });

    it('says nothing when the popup is cancelled', async () => {
      const { page, answer } = render();
      answer(ACCOUNTS);

      page.querySelector<HTMLButtonElement>('.summary-row button')?.click();

      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      expect(snackBar.open).not.toHaveBeenCalled();
    });
  });

  describe('Reports', () => {
    it('offers Reports beside Create Account, which opens the Reports popup', async () => {
      const { page, answer } = render();
      answer(ACCOUNTS);

      const button = page.querySelector<HTMLButtonElement>(
        '.summary-row button.reports'
      );
      expect(button?.textContent).toContain('Reports');
      button?.click();

      // The popup's code loads on the first click.
      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      expect(dialog.open).toHaveBeenCalledWith(
        ReportsDialog,
        expect.objectContaining({ width: '72rem' })
      );
    });
  });

  describe('Edit account', () => {
    it('gives every account on a team an Edit button', () => {
      const { page, answer } = render();
      answer(ACCOUNTS);

      expect(
        [...page.querySelectorAll('td.mat-column-edit button')].map((button) =>
          button.getAttribute('aria-label')
        )
      ).toEqual(['Edit Chris Taylor', 'Edit Sam Rivera', 'Edit Dee Parted']);
    });

    it('opens the popup with the account, the teams and who leads each', async () => {
      const { answer, edit } = render();
      answer(ACCOUNTS);

      edit('Sam Rivera');

      // The popup's code loads on the first click.
      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      expect(dialog.open).toHaveBeenCalledWith(
        EditAccountDialog,
        expect.objectContaining({
          data: {
            account: ACCOUNTS[3],
            teams: [
              { id: 'atlas', name: 'Atlas', leadName: 'Chris Taylor' },
              { id: 'beacon', name: 'Beacon', leadName: null },
              { id: 'comet', name: 'Comet', leadName: null },
            ],
          },
        })
      );
    });

    it('opens one popup when Edit is clicked twice at once', async () => {
      const { answer, edit } = render();
      answer(ACCOUNTS);

      edit('Sam Rivera');
      edit('Sam Rivera');

      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalled());
      await settle();
      expect(dialog.open).toHaveBeenCalledOnce();
    });

    it('confirms a saved edit, with the tickets handed back', async () => {
      const { answer, edit, http, store } = render();
      answer(ACCOUNTS);
      // The popup saves through the page's store; here the test does.
      store().update({
        userId: 'sam.rivera',
        request: { role: 'agent', teamId: 'atlas', active: false },
      });
      http
        .expectOne({ method: 'PUT', url: `${TEAM_ACCOUNTS_API}/sam.rivera` })
        .flush({
          account: { ...ACCOUNTS[3], active: false },
          releasedTickets: 3,
        });
      http.expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API }).flush(ACCOUNTS);
      http.expectOne(TEAMS_API).flush(TEAMS);
      closedWith = true;

      edit('Sam Rivera');

      await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalledOnce());
      expect(snackBar.open).toHaveBeenCalledWith(
        'Saved Sam Rivera. 3 open tickets returned to Unassigned.',
        undefined,
        expect.objectContaining({ duration: 5000 })
      );
    });

    it('says nothing when the popup is cancelled', async () => {
      const { answer, edit } = render();
      answer(ACCOUNTS);

      edit('Sam Rivera');

      await vi.waitFor(() => expect(dialog.open).toHaveBeenCalledOnce());
      expect(snackBar.open).not.toHaveBeenCalled();
    });
  });
});
