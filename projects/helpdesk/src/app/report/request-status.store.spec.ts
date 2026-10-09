import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RequestStatusResponse } from '@helpdesk/contract';
import {
  CHECK_UNAVAILABLE_MESSAGE,
  describeStatus,
  NO_MATCH_MESSAGE,
  REQUEST_STATUS_API,
  RequestStatusStore,
} from './request-status.store';

// Check my request (#1026): a customer's reference and email, and where
// their request is up to, in words.
describe('describeStatus', () => {
  it.each<[RequestStatusResponse, string]>([
    [
      { reference: 'R-1042', status: 'pending' },
      'R-1042 is waiting for our team.',
    ],
    [
      {
        reference: 'R-1042',
        status: 'ticket',
        ticketNumber: 1061,
        ticketStatus: 'new',
      },
      'R-1042 is now ticket #1061, which is New.',
    ],
    [
      { reference: 'R-1042', status: 'dismissed', reason: 'duplicate' },
      'R-1042 was closed: Already reported.',
    ],
  ])('says %j as %j', (answer, words) => {
    expect(describeStatus(answer)).toBe(words);
  });
});

describe('RequestStatusStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof RequestStatusStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        RequestStatusStore,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(RequestStatusStore);
  });

  afterEach(() => http.verify());

  const asked = () =>
    http.expectOne(
      ({ method, url }) => method === 'GET' && url === REQUEST_STATUS_API
    );

  it('starts with nothing checked', () => {
    expect(store.checkState()).toBe('idle');
    expect(store.answer()).toBeNull();
  });

  it('asks with the reference and email, then says where the request is up to', () => {
    store.check({ reference: 'R-1042', email: 'dana@example.com' });

    expect(store.checkState()).toBe('checking');
    const call = asked();
    expect(call.request.params.get('reference')).toBe('R-1042');
    expect(call.request.params.get('email')).toBe('dana@example.com');
    call.flush({ reference: 'R-1042', status: 'pending' });

    expect(store.checkState()).toBe('done');
    expect(store.answer()).toBe('R-1042 is waiting for our team.');
  });

  it('says no request matches, the same for a wrong email as for no such reference (404)', () => {
    store.check({ reference: 'R-1042', email: 'someone@example.com' });
    asked().flush(
      { message: 'No request matches that reference and email.' },
      { status: 404, statusText: 'Not Found' }
    );

    expect(store.checkState()).toBe('done');
    expect(store.answer()).toBe(NO_MATCH_MESSAGE);
  });

  it('says when to try again after too many checks (429)', () => {
    store.check({ reference: 'R-1042', email: 'dana@example.com' });
    asked().flush(
      { message: 'Too many checks from here. Please try again later.' },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '600' },
      }
    );

    expect(store.checkState()).toBe('failed');
    expect(store.answer()).toBe(
      'Too many checks from here. Please try again in about 10 minutes.'
    );
  });

  it('says checking is unavailable when the API cannot be reached', () => {
    store.check({ reference: 'R-1042', email: 'dana@example.com' });
    asked().error(new ProgressEvent('error'));

    expect(store.checkState()).toBe('failed');
    expect(store.answer()).toBe(CHECK_UNAVAILABLE_MESSAGE);
  });

  it('lets a newer check replace one still on its way', () => {
    store.check({ reference: 'R-1041', email: 'dana@example.com' });
    const first = asked();

    store.check({ reference: 'R-1042', email: 'dana@example.com' });

    expect(first.cancelled).toBe(true);
    asked().flush({ reference: 'R-1042', status: 'pending' });
    expect(store.answer()).toBe('R-1042 is waiting for our team.');
  });
});
