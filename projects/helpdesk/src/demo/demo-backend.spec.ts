import {
  FetchBackend,
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpResponse,
  provideHttpClient,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import type { DemoApi, DemoRequest, DemoResponse } from './demo-api';
import { DEMO_API, DemoBackend } from './demo-backend';

describe('DemoBackend', () => {
  /** What the demo's API answers, and what it was asked. */
  let answer: DemoResponse;
  const asked: DemoRequest[] = [];
  const api = {
    handle: async (request: DemoRequest) => {
      asked.push(request);
      return answer;
    },
  } as DemoApi;
  /** Stands in for the network, to see what still goes there. */
  const network = {
    handle: vi.fn(() => of(new HttpResponse({ status: 200, body: 'file' }))),
  };

  /** HttpClient as the demo sets it up, the API ready once `ready` resolves. */
  function setUp(ready: Promise<DemoApi> = Promise.resolve(api)) {
    asked.length = 0;
    network.handle.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: HttpBackend, useClass: DemoBackend },
        { provide: DEMO_API, useValue: ready },
        { provide: FetchBackend, useValue: network },
      ],
    });
    return TestBed.inject(HttpClient);
  }

  it("answers the API's requests from the demo's API, with its body", async () => {
    answer = { status: 200, body: [{ id: 'ticket-1' }] };
    const http = setUp();

    expect(await firstValueFrom(http.get('/api/tickets/mine'))).toEqual([
      { id: 'ticket-1' },
    ]);
    expect(asked).toEqual([
      { method: 'GET', url: '/api/tickets/mine', body: null },
    ]);
    expect(network.handle).not.toHaveBeenCalled();
  });

  it('passes on the method, the query and the body', async () => {
    answer = { status: 201, body: { id: 'message-1' } };
    const http = setUp();

    await firstValueFrom(
      http.post(
        '/api/tickets/ticket-1/messages',
        { kind: 'note', body: 'Checked.' },
        { params: { page: 2 } }
      )
    );

    expect(asked).toEqual([
      {
        method: 'POST',
        url: '/api/tickets/ticket-1/messages?page=2',
        body: { kind: 'note', body: 'Checked.' },
      },
    ]);
  });

  // Customers' files (#1026): bytes, not JSON, as the API sends them.
  it("gives a file's bytes as the Blob they are, with its type and name", async () => {
    const file = new Blob(['Rows: 1,000'], { type: 'text/plain' });
    answer = {
      status: 200,
      body: file,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': "attachment; filename*=UTF-8''rows.txt",
      },
    };
    const http = setUp();

    const response = await firstValueFrom(
      http.get('/api/attachments/file-1', {
        responseType: 'blob',
        observe: 'response',
      })
    );

    expect(response.body).toBe(file);
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8'
    );
    expect(response.headers.get('content-disposition')).toBe(
      "attachment; filename*=UTF-8''rows.txt"
    );
  });

  it('passes a form with files on as it is', async () => {
    answer = { status: 201, body: { reference: 'R-1005' } };
    const http = setUp();
    const form = new FormData();
    form.append('request', '{}');

    await firstValueFrom(http.post('/api/requests', form));

    expect(asked[0].body).toBe(form);
  });

  it('turns a refusal into the HttpErrorResponse the app expects', async () => {
    answer = {
      status: 409,
      body: {
        statusCode: 409,
        message: "A closed ticket can't change.",
        error: 'Conflict',
      },
    };
    const http = setUp();

    const error = await firstValueFrom(
      http.put('/api/tickets/ticket-1/status', { status: 'open' })
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(error).toMatchObject({
      status: 409,
      error: { message: "A closed ticket can't change." },
    });
  });

  it('sends the answer through JSON, as the network would', async () => {
    answer = {
      status: 200,
      body: { at: new Date('2026-10-04T12:00:00.000Z'), gone: undefined },
    };
    const http = setUp();

    expect(await firstValueFrom(http.get('/api/anything'))).toEqual({
      at: '2026-10-04T12:00:00.000Z',
    });
  });

  it('waits for the demo to be ready before answering', async () => {
    answer = { status: 200, body: { user: null } };
    let ready!: (value: DemoApi) => void;
    const http = setUp(new Promise((resolve) => (ready = resolve)));

    let answered = false;
    const reply = firstValueFrom(http.get('/api/auth/me')).then((body) => {
      answered = true;
      return body;
    });
    await Promise.resolve();
    expect(answered).toBe(false);

    ready(api);
    expect(await reply).toEqual({ user: null });
  });

  it('sends everything else over the network, as usual', async () => {
    const http = setUp();

    expect(
      await firstValueFrom(
        http.get('assets/hero.jpg', { responseType: 'text' })
      )
    ).toBe('file');
    expect(asked).toEqual([]);
    expect(network.handle).toHaveBeenCalledOnce();
  });
});
