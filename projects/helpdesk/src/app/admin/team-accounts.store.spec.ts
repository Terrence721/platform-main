import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { UserAccount } from '@helpdesk/contract';
import { TEAM_ACCOUNTS_API, TeamAccountsStore } from './team-accounts.store';

/** An account with just what these tests look at. */
const account = (id: string) =>
  ({ id, name: id, role: 'agent', team: null, active: true }) as UserAccount;

describe('TeamAccountsStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TeamAccountsStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** The user IDs the store holds, in its order. */
  const ids = (store: InstanceType<typeof TeamAccountsStore>) =>
    store.entities().map(({ id }) => id);

  it('starts loading the accounts as soon as it is created', () => {
    const store = TestBed.inject(TeamAccountsStore);

    expect(store.loadState()).toBe('loading');
    expect(http.expectOne(TEAM_ACCOUNTS_API).request.method).toBe('GET');
  });

  it('keeps the accounts in the order the API sends them', () => {
    const store = TestBed.inject(TeamAccountsStore);

    http
      .expectOne(TEAM_ACCOUNTS_API)
      .flush([account('alex.morgan'), account('chris.taylor')]);

    expect(store.loadState()).toBe('loaded');
    expect(ids(store)).toEqual(['alex.morgan', 'chris.taylor']);
  });

  it('says loading failed, holding no accounts', () => {
    const store = TestBed.inject(TeamAccountsStore);

    http
      .expectOne(TEAM_ACCOUNTS_API)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.loadState()).toBe('failed');
    expect(store.entities()).toEqual([]);
  });

  it('lets a newer load replace one still running', () => {
    const store = TestBed.inject(TeamAccountsStore);
    const first = http.expectOne(TEAM_ACCOUNTS_API);

    store.load();
    const second = http.expectOne(TEAM_ACCOUNTS_API);

    expect(first.cancelled).toBe(true);
    second.flush([account('sam.rivera')]);
    expect(ids(store)).toEqual(['sam.rivera']);
  });
});
