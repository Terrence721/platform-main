import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TicketDto } from '@helpdesk/contract';
import { Subject } from 'rxjs';
import { type LiveUpdate, LiveUpdates } from '../live/live-updates';
import { Sounds } from '../sound/sounds';
import { assigneeApi, statusApi } from '../tickets/ticket-api-paths';
import {
  FINISHED_API,
  MY_TICKETS_API,
  MyTicketsStore,
  STATUS_UNAVAILABLE_MESSAGE,
  TAKE_UNAVAILABLE_MESSAGE,
  UNASSIGNED_API,
} from './my-tickets.store';

/** A ticket with just what these tests look at. */
const ticket = (ticketNumber: number) =>
  ({ id: `ticket-${ticketNumber}`, ticketNumber }) as TicketDto;

describe('MyTicketsStore', () => {
  let http: HttpTestingController;
  /** The live updates the store hears, sent by the test. */
  let live: Subject<LiveUpdate>;
  /** A stand-in for the sounds, to hear which play. */
  const sounds = { play: vi.fn() };

  beforeEach(() => {
    live = new Subject<LiveUpdate>();
    sounds.play.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MyTicketsStore,
        { provide: LiveUpdates, useValue: { updates: live } },
        { provide: Sounds, useValue: sounds },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Tests about one list leave the other lists' loads unanswered.
    for (const url of [UNASSIGNED_API, FINISHED_API]) {
      for (const request of http.match(url)) {
        if (!request.cancelled) {
          request.flush([]);
        }
      }
    }
    http.verify();
  });

  /** The ticket numbers the store holds, in its order. */
  const numbers = (store: InstanceType<typeof MyTicketsStore>) =>
    store.entities().map(({ ticketNumber }) => ticketNumber);

  it("starts loading the agent's tickets as soon as it is created", () => {
    const store = TestBed.inject(MyTicketsStore);

    expect(store.loadState()).toBe('loading');
    expect(http.expectOne(MY_TICKETS_API).request.method).toBe('GET');
  });

  it('keeps the tickets in the order the API sends them', () => {
    const store = TestBed.inject(MyTicketsStore);

    http
      .expectOne(MY_TICKETS_API)
      .flush([ticket(1003), ticket(1006), ticket(1001)]);

    expect(store.loadState()).toBe('loaded');
    expect(numbers(store)).toEqual([1003, 1006, 1001]);
  });

  it('says loading failed, holding no tickets', () => {
    const store = TestBed.inject(MyTicketsStore);

    http
      .expectOne(MY_TICKETS_API)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.loadState()).toBe('failed');
    expect(store.entities()).toEqual([]);
  });

  it('lets a newer load replace one still running', () => {
    const store = TestBed.inject(MyTicketsStore);
    const first = http.expectOne(MY_TICKETS_API);

    store.load();
    const second = http.expectOne(MY_TICKETS_API);

    expect(first.cancelled).toBe(true);
    second.flush([ticket(1002)]);
    expect(numbers(store)).toEqual([1002]);
  });

  describe('unassigned', () => {
    it('loads the unassigned tickets too, as soon as it is created', () => {
      const store = TestBed.inject(MyTicketsStore);
      http.expectOne(MY_TICKETS_API).flush([]);

      expect(store.unassignedState()).toBe('loading');
      http.expectOne(UNASSIGNED_API).flush([ticket(1312), ticket(1290)]);

      expect(store.unassignedState()).toBe('loaded');
      expect(
        store.unassigned().map(({ ticketNumber }) => ticketNumber)
      ).toEqual([1312, 1290]);
    });

    it('says loading them failed', () => {
      const store = TestBed.inject(MyTicketsStore);
      http.expectOne(MY_TICKETS_API).flush([]);

      http
        .expectOne(UNASSIGNED_API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.unassignedState()).toBe('failed');
    });
  });

  describe('take', () => {
    const taken = {
      ...ticket(1312),
      assignee: { id: 'sam.rivera', name: 'Sam Rivera' },
    } as TicketDto;

    /** A store with both lists loaded, as the page has them. */
    function loadedStore() {
      const store = TestBed.inject(MyTicketsStore);
      http.expectOne(MY_TICKETS_API).flush([ticket(1003)]);
      http.expectOne(UNASSIGNED_API).flush([ticket(1312), ticket(1290)]);
      return store;
    }

    const put = () =>
      http.expectOne({ method: 'PUT', url: assigneeApi('ticket-1312') });

    it('starts with nothing taken', () => {
      const store = loadedStore();

      expect(store.takeState()).toBe('idle');
      expect(store.takeError()).toBeNull();
    });

    it("sends the agent's own user ID, saving until the API answers", () => {
      const store = loadedStore();

      store.take({ ticketId: 'ticket-1312', agentId: 'sam.rivera' });

      expect(store.takeState()).toBe('saving');
      const call = put();
      expect(call.request.body).toEqual({ assigneeId: 'sam.rivera' });
      call.flush(taken);
      http.expectOne(MY_TICKETS_API).flush([taken, ticket(1003)]);
      http.expectOne(UNASSIGNED_API).flush([ticket(1290)]);
    });

    it('moves the ticket into My tickets, quietly, with no spinner', () => {
      const store = loadedStore();

      store.take({ ticketId: 'ticket-1312', agentId: 'sam.rivera' });
      put().flush(taken);
      http.expectOne(MY_TICKETS_API).flush([taken, ticket(1003)]);
      http.expectOne(UNASSIGNED_API).flush([ticket(1290)]);

      expect(store.loadState()).toBe('loaded');
      expect(numbers(store)).toEqual([1312, 1003]);
      expect(
        store.unassigned().map(({ ticketNumber }) => ticketNumber)
      ).toEqual([1290]);
      expect(store.takeState()).toBe('taken');
      expect(store.lastTaken()).toEqual(taken);
    });

    it("keeps the API's message when someone took it first", () => {
      const store = loadedStore();

      store.take({ ticketId: 'ticket-1312', agentId: 'sam.rivera' });
      put().flush(
        { message: 'Someone else has taken this ticket.' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(store.takeState()).toBe('failed');
      expect(store.takeError()).toBe('Someone else has taken this ticket.');
    });

    it('says taking is unavailable when the API cannot explain', () => {
      const store = loadedStore();

      store.take({ ticketId: 'ticket-1312', agentId: 'sam.rivera' });
      put().error(new ProgressEvent('error'));

      expect(store.takeError()).toBe(TAKE_UNAVAILABLE_MESSAGE);
    });

    it('ignores a second take while one is saving', () => {
      const store = loadedStore();

      store.take({ ticketId: 'ticket-1312', agentId: 'sam.rivera' });
      store.take({ ticketId: 'ticket-1312', agentId: 'sam.rivera' });

      put().flush(taken);
      http.expectOne(MY_TICKETS_API).flush([taken]);
      http.expectOne(UNASSIGNED_API).flush([]);
    });
  });

  describe('finished (Done)', () => {
    it('loads the recently finished tickets too, as soon as it is created', () => {
      const store = TestBed.inject(MyTicketsStore);
      http.expectOne(MY_TICKETS_API).flush([]);

      expect(store.finishedState()).toBe('loading');
      http.expectOne(FINISHED_API).flush([ticket(1290)]);

      expect(store.finishedState()).toBe('loaded');
      expect(store.finished().map(({ ticketNumber }) => ticketNumber)).toEqual([
        1290,
      ]);
    });

    it('says loading them failed', () => {
      const store = TestBed.inject(MyTicketsStore);
      http.expectOne(MY_TICKETS_API).flush([]);

      http
        .expectOne(FINISHED_API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.finishedState()).toBe('failed');
    });
  });

  describe('changeStatus', () => {
    const resolved = {
      ...ticket(1003),
      status: 'resolved',
    } as TicketDto;

    /** A store with all three lists loaded, as the page has them. */
    function loadedStore() {
      const store = TestBed.inject(MyTicketsStore);
      http.expectOne(MY_TICKETS_API).flush([ticket(1003), ticket(1006)]);
      http.expectOne(UNASSIGNED_API).flush([]);
      http.expectOne(FINISHED_API).flush([]);
      return store;
    }

    const put = () =>
      http.expectOne({ method: 'PUT', url: statusApi('ticket-1003') });

    it('starts with no change in progress', () => {
      const store = loadedStore();

      expect(store.statusState()).toBe('idle');
      expect(store.statusError()).toBeNull();
    });

    it('sends the status, saving until the API answers', () => {
      const store = loadedStore();

      store.changeStatus({ ticketId: 'ticket-1003', status: 'resolved' });

      expect(store.statusState()).toBe('saving');
      const call = put();
      expect(call.request.body).toEqual({ status: 'resolved' });
      call.flush(resolved);
      http.expectOne(MY_TICKETS_API).flush([ticket(1006)]);
      http.expectOne(FINISHED_API).flush([resolved]);
    });

    it('moves a resolved ticket into Done, quietly, with no spinner', () => {
      const store = loadedStore();

      store.changeStatus({ ticketId: 'ticket-1003', status: 'resolved' });
      put().flush(resolved);
      http.expectOne(MY_TICKETS_API).flush([ticket(1006)]);
      http.expectOne(FINISHED_API).flush([resolved]);

      expect(store.loadState()).toBe('loaded');
      expect(numbers(store)).toEqual([1006]);
      expect(store.finished()).toEqual([resolved]);
      expect(store.statusState()).toBe('changed');
      expect(store.lastChanged()).toEqual(resolved);
    });

    it("keeps the API's message for a move the workflow refuses", () => {
      const store = loadedStore();

      store.changeStatus({ ticketId: 'ticket-1003', status: 'new' });
      put().flush(
        { message: "An open ticket can't become new." },
        { status: 409, statusText: 'Conflict' }
      );

      expect(store.statusState()).toBe('failed');
      expect(store.statusError()).toBe("An open ticket can't become new.");
      expect(numbers(store)).toEqual([1003, 1006]);
    });

    it('says changing is unavailable when the API cannot explain', () => {
      const store = loadedStore();

      store.changeStatus({ ticketId: 'ticket-1003', status: 'resolved' });
      put().error(new ProgressEvent('error'));

      expect(store.statusError()).toBe(STATUS_UNAVAILABLE_MESSAGE);
    });

    it('ignores a second change while one is saving', () => {
      const store = loadedStore();

      store.changeStatus({ ticketId: 'ticket-1003', status: 'resolved' });
      store.changeStatus({ ticketId: 'ticket-1003', status: 'closed' });

      put().flush(resolved);
      http.expectOne(MY_TICKETS_API).flush([]);
      http.expectOne(FINISHED_API).flush([resolved]);
    });
  });

  describe('live updates', () => {
    /** A store with its three lists loaded, as the page has them. */
    function loaded() {
      const store = TestBed.inject(MyTicketsStore);
      http.expectOne(MY_TICKETS_API).flush([ticket(1001)]);
      http.expectOne(UNASSIGNED_API).flush([ticket(1005)]);
      http.expectOne(FINISHED_API).flush([]);
      return store;
    }

    const aTicketChanged: LiveUpdate = {
      kind: 'event',
      event: { type: 'ticket', ticketId: 'ticket-1005' },
    };

    it('fetches all three lists again, quietly, when a ticket changes', () => {
      const store = loaded();

      live.next(aTicketChanged);

      // No spinner while it loads: the lists stay as they are.
      expect(store.loadState()).toBe('loaded');
      expect(store.unassignedState()).toBe('loaded');
      http.expectOne(MY_TICKETS_API).flush([ticket(1001), ticket(1005)]);
      http.expectOne(UNASSIGNED_API).flush([]);
      http.expectOne(FINISHED_API).flush([ticket(990)]);
      expect(numbers(store)).toEqual([1001, 1005]);
      expect(store.unassigned()).toEqual([]);
      expect(store.finished()).toEqual([ticket(990)]);
    });

    it('fetches them again when the stream comes back after a break', () => {
      loaded();

      live.next({ kind: 'reconnected' });

      http.expectOne(MY_TICKETS_API).flush([]);
      http.expectOne(UNASSIGNED_API).flush([]);
      http.expectOne(FINISHED_API).flush([]);
    });

    it('leaves the lists alone for a reply or an account change', () => {
      loaded();

      live.next({
        kind: 'event',
        event: { type: 'message', ticketId: 'ticket-1001' },
      });
      live.next({ kind: 'event', event: { type: 'accounts' } });

      http.expectNone(MY_TICKETS_API);
      http.expectNone(UNASSIGNED_API);
    });

    it('keeps the lists as they are when fetching them again fails', () => {
      const store = loaded();

      live.next(aTicketChanged);
      http
        .expectOne(MY_TICKETS_API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.loadState()).toBe('loaded');
      expect(numbers(store)).toEqual([1001]);
      expect(store.unassigned()).toEqual([ticket(1005)]);
    });

    describe('the arrival sound', () => {
      /** Answers a refresh with these as My tickets. */
      function refreshWith(...mine: TicketDto[]) {
        http.expectOne(MY_TICKETS_API).flush(mine);
        http.expectOne(UNASSIGNED_API).flush([]);
        http.expectOne(FINISHED_API).flush([]);
      }

      it('dings when someone else gives the agent a ticket', () => {
        loaded();

        live.next(aTicketChanged);
        refreshWith(ticket(1001), ticket(1005));

        expect(sounds.play).toHaveBeenCalledExactlyOnceWith('arrival');
      });

      it('is quiet when no ticket came: one went, or one changed', () => {
        loaded();

        live.next(aTicketChanged);
        refreshWith();

        expect(sounds.play).not.toHaveBeenCalled();
      });

      it('is quiet for the ticket the agent is taking, even if its event comes first', () => {
        const store = loaded();

        store.take({ ticketId: 'ticket-1005', agentId: 'sam.rivera' });
        // The live event for the take arrives before the take finishes.
        live.next(aTicketChanged);
        refreshWith(ticket(1001), ticket(1005));

        expect(sounds.play).not.toHaveBeenCalled();
        http
          .expectOne({ method: 'PUT', url: assigneeApi('ticket-1005') })
          .flush(ticket(1005));
        http.expectOne(MY_TICKETS_API).flush([ticket(1001), ticket(1005)]);
        http.expectOne(UNASSIGNED_API).flush([]);
      });

      it('dings once for a ticket that came during a break in the stream', () => {
        loaded();

        live.next({ kind: 'reconnected' });
        refreshWith(ticket(1001), ticket(1005), ticket(1006));

        expect(sounds.play).toHaveBeenCalledExactlyOnceWith('arrival');
      });
    });
  });
});
