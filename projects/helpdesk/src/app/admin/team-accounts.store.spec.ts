import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CreateAccountRequest, UserAccount } from '@helpdesk/contract';
import {
  CREATE_UNAVAILABLE_MESSAGE,
  TEAM_ACCOUNTS_API,
  TeamAccountsStore,
} from './team-accounts.store';

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

  describe('create', () => {
    const request: CreateAccountRequest = {
      userId: 'nia.new',
      name: 'nia.new',
      role: 'agent',
      teamId: 'atlas',
      password: 'a-starting-password',
    };

    /** A store with these accounts loaded, as the page has it. */
    function loadedStore(...accountIds: string[]) {
      const store = TestBed.inject(TeamAccountsStore);
      http
        .expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API })
        .flush(accountIds.map(account));
      return store;
    }

    const post = () =>
      http.expectOne({ method: 'POST', url: TEAM_ACCOUNTS_API });

    it('starts with no Create Account in progress', () => {
      const store = loadedStore();

      expect(store.createState()).toBe('idle');
      expect(store.createError()).toBeNull();
    });

    it('sends the request, saving until the API answers', () => {
      const store = loadedStore();

      store.create(request);

      expect(store.createState()).toBe('saving');
      const call = post();
      expect(call.request.body).toEqual(request);
      call.flush(account('nia.new'), { status: 201, statusText: 'Created' });
    });

    it('adds the new account in name order', () => {
      const store = loadedStore('alex.morgan', 'sam.rivera');

      store.create(request);
      post().flush(account('nia.new'), { status: 201, statusText: 'Created' });

      expect(store.createState()).toBe('created');
      expect(ids(store)).toEqual(['alex.morgan', 'nia.new', 'sam.rivera']);
    });

    it.each([
      ['a taken user ID (409)', 409, 'That user ID is taken.'],
      ['a wrong field (400)', 400, 'Choose a team.'],
    ])("keeps the API's message for %s", (_, status, message) => {
      const store = loadedStore('sam.rivera');

      store.create(request);
      post().flush({ message }, { status, statusText: 'Error' });

      expect(store.createState()).toBe('failed');
      expect(store.createError()).toBe(message);
      expect(ids(store)).toEqual(['sam.rivera']);
    });

    it('says creating is unavailable when the API cannot explain', () => {
      const store = loadedStore();

      store.create(request);
      post().error(new ProgressEvent('error'));

      expect(store.createError()).toBe(CREATE_UNAVAILABLE_MESSAGE);
    });

    it('ignores a second send while the first is saving', () => {
      const store = loadedStore();

      store.create(request);
      store.create(request);

      post().flush(account('nia.new'), { status: 201, statusText: 'Created' });
    });

    it('resets for a new form', () => {
      const store = loadedStore();
      store.create(request);
      post().flush(
        { message: 'Choose a team.' },
        { status: 400, statusText: 'Error' }
      );

      store.resetCreate();

      expect(store.createState()).toBe('idle');
      expect(store.createError()).toBeNull();
    });
  });
});
