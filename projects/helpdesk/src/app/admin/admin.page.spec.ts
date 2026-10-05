import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { CurrentUser, UserAccount } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { initialSessionState } from '../session/session.feature';
import AdminPage, { groupByTeam, savedMessage } from './admin.page';
import { CreateAccountDialog } from './create-account.dialog';
import { ReportsDialog } from '../reports/reports.dialog';
import { EditAccountDialog } from './edit-account.dialog';
import { TEAM_ACCOUNTS_API, TeamAccountsStore } from './team-accounts.store';

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

describe('groupByTeam', () => {
  it('groups by team, teams by name, keeping the order within each', () => {
    // Beacon's account comes first in the list; Atlas still leads.
    const groups = groupByTeam([ACCOUNTS[2], ACCOUNTS[1], ACCOUNTS[3]]);

    expect(
      groups.map(({ name, accounts }) => [name, accounts.map(({ id }) => id)])
    ).toEqual([
      ['Atlas', ['chris.taylor', 'sam.rivera']],
      ['Beacon', ['dee.parted']],
    ]);
  });

  it('leaves out accounts with no team (admins)', () => {
    const groups = groupByTeam(ACCOUNTS);

    expect(groups.flatMap(({ accounts }) => accounts)).not.toContainEqual(
      expect.objectContaining({ id: 'alex.morgan' })
    );
  });

  it('has no groups when nobody is on a team', () => {
    expect(groupByTeam([ACCOUNTS[0]])).toEqual([]);
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
  /** Stand-ins for Material's dialog and snack bar, to see what they do. */
  const dialog = {
    open: vi.fn(() => ({ afterClosed: () => of(closedWith) })),
  };
  const snackBar = { open: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render() {
    closedWith = undefined;
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
      /** Answers the page's request for the accounts, then renders. */
      answer: (body: UserAccount[] | null, status = 200) => {
        http
          .expectOne(TEAM_ACCOUNTS_API)
          .flush(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
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

  it('counts the accounts on teams, and the teams', () => {
    const { text, answer } = render();

    answer(ACCOUNTS);

    expect(text('.summary')?.replace(/\s+/g, ' ')).toBe(
      '3 accounts in 2 teams'
    );
  });

  it('shows one table per team, teams by name, each with only its people', () => {
    const { sections, answer } = render();

    answer(ACCOUNTS);

    expect(sections()).toEqual([
      ['Atlas · 2 accounts', ['chris.taylor', 'sam.rivera']],
      ['Beacon · 1 accounts · No lead', ['dee.parted']],
    ]);
  });

  it('says No lead only beside a team without one', () => {
    const { page, answer } = render();

    answer(ACCOUNTS);

    expect(
      [...page.querySelectorAll('section.team')].map((section) =>
        section.querySelector('.no-lead')?.textContent?.trim()
      )
    ).toEqual([undefined, '· No lead']);
  });

  it('shows no admins: they are on no team', () => {
    const { page, answer } = render();

    answer(ACCOUNTS);

    expect(page.textContent).not.toContain('alex.morgan');
    expect(page.textContent).not.toContain('No team');
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
            ],
          },
        })
      );
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
