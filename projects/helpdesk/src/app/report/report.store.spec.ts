import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type CreateRequestRequest,
  REQUEST_FIELDS_PART,
  REQUEST_FILES_PART,
} from '@helpdesk/contract';
import {
  REPORT_API,
  ReportStore,
  SEND_UNAVAILABLE_MESSAGE,
  tryAgainIn,
} from './report.store';

/** The public form's body, as the page sends it. */
const SENT: CreateRequestRequest = {
  name: 'Dana Whitfield',
  email: 'dana@example.com',
  category: 'billing',
  impact: 'blocked',
  subject: 'Charged twice',
  description: 'My card was charged twice this month.',
  where: null,
  consent: true,
  website: '',
  fillMilliseconds: 45_000,
};

/** What the page hands the store: the form's body, and any files. */
const sending = (files: readonly File[] = []) => ({ request: SENT, files });

// The Report an issue page's store (#1026): it sends the form and keeps
// where the sending is up to.
describe('ReportStore', () => {
  let http: HttpTestingController;
  let store: InstanceType<typeof ReportStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReportStore],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ReportStore);
  });

  afterEach(() => http.verify());

  const post = () => http.expectOne({ method: 'POST', url: REPORT_API });

  it('starts with nothing sent', () => {
    expect(store.sendState()).toBe('idle');
    expect(store.reference()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('sends the form, sending until the API answers, then keeps the reference', () => {
    store.send(sending());

    expect(store.sendState()).toBe('sending');
    const call = post();
    expect(call.request.body).toEqual(SENT);
    call.flush({ reference: 'R-1042' }, { status: 201, statusText: 'Created' });

    expect(store.sendState()).toBe('sent');
    expect(store.reference()).toBe('R-1042');
  });

  // With files (#1026): as the API takes them, the fields as JSON in one
  // part and each file in a "files" part.
  it('sends the files with the form, as multipart', async () => {
    const photo = new File(['photo'], 'Zoë photo.jpg', { type: 'image/jpeg' });
    const rows = new File(['Rows: 1,000'], 'rows.csv', { type: 'text/csv' });

    store.send(sending([photo, rows]));

    const call = post();
    const body = call.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(JSON.parse(body.get(REQUEST_FIELDS_PART) as string)).toEqual(SENT);
    expect(
      body.getAll(REQUEST_FILES_PART).map((file) => (file as File).name)
    ).toEqual(['Zoë photo.jpg', 'rows.csv']);
    call.flush({ reference: 'R-1043' }, { status: 201, statusText: 'Created' });
    expect(store.reference()).toBe('R-1043');
  });

  it("keeps the API's own words for a file it refuses (400)", () => {
    store.send(sending([new File(['x'], 'shot.png', { type: 'image/png' })]));
    post().flush(
      { message: '"shot.png" couldn\'t be read as an image.' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(store.error()).toBe('"shot.png" couldn\'t be read as an image.');
  });

  it("keeps the API's own words for a field it refuses (400)", () => {
    store.send(sending());
    post().flush(
      { message: 'Enter your email address, such as dana@example.com.' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(store.sendState()).toBe('failed');
    expect(store.error()).toBe(
      'Enter your email address, such as dana@example.com.'
    );
  });

  it('says when to try again after too many requests (429)', () => {
    store.send(sending());
    post().flush(
      { message: 'Too many requests from here. Please try again later.' },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '1800' },
      }
    );

    expect(store.error()).toBe(
      'Too many requests from here. Please try again in about 30 minutes.'
    );
  });

  it('says sending is unavailable when the API cannot explain', () => {
    store.send(sending());
    post().error(new ProgressEvent('error'));

    expect(store.error()).toBe(SEND_UNAVAILABLE_MESSAGE);
  });

  it('ignores a second send while the first is on its way', () => {
    store.send(sending());
    store.send(sending());

    post().flush(
      { reference: 'R-1042' },
      { status: 201, statusText: 'Created' }
    );
  });

  it('starts again for another request', () => {
    store.send(sending());
    post().flush(
      { reference: 'R-1042' },
      { status: 201, statusText: 'Created' }
    );

    store.reset();

    expect(store.sendState()).toBe('idle');
    expect(store.reference()).toBeNull();
  });
});

describe('tryAgainIn', () => {
  it.each([
    [null, 'later'],
    [30, 'in a minute'],
    [60, 'in a minute'],
    [61, 'in about 2 minutes'],
    [1800, 'in about 30 minutes'],
    [3000, 'in about an hour'],
    [3600, 'in about an hour'],
    [7200, 'in about 2 hours'],
  ])('says %j seconds as %j', (seconds, words) => {
    expect(tryAgainIn(seconds)).toBe(words);
  });
});
