import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CurrentUser, UserAccount } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { initialSessionState } from '../session/session.feature';
import AdminPage, { groupByTeam } from './admin.page';
import { TEAM_ACCOUNTS_API } from './team-accounts.store';

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
    active: true,
  },
  {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    team: atlas,
    active: true,
  },
  {
    id: 'dee.parted',
    name: 'Dee Parted',
    role: 'agent',
    team: beacon,
    active: false,
  },
  {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    team: atlas,
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

describe('AdminPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: alex, checked: true },
          },
        }),
      ],
    });
    const fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    return {
      page,
      http,
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
      ['Beacon · 1 accounts', ['dee.parted']],
    ]);
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
});
