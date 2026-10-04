import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TeamOverview, TicketDto } from '@helpdesk/contract';
import { assigneeApi, statusApi } from '../tickets/ticket-api-paths';
import {
  ASSIGN_UNAVAILABLE_MESSAGE,
  memberTicketsApi,
  MY_TEAM_API,
  MyTeamStore,
  STATUS_UNAVAILABLE_MESSAGE,
} from './my-team.store';

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

  describe('assign', () => {
    const TICKET_ID = '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34';
    const assigned = {
      id: TICKET_ID,
      ticketNumber: 1312,
      assignee: { id: 'sam.rivera', name: 'Sam Rivera' },
    } as TicketDto;
    /** The team after the assignment: Sam has one more ticket. */
    const atlasAfter: TeamOverview = {
      ...atlas,
      members: [
        {
          id: 'sam.rivera',
          name: 'Sam Rivera',
          openTickets: 3,
          overdueTickets: 1,
        },
      ],
    };

    /** A store with its team loaded, as the page has it. */
    function loadedStore() {
      const store = TestBed.inject(MyTeamStore);
      http.expectOne(MY_TEAM_API).flush(atlas);
      return store;
    }

    const put = () =>
      http.expectOne({ method: 'PUT', url: assigneeApi(TICKET_ID) });

    it('starts with no assignment in progress', () => {
      const store = loadedStore();

      expect(store.assignState()).toBe('idle');
      expect(store.assignError()).toBeNull();
    });

    it('sends the agent, saving until the API answers', () => {
      const store = loadedStore();

      store.assign({ ticketId: TICKET_ID, agentId: 'sam.rivera' });

      expect(store.assignState()).toBe('saving');
      const call = put();
      expect(call.request.body).toEqual({ assigneeId: 'sam.rivera' });
      call.flush(assigned);
      http.expectOne(MY_TEAM_API).flush(atlasAfter);
    });

    it('then fetches the team again, quietly, with no spinner', () => {
      const store = loadedStore();

      store.assign({ ticketId: TICKET_ID, agentId: 'sam.rivera' });
      put().flush(assigned);

      expect(store.loadState()).toBe('loaded');
      http.expectOne(MY_TEAM_API).flush(atlasAfter);
      expect(store.team()).toEqual(atlasAfter);
      expect(store.assignState()).toBe('assigned');
      expect(store.lastAssigned()).toEqual(assigned);
    });

    it("also fetches the chosen member's tickets again", () => {
      const store = loadedStore();
      store.selectMember('sam.rivera');
      http.expectOne(memberTicketsApi('sam.rivera')).flush([]);

      store.assign({ ticketId: TICKET_ID, agentId: 'sam.rivera' });
      put().flush(assigned);
      http.expectOne(MY_TEAM_API).flush(atlasAfter);
      http.expectOne(memberTicketsApi('sam.rivera')).flush([assigned]);

      expect(store.memberTickets()).toEqual([assigned]);
      expect(store.memberTicketsState()).toBe('loaded');
    });

    it.each([
      [404, 'No such agent on your team.'],
      [409, "This ticket is finished, so it can't be assigned."],
    ])("keeps the API's message for a %s", (status, message) => {
      const store = loadedStore();

      store.assign({ ticketId: TICKET_ID, agentId: 'omar.other' });
      put().flush({ message }, { status, statusText: 'Error' });

      expect(store.assignState()).toBe('failed');
      expect(store.assignError()).toBe(message);
      expect(store.team()).toEqual(atlas);
    });

    it('says assigning is unavailable when the API cannot explain', () => {
      const store = loadedStore();

      store.assign({ ticketId: TICKET_ID, agentId: 'sam.rivera' });
      put().error(new ProgressEvent('error'));

      expect(store.assignError()).toBe(ASSIGN_UNAVAILABLE_MESSAGE);
    });

    it('ignores a second assignment while one is saving', () => {
      const store = loadedStore();

      store.assign({ ticketId: TICKET_ID, agentId: 'sam.rivera' });
      store.assign({ ticketId: TICKET_ID, agentId: 'benny.lind' });

      put().flush(assigned);
      http.expectOne(MY_TEAM_API).flush(atlasAfter);
    });
  });

  describe('changeStatus', () => {
    const TICKET_ID = '7d0f6c2e-4b1a-4c3e-9a51-2f8d6e0b1c34';
    const resolved = {
      id: TICKET_ID,
      ticketNumber: 1312,
      status: 'resolved',
    } as TicketDto;

    /** A store with its team loaded and Sam chosen, as the page has it. */
    function storeWithSam() {
      const store = TestBed.inject(MyTeamStore);
      http.expectOne(MY_TEAM_API).flush(atlas);
      store.selectMember('sam.rivera');
      http
        .expectOne(memberTicketsApi('sam.rivera'))
        .flush([{ ...resolved, status: 'open' }]);
      return store;
    }

    const put = () =>
      http.expectOne({ method: 'PUT', url: statusApi(TICKET_ID) });

    it('starts with no change in progress', () => {
      const store = storeWithSam();

      expect(store.statusState()).toBe('idle');
      expect(store.statusError()).toBeNull();
    });

    it("moves the member's ticket, then refreshes quietly", () => {
      const store = storeWithSam();

      store.changeStatus({ ticketId: TICKET_ID, status: 'resolved' });
      expect(store.statusState()).toBe('saving');
      const call = put();
      expect(call.request.body).toEqual({ status: 'resolved' });
      call.flush(resolved);
      http.expectOne(MY_TEAM_API).flush(atlas);
      http.expectOne(memberTicketsApi('sam.rivera')).flush([resolved]);

      expect(store.loadState()).toBe('loaded');
      expect(store.memberTickets()).toEqual([resolved]);
      expect(store.statusState()).toBe('changed');
      expect(store.lastChanged()).toEqual(resolved);
    });

    it("keeps the API's message for a move it refuses", () => {
      const store = storeWithSam();

      store.changeStatus({ ticketId: TICKET_ID, status: 'new' });
      put().flush(
        { message: "An open ticket can't become new." },
        { status: 409, statusText: 'Conflict' }
      );

      expect(store.statusState()).toBe('failed');
      expect(store.statusError()).toBe("An open ticket can't become new.");
    });

    it('says changing is unavailable when the API cannot explain', () => {
      const store = storeWithSam();

      store.changeStatus({ ticketId: TICKET_ID, status: 'resolved' });
      put().error(new ProgressEvent('error'));

      expect(store.statusError()).toBe(STATUS_UNAVAILABLE_MESSAGE);
    });

    it('ignores a second change while one is saving', () => {
      const store = storeWithSam();

      store.changeStatus({ ticketId: TICKET_ID, status: 'resolved' });
      store.changeStatus({ ticketId: TICKET_ID, status: 'closed' });

      put().flush(resolved);
      http.expectOne(MY_TEAM_API).flush(atlas);
      http.expectOne(memberTicketsApi('sam.rivera')).flush([resolved]);
    });
  });
});
