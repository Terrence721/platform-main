import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type {
  PendingRequest,
  QueueSummary,
  TicketDto,
} from '@helpdesk/contract';
import { Subject } from 'rxjs';
import { type LiveUpdate, LiveUpdates } from '../live/live-updates';
import { Sounds } from '../sound/sounds';
import {
  DECIDE_UNAVAILABLE_MESSAGE,
  NEW_REQUESTS_API,
  NewRequestsStore,
  QUEUES_API,
} from './new-requests.store';

/** A pending request with just what these tests look at. */
const waiting = (id: string) =>
  ({ id, reference: `R-${id}`, subject: id }) as PendingRequest;

const QUEUES: QueueSummary[] = [
  { id: 'billing', name: 'Billing' },
  { id: 'technical', name: 'Technical support' },
];

const ticket = { id: 'ticket-1', ticketNumber: 1061 } as TicketDto;

// Supervisors' New requests (#1026): the pending requests and the queues,
// kept current, and the decisions on them.
describe('NewRequestsStore', () => {
  let http: HttpTestingController;
  let live: Subject<LiveUpdate>;
  const sounds = { play: vi.fn() };

  beforeEach(() => {
    sounds.play.mockClear();
    live = new Subject<LiveUpdate>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NewRequestsStore,
        { provide: LiveUpdates, useValue: { updates: live } },
        { provide: Sounds, useValue: sounds },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ids = (store: InstanceType<typeof NewRequestsStore>) =>
    store.entities().map(({ id }) => id);

  /** Answers a load: these requests, and the queues. */
  function answer(requestIds: string[]) {
    http
      .expectOne({ method: 'GET', url: NEW_REQUESTS_API })
      .flush(requestIds.map(waiting));
    http.expectOne({ method: 'GET', url: QUEUES_API }).flush(QUEUES);
  }

  /** A store with these requests loaded, as the page has it. */
  function loadedStore(...requestIds: string[]) {
    const store = TestBed.inject(NewRequestsStore);
    answer(requestIds);
    return store;
  }

  it('loads the pending requests and the queues as soon as it is created', () => {
    const store = TestBed.inject(NewRequestsStore);

    expect(store.loadState()).toBe('loading');
    answer(['1001', '1002']);

    expect(store.loadState()).toBe('loaded');
    expect(ids(store)).toEqual(['1001', '1002']);
    expect(store.queues()).toEqual(QUEUES);
  });

  it('says loading failed', () => {
    const store = TestBed.inject(NewRequestsStore);
    const queues = http.expectOne(QUEUES_API);

    http
      .expectOne(NEW_REQUESTS_API)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.loadState()).toBe('failed');
    expect(queues.cancelled).toBe(true);
  });

  describe('turnIntoTicket', () => {
    const post = () =>
      http.expectOne({
        method: 'POST',
        url: `${NEW_REQUESTS_API}/1001/ticket`,
      });

    it('sends the queue and priority, then takes the request off the list', () => {
      const store = loadedStore('1001', '1002');

      store.turnIntoTicket({
        requestId: '1001',
        request: { queueId: 'billing', priority: 'high' },
      });

      expect(store.decideState()).toBe('saving');
      const call = post();
      expect(call.request.body).toEqual({
        queueId: 'billing',
        priority: 'high',
      });
      call.flush(ticket, { status: 201, statusText: 'Created' });

      expect(store.decideState()).toBe('done');
      expect(store.ticket()).toEqual(ticket);
      expect(ids(store)).toEqual(['1002']);
    });

    // Another supervisor decided it first: the API says so, and the list
    // loads again, so it goes.
    it("keeps the API's words when someone decided it first (409), and loads again", () => {
      const store = loadedStore('1001', '1002');

      store.turnIntoTicket({
        requestId: '1001',
        request: { queueId: 'billing', priority: 'high' },
      });
      post().flush(
        { message: 'Someone has decided this request already.' },
        { status: 409, statusText: 'Conflict' }
      );

      expect(store.decideState()).toBe('failed');
      expect(store.decideError()).toBe(
        'Someone has decided this request already.'
      );
      answer(['1002']);
      expect(ids(store)).toEqual(['1002']);
    });

    it('says deciding is unavailable when the API cannot explain', () => {
      const store = loadedStore('1001');

      store.turnIntoTicket({
        requestId: '1001',
        request: { queueId: 'billing', priority: 'high' },
      });
      post().error(new ProgressEvent('error'));
      // It loads again, in case someone decided it first.
      answer(['1001']);

      expect(store.decideError()).toBe(DECIDE_UNAVAILABLE_MESSAGE);
      expect(ids(store)).toEqual(['1001']);
    });
  });

  describe('dismiss', () => {
    it('sends why, then takes the request off the list', () => {
      const store = loadedStore('1001', '1002');

      store.dismiss({
        requestId: '1002',
        request: { reason: 'spam', duplicateOfTicketNumber: null },
      });
      const call = http.expectOne({
        method: 'POST',
        url: `${NEW_REQUESTS_API}/1002/dismiss`,
      });
      expect(call.request.body).toEqual({
        reason: 'spam',
        duplicateOfTicketNumber: null,
      });
      call.flush(null, { status: 204, statusText: 'No Content' });

      expect(store.decideState()).toBe('done');
      expect(ids(store)).toEqual(['1001']);
    });
  });

  it('starts a new decision with nothing pending', () => {
    const store = loadedStore('1001');
    store.dismiss({
      requestId: '1001',
      request: { reason: 'spam', duplicateOfTicketNumber: null },
    });
    http
      .expectOne(`${NEW_REQUESTS_API}/1001/dismiss`)
      .flush(null, { status: 204, statusText: 'No Content' });

    store.resetDecision();

    expect(store.decideState()).toBe('idle');
    expect(store.decideError()).toBeNull();
    expect(store.ticket()).toBeNull();
  });

  describe('live updates', () => {
    const requestsChanged: LiveUpdate = {
      kind: 'event',
      event: { type: 'requests' },
    };

    it('loads again, quietly, when a request arrives or is decided elsewhere', () => {
      const store = loadedStore('1001', '1002');

      live.next(requestsChanged);

      expect(store.loadState()).toBe('loaded');
      answer(['1002']);
      expect(ids(store)).toEqual(['1002']);
    });

    it('plays the arrival tone when a new request comes in', () => {
      loadedStore('1001');

      live.next(requestsChanged);
      answer(['1001', '1003']);

      expect(sounds.play).toHaveBeenCalledExactlyOnceWith('arrival');
    });

    it('plays nothing when one is only taken off', () => {
      loadedStore('1001', '1002');

      live.next(requestsChanged);
      answer(['1002']);

      expect(sounds.play).not.toHaveBeenCalled();
    });

    // Nothing has arrived: the page only now shows what was there.
    it('plays nothing for the first load', () => {
      loadedStore('1001', '1002');

      expect(sounds.play).not.toHaveBeenCalled();
    });

    it('loads again when the stream comes back after a break', () => {
      loadedStore('1001');

      live.next({ kind: 'reconnected' });

      answer(['1001']);
    });

    it('leaves the list alone for a ticket or an account', () => {
      loadedStore('1001');

      live.next({ kind: 'event', event: { type: 'ticket', ticketId: 't-1' } });
      live.next({ kind: 'event', event: { type: 'accounts' } });

      http.expectNone(NEW_REQUESTS_API);
    });
  });
});
