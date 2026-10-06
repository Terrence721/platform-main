import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type CreateAccountRequest,
  OWN_ACCOUNT_MESSAGE,
  type UserAccount,
} from '@helpdesk/contract';
import {
  type AccountUpdate,
  CREATE_UNAVAILABLE_MESSAGE,
  TEAM_ACCOUNTS_API,
  TeamAccountsStore,
  UPDATE_UNAVAILABLE_MESSAGE,
} from './team-accounts.store';

import { Subject } from 'rxjs';
import { type LiveUpdate, LiveUpdates } from '../live/live-updates';

/** An account with just what these tests look at. */
const account = (id: string) =>
  ({ id, name: id, role: 'agent', team: null, active: true }) as UserAccount;

describe('TeamAccountsStore', () => {
  let http: HttpTestingController;
  /** The live updates the store hears, sent by the test. */
  let live: Subject<LiveUpdate>;

  beforeEach(() => {
    live = new Subject<LiveUpdate>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TeamAccountsStore,
        { provide: LiveUpdates, useValue: { updates: live } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** The user IDs the store holds, in its order. */
  const ids = (store: InstanceType<typeof TeamAccountsStore>) =>
    store.entities().map(({ id }) => id);

  /** A store with these accounts loaded, as the page has it. */
  function loadedStore(...accountIds: string[]) {
    const store = TestBed.inject(TeamAccountsStore);
    http
      .expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API })
      .flush(accountIds.map(account));
    return store;
  }

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

  describe('update', () => {
    const edit: AccountUpdate = {
      userId: 'sam.rivera',
      request: { role: 'agent', teamId: 'atlas', active: false },
    };
    const deactivated = { ...account('sam.rivera'), active: false };

    const put = () =>
      http.expectOne({
        method: 'PUT',
        url: `${TEAM_ACCOUNTS_API}/sam.rivera`,
      });
    const reload = () =>
      http.expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API });

    it('starts with no edit in progress', () => {
      const store = loadedStore();

      expect(store.updateState()).toBe('idle');
      expect(store.updateError()).toBeNull();
      expect(store.updated()).toBeNull();
    });

    it('sends the request to the account, saving until the API answers', () => {
      const store = loadedStore('sam.rivera');

      store.update(edit);

      expect(store.updateState()).toBe('saving');
      const call = put();
      expect(call.request.body).toEqual(edit.request);
      call.flush({ account: deactivated, releasedTickets: 0 });
      reload().flush([deactivated]);
    });

    it('changes the account in place, then reloads quietly', () => {
      const store = loadedStore('alex.morgan', 'sam.rivera');

      store.update(edit);
      put().flush({ account: deactivated, releasedTickets: 3 });

      expect(store.updateState()).toBe('saved');
      expect(store.updated()).toEqual({
        account: deactivated,
        releasedTickets: 3,
      });
      expect(store.entities()).toEqual([account('alex.morgan'), deactivated]);
      // An edit can change who else leads a team: the list loads again,
      // with no loading state for the page to show.
      const call = reload();
      expect(store.loadState()).toBe('loaded');
      call.flush([account('alex.morgan'), deactivated, account('nia.new')]);
      expect(ids(store)).toEqual(['alex.morgan', 'sam.rivera', 'nia.new']);
    });

    it('keeps the edited account when the reload fails', () => {
      const store = loadedStore('sam.rivera');

      store.update(edit);
      put().flush({ account: deactivated, releasedTickets: 0 });
      reload().flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.loadState()).toBe('loaded');
      expect(store.updateState()).toBe('saved');
      expect(store.entities()).toEqual([deactivated]);
    });

    it.each([
      ['a wrong field (400)', 400, 'Choose a team.'],
      ['no such account (404)', 404, 'No such account.'],
      ["the admin's own account (409)", 409, OWN_ACCOUNT_MESSAGE],
    ])(
      "keeps the API's message for %s, changing nothing",
      (_, status, message) => {
        const store = loadedStore('sam.rivera');

        store.update(edit);
        put().flush({ message }, { status, statusText: 'Error' });

        expect(store.updateState()).toBe('failed');
        expect(store.updateError()).toBe(message);
        expect(store.entities()).toEqual([account('sam.rivera')]);
      }
    );

    it('says saving is unavailable when the API cannot explain', () => {
      const store = loadedStore('sam.rivera');

      store.update(edit);
      put().flush(
        { message: 'Internal server error' },
        { status: 500, statusText: 'Server Error' }
      );

      expect(store.updateError()).toBe(UPDATE_UNAVAILABLE_MESSAGE);
    });

    it('ignores a second send while the first is saving', () => {
      const store = loadedStore('sam.rivera');

      store.update(edit);
      store.update(edit);

      put().flush({ account: deactivated, releasedTickets: 0 });
      reload().flush([deactivated]);
    });

    it('resets for a new form', () => {
      const store = loadedStore('sam.rivera');
      store.update(edit);
      put().flush({ account: deactivated, releasedTickets: 2 });
      reload().flush([deactivated]);

      store.resetUpdate();

      expect(store.updateState()).toBe('idle');
      expect(store.updateError()).toBeNull();
      expect(store.updated()).toBeNull();
    });
  });

  describe('live updates', () => {
    const accountsChanged: LiveUpdate = {
      kind: 'event',
      event: { type: 'accounts' },
    };

    it('fetches the accounts again, quietly, when another admin changes one', () => {
      const store = loadedStore('alex.morgan', 'sam.rivera');

      live.next(accountsChanged);

      expect(store.loadState()).toBe('loaded');
      http
        .expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API })
        .flush([
          account('alex.morgan'),
          account('nia.new'),
          account('sam.rivera'),
        ]);
      expect(ids(store)).toEqual(['alex.morgan', 'nia.new', 'sam.rivera']);
    });

    it('fetches them again when the stream comes back after a break', () => {
      loadedStore('alex.morgan');

      live.next({ kind: 'reconnected' });

      http.expectOne(TEAM_ACCOUNTS_API).flush([account('alex.morgan')]);
    });

    it('leaves them alone for a ticket or a reply', () => {
      loadedStore('alex.morgan');

      live.next({ kind: 'event', event: { type: 'ticket', ticketId: 't-1' } });
      live.next({ kind: 'event', event: { type: 'message', ticketId: 't-1' } });

      http.expectNone(TEAM_ACCOUNTS_API);
    });

    it('keeps the tables as they are when fetching them again fails', () => {
      const store = loadedStore('alex.morgan', 'sam.rivera');

      live.next(accountsChanged);
      http
        .expectOne(TEAM_ACCOUNTS_API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.loadState()).toBe('loaded');
      expect(ids(store)).toEqual(['alex.morgan', 'sam.rivera']);
    });
  });
});
