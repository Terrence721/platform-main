import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TeamOverview, TicketDto } from '@helpdesk/contract';
import { Subject } from 'rxjs';
import { type LiveUpdate, LiveUpdates } from '../live/live-updates';
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
  /** The live updates the store hears, sent by the test. */
  let live: Subject<LiveUpdate>;

  beforeEach(() => {
    live = new Subject<LiveUpdate>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MyTeamStore,
        { provide: LiveUpdates, useValue: { updates: live } },
      ],
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

    it('says assigned when the assignment worked but fetching the team again failed', () => {
      const store = loadedStore();

      store.assign({ ticketId: TICKET_ID, agentId: 'sam.rivera' });
      put().flush(assigned);
      http
        .expectOne(MY_TEAM_API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.assignState()).toBe('assigned');
      expect(store.assignError()).toBeNull();
      expect(store.lastAssigned()).toEqual(assigned);
      // The team stays as it is until the next refresh.
      expect(store.team()).toEqual(atlas);
    });

    it('keeps the tickets of a member chosen while fetching again', () => {
      const benny = {
        id: 'benny.lind',
        name: 'Benny Lind',
        openTickets: 1,
        overdueTickets: 0,
      };
      const store = TestBed.inject(MyTeamStore);
      http
        .expectOne(MY_TEAM_API)
        .flush({ ...atlas, members: [...atlas.members, benny] });
      store.selectMember('sam.rivera');
      http.expectOne(memberTicketsApi('sam.rivera')).flush([]);

      store.assign({ ticketId: TICKET_ID, agentId: 'sam.rivera' });
      put().flush(assigned);
      // The supervisor chooses Benny while the lists are fetched again.
      store.selectMember('benny.lind');
      const bennyTicket = { ...assigned, ticketNumber: 1290 } as TicketDto;
      http.expectOne(memberTicketsApi('benny.lind')).flush([bennyTicket]);
      http
        .expectOne(MY_TEAM_API)
        .flush({ ...atlasAfter, members: [...atlasAfter.members, benny] });
      for (const late of http.match(memberTicketsApi('sam.rivera'))) {
        late.flush([assigned]);
      }

      expect(store.selectedMemberId()).toBe('benny.lind');
      expect(store.memberTickets()).toEqual([bennyTicket]);
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

    it('says changed when the change worked but fetching the team again failed', () => {
      const store = storeWithSam();

      store.changeStatus({ ticketId: TICKET_ID, status: 'resolved' });
      put().flush(resolved);
      http
        .expectOne(MY_TEAM_API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.statusState()).toBe('changed');
      expect(store.statusError()).toBeNull();
      expect(store.lastChanged()).toEqual(resolved);
      // Sam's tickets stay as they are until the next refresh.
      expect(store.memberTickets()).toEqual([{ ...resolved, status: 'open' }]);
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

  describe('live updates', () => {
    /** A ticket with just what these tests look at. */
    const ticket = (ticketNumber: number) =>
      ({ id: `ticket-${ticketNumber}`, ticketNumber }) as TicketDto;

    /** The store with Atlas loaded and Sam chosen, as the page has it. */
    function withSamChosen() {
      const store = TestBed.inject(MyTeamStore);
      http.expectOne(MY_TEAM_API).flush(atlas);
      store.selectMember('sam.rivera');
      http.expectOne(memberTicketsApi('sam.rivera')).flush([ticket(1001)]);
      return store;
    }

    const event = (type: 'ticket' | 'message' | 'accounts'): LiveUpdate => ({
      kind: 'event',
      event: type === 'accounts' ? { type } : { type, ticketId: 'ticket-1001' },
    });

    it.each([
      ['a ticket changes', event('ticket')],
      ['accounts change', event('accounts')],
      ['the stream comes back after a break', { kind: 'reconnected' }],
    ] as [string, LiveUpdate][])(
      'fetches the team and the chosen member again, quietly, when %s',
      (_, update) => {
        const store = withSamChosen();
        const busier = {
          ...atlas,
          unassigned: [ticket(1005)],
        } as TeamOverview;

        live.next(update);

        expect(store.loadState()).toBe('loaded');
        expect(store.memberTicketsState()).toBe('loaded');
        http.expectOne(MY_TEAM_API).flush(busier);
        http
          .expectOne(memberTicketsApi('sam.rivera'))
          .flush([ticket(1001), ticket(1002)]);
        expect(store.team()).toEqual(busier);
        expect(store.memberTickets()).toEqual([ticket(1001), ticket(1002)]);
      }
    );

    it('leaves it alone for a reply', () => {
      withSamChosen();

      live.next(event('message'));

      http.expectNone(MY_TEAM_API);
    });

    it('chooses nobody when the chosen member has left the team', () => {
      const store = withSamChosen();

      live.next(event('accounts'));
      http.expectOne(MY_TEAM_API).flush({ ...atlas, members: [] });

      expect(store.selectedMemberId()).toBeNull();
      expect(store.memberTickets()).toEqual([]);
      expect(store.memberTicketsState()).toBe('idle');
    });

    it('shows the team once the supervisor leads one again', () => {
      const store = TestBed.inject(MyTeamStore);
      http
        .expectOne(MY_TEAM_API)
        .flush(null, { status: 404, statusText: 'Not Found' });
      expect(store.loadState()).toBe('no-team');

      live.next(event('accounts'));
      http.expectOne(MY_TEAM_API).flush(atlas);

      expect(store.loadState()).toBe('loaded');
      expect(store.team()).toEqual(atlas);
    });

    it('keeps what is shown when fetching it again fails', () => {
      const store = withSamChosen();

      live.next(event('ticket'));
      http
        .expectOne(MY_TEAM_API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.team()).toEqual(atlas);
      expect(store.memberTickets()).toEqual([ticket(1001)]);
    });
  });
});
