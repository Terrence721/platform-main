import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TeamOverview, TicketDto } from '@helpdesk/contract';
import { memberTicketsApi, MY_TEAM_API, MyTeamStore } from './my-team.store';

const atlas: TeamOverview = {
  id: 'atlas',
  name: 'Atlas',
  members: [
    { id: 'sam.rivera', name: 'Sam Rivera', openTickets: 2, overdueTickets: 1 },
  ],
  unassigned: [],
};

describe('MyTeamStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), MyTeamStore],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("starts loading the supervisor's team as soon as it is created", () => {
    const store = TestBed.inject(MyTeamStore);

    expect(store.loadState()).toBe('loading');
    expect(http.expectOne(MY_TEAM_API).request.method).toBe('GET');
  });

  it('holds the team once the API answers', () => {
    const store = TestBed.inject(MyTeamStore);

    http.expectOne(MY_TEAM_API).flush(atlas);

    expect(store.loadState()).toBe('loaded');
    expect(store.team()).toEqual(atlas);
  });

  it.each([
    ['no team (404)', 404, 'no-team'],
    ['a failure (500)', 500, 'failed'],
  ] as const)('tells %s apart, holding no team', (_, status, loadState) => {
    const store = TestBed.inject(MyTeamStore);

    http.expectOne(MY_TEAM_API).flush(null, { status, statusText: 'Error' });

    expect(store.loadState()).toBe(loadState);
    expect(store.team()).toBeNull();
  });

  it('lets a newer load replace one still running', () => {
    const store = TestBed.inject(MyTeamStore);
    const first = http.expectOne(MY_TEAM_API);

    store.load();
    const second = http.expectOne(MY_TEAM_API);

    expect(first.cancelled).toBe(true);
    second.flush(atlas);
    expect(store.team()).toEqual(atlas);
  });

  describe('choosing a team member', () => {
    /** A store with its team loaded, as the page has it. */
    function loadedStore() {
      const store = TestBed.inject(MyTeamStore);
      http.expectOne(MY_TEAM_API).flush(atlas);
      return store;
    }

    const ticket = (ticketNumber: number) =>
      ({ id: `ticket-${ticketNumber}`, ticketNumber }) as TicketDto;

    it('has nobody chosen at first, and no tickets', () => {
      const store = loadedStore();

      expect(store.selectedMemberId()).toBeNull();
      expect(store.memberTicketsState()).toBe('idle');
      expect(store.memberTickets()).toEqual([]);
    });

    it("loads the chosen member's tickets", () => {
      const store = loadedStore();

      store.selectMember('sam.rivera');
      expect(store.selectedMemberId()).toBe('sam.rivera');
      expect(store.memberTicketsState()).toBe('loading');

      http
        .expectOne('/api/teams/mine/members/sam.rivera/tickets')
        .flush([ticket(1003), ticket(1005)]);
      expect(store.memberTicketsState()).toBe('loaded');
      expect(
        store.memberTickets().map(({ ticketNumber }) => ticketNumber)
      ).toEqual([1003, 1005]);
    });

    it('says loading failed, holding no tickets', () => {
      const store = loadedStore();

      store.selectMember('sam.rivera');
      http
        .expectOne(memberTicketsApi('sam.rivera'))
        .flush(null, { status: 404, statusText: 'Not Found' });

      expect(store.memberTicketsState()).toBe('failed');
      expect(store.memberTickets()).toEqual([]);
    });

    it("never lets a slow answer for one member replace another's list", () => {
      const store = loadedStore();

      store.selectMember('sam.rivera');
      const firstRequest = http.expectOne(memberTicketsApi('sam.rivera'));
      store.selectMember('benny.lind');
      const secondRequest = http.expectOne(memberTicketsApi('benny.lind'));

      expect(firstRequest.cancelled).toBe(true);
      secondRequest.flush([ticket(1312)]);
      expect(store.selectedMemberId()).toBe('benny.lind');
      expect(
        store.memberTickets().map(({ ticketNumber }) => ticketNumber)
      ).toEqual([1312]);
    });

    it("clears the previous member's tickets while the next ones load", () => {
      const store = loadedStore();
      store.selectMember('sam.rivera');
      http.expectOne(memberTicketsApi('sam.rivera')).flush([ticket(1003)]);

      store.selectMember('benny.lind');

      expect(store.memberTickets()).toEqual([]);
      http.expectOne(memberTicketsApi('benny.lind')).flush([]);
    });

    it('keeps user IDs safe in the address', () => {
      expect(memberTicketsApi('a/b')).toBe(
        '/api/teams/mine/members/a%2Fb/tickets'
      );
    });

    it("chooses nobody again, dropping the member's tickets", () => {
      const store = loadedStore();
      store.selectMember('sam.rivera');
      http.expectOne(memberTicketsApi('sam.rivera')).flush([ticket(1003)]);

      store.selectMember(null);

      expect(store.selectedMemberId()).toBeNull();
      expect(store.memberTicketsState()).toBe('idle');
      expect(store.memberTickets()).toEqual([]);
    });

    it('cancels a load still running when nobody is chosen, so nothing comes back', () => {
      const store = loadedStore();
      store.selectMember('sam.rivera');
      const pending = http.expectOne(memberTicketsApi('sam.rivera'));

      store.selectMember(null);

      expect(pending.cancelled).toBe(true);
      expect(store.memberTicketsState()).toBe('idle');
    });
  });
});
