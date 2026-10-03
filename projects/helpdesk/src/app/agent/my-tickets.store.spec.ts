import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TicketDto } from '@helpdesk/contract';
import { assigneeApi } from '../supervisor/my-team.store';
import {
  MY_TICKETS_API,
  MyTicketsStore,
  TAKE_UNAVAILABLE_MESSAGE,
  UNASSIGNED_API,
} from './my-tickets.store';

/** A ticket with just what these tests look at. */
const ticket = (ticketNumber: number) =>
  ({ id: `ticket-${ticketNumber}`, ticketNumber }) as TicketDto;

describe('MyTicketsStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MyTicketsStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Tests about My tickets leave the Unassigned load unanswered.
    for (const request of http.match(UNASSIGNED_API)) {
      if (!request.cancelled) {
        request.flush([]);
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
});
