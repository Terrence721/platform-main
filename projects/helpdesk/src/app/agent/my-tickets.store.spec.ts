import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { TicketDto } from '@helpdesk/contract';
import { MY_TICKETS_API, MyTicketsStore } from './my-tickets.store';

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

  afterEach(() => http.verify());

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
});
