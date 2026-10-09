import type {
  CreateRequestRequest,
  CurrentUser,
  PendingRequest,
  RequestStatusResponse,
  Role,
  TicketDto,
} from '@helpdesk/contract';
import {
  ATTACHMENT_MAX_BYTES,
  REQUEST_FIELDS_PART,
  REQUEST_FILES_PART,
} from '@helpdesk/contract';
import {
  AttachmentsService,
  CustomerRequestsService,
  type UploadedFile,
} from '@helpdesk/server';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { CustomerRequestsController } from './customer-requests.controller';
import {
  MAX_SENDS,
  MAX_STATUS_CHECKS,
  MIN_FILL_MS,
  RequestLimits,
} from './request-limits';

/** One user per role; each one's session token is their role's name. */
const USERS: Record<Role, CurrentUser> = {
  agent: {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    teamId: 'atlas',
  },
  supervisor: {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    teamId: 'atlas',
  },
  admin: {
    id: 'alex.morgan',
    name: 'Alex Morgan',
    role: 'admin',
    teamId: null,
  },
};

/** Recognizes a session token named after a role as that role's user. */
const fakeAuth = {
  currentUser: async (token: string | undefined) =>
    Object.values(USERS).find(({ role }) => role === token) ?? null,
};

/** The public form's body, as a person sends it. */
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

const waiting = { id: 'request-1', reference: 'R-1001' } as PendingRequest;
const newTicket = { id: 'ticket-1', ticketNumber: 1042 } as TicketDto;

// Customer requests (#1026): anyone may send one and check on it; the
// supervisors decide them.
describe('/api/requests', () => {
  const service = {
    send: vi.fn(async () => ({ reference: 'R-1001' })),
    statusOf: vi.fn(async (): Promise<RequestStatusResponse | null> => ({
      reference: 'R-1001',
      status: 'pending',
    })),
    pending: vi.fn(async () => [waiting]),
    turnIntoTicket: vi.fn(async () => newTicket),
    dismiss: vi.fn(async () => undefined),
  };
  /** Checks files as the real one does (tested with it): here, as given. */
  const attachments = {
    prepare: vi.fn(async (files: readonly UploadedFile[]) =>
      files.map(({ name, bytes }) => ({
        fileName: name,
        mediaType: 'text/plain' as const,
        content: bytes,
      }))
    ),
  };
  let app: NestExpressApplication;
  let base: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerRequestsController],
      providers: [
        AuthGuard,
        RequestLimits,
        { provide: AuthService, useValue: fakeAuth },
        { provide: CustomerRequestsService, useValue: service },
        { provide: AttachmentsService, useValue: attachments },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    // As main.ts sets the app up.
    app.set('trust proxy', 1);
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/requests`;
  });

  afterEach(async () => {
    await app.close();
  });

  /** Calls `path` under /api/requests, as `role` or signed out, from `from`. */
  const call = (
    method: 'GET' | 'POST',
    path: string,
    {
      role = null,
      body,
      from = '203.0.113.7',
    }: { role?: Role | null; body?: unknown; from?: string } = {}
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        // The visitor's address, as nginx passes it on.
        'x-forwarded-for': from,
        ...(role === null ? {} : { cookie: `${SESSION_COOKIE}=${role}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  describe('POST / (public)', () => {
    it('keeps a request anyone sends, and answers 201 with its reference only', async () => {
      const response = await call('POST', '', { body: SENT });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ reference: 'R-1001' });
      expect(service.send).toHaveBeenCalledExactlyOnceWith(
        SENT,
        expect.any(Date),
        []
      );
      expect(attachments.prepare).not.toHaveBeenCalled();
    });

    it('refuses a wrong field with 400, saying what is expected, keeping nothing', async () => {
      const response = await call('POST', '', {
        body: { ...SENT, email: 'dana' },
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        message: 'Enter your email address, such as dana@example.com.',
      });
      expect(service.send).not.toHaveBeenCalled();
    });

    // So a bot cannot tell it was caught.
    it.each([
      ['a filled honeypot', { website: 'https://spam.example' }],
      ['a form sent too fast', { fillMilliseconds: MIN_FILL_MS - 1 }],
    ])('answers %s as if it worked, keeping nothing', async (_, changes) => {
      const response = await call('POST', '', {
        body: { ...SENT, ...changes },
      });

      expect(response.status).toBe(201);
      expect(
        ((await response.json()) as { reference: string }).reference
      ).toMatch(/^R-\d+$/);
      expect(service.send).not.toHaveBeenCalled();
    });

    it(`answers 429 with Retry-After after ${MAX_SENDS} from one address, not another`, async () => {
      for (let i = 0; i < MAX_SENDS; i++) {
        expect((await call('POST', '', { body: SENT })).status).toBe(201);
      }

      const refused = await call('POST', '', { body: SENT });

      expect(refused.status).toBe(429);
      expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(service.send).toHaveBeenCalledTimes(MAX_SENDS);
      expect(
        (await call('POST', '', { body: SENT, from: '198.51.100.20' })).status
      ).toBe(201);
    });
  });

  // A request with files (#1026): the fields as JSON in one part, each
  // file in a "files" part, as the form's FormData sends them.
  describe('POST / with files (public)', () => {
    /** Text bytes, as a file's contents. */
    const text = (content: string) => new TextEncoder().encode(content);

    /** Sends `fields` (as JSON, or as given) and `files` as multipart. */
    const sendWith = (
      files: { name: string; content: Uint8Array; part?: string }[],
      fields: unknown = SENT
    ) => {
      const form = new FormData();
      if (fields !== null) {
        form.append(
          REQUEST_FIELDS_PART,
          typeof fields === 'string' ? fields : JSON.stringify(fields)
        );
      }
      for (const { name, content, part = REQUEST_FILES_PART } of files) {
        form.append(part, new Blob([content]), name);
      }
      return fetch(base, {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.7' },
        body: form,
      });
    };

    /** The 400's message, after checking nothing was kept. */
    const refusal = async (response: Response) => {
      expect(response.status).toBe(400);
      expect(service.send).not.toHaveBeenCalled();
      return ((await response.json()) as { message: string }).message;
    };

    it('checks the files and keeps them with the request', async () => {
      const response = await sendWith([
        { name: 'rows.txt', content: text('Rows: 1,000') },
        { name: 'steps.txt', content: text('Export, then count') },
      ]);

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ reference: 'R-1001' });
      expect(attachments.prepare).toHaveBeenCalledExactlyOnceWith([
        { name: 'rows.txt', bytes: text('Rows: 1,000') },
        { name: 'steps.txt', bytes: text('Export, then count') },
      ]);
      expect(service.send).toHaveBeenCalledExactlyOnceWith(
        SENT,
        expect.any(Date),
        await attachments.prepare.mock.results[0].value
      );
    });

    it('reads a file name in any language', async () => {
      await sendWith([{ name: 'Zoë’s 東京 notes.txt', content: text('Hi') }]);

      expect(attachments.prepare.mock.calls[0][0][0].name).toBe(
        'Zoë’s 東京 notes.txt'
      );
    });

    it('keeps a request sent as multipart with no files', async () => {
      expect((await sendWith([])).status).toBe(201);
      expect(service.send).toHaveBeenCalledExactlyOnceWith(
        SENT,
        expect.any(Date),
        []
      );
    });

    it('checks nothing for spam, and keeps nothing', async () => {
      const response = await sendWith(
        [{ name: 'rows.txt', content: text('Rows') }],
        { ...SENT, website: 'https://spam.example' }
      );

      expect(response.status).toBe(201);
      expect(attachments.prepare).not.toHaveBeenCalled();
      expect(service.send).not.toHaveBeenCalled();
    });

    it("passes on the files' refusal", async () => {
      attachments.prepare.mockRejectedValueOnce(
        new BadRequestException(
          '"tool.exe" isn\'t a PNG, JPEG, WebP, PDF or text file.'
        )
      );

      const response = await sendWith([
        { name: 'tool.exe', content: text('MZ') },
      ]);

      expect(await refusal(response)).toBe(
        '"tool.exe" isn\'t a PNG, JPEG, WebP, PDF or text file.'
      );
    });

    it.each([
      ['no fields part', null],
      ['fields that are not JSON', 'name=Dana'],
    ])('refuses %s', async (_, fields) => {
      expect(
        await refusal(
          await sendWith([{ name: 'rows.txt', content: text('Rows') }], fields)
        )
      ).toBe('Send the request\'s fields as JSON, in a "request" part.');
    });

    it('refuses more than 3 files, reading no more', async () => {
      const four = Array.from({ length: 4 }, (_, index) => ({
        name: `${index}.txt`,
        content: text('Rows'),
      }));

      expect(await refusal(await sendWith(four))).toBe(
        'Attach at most 3 files.'
      );
      expect(attachments.prepare).not.toHaveBeenCalled();
    });

    it('refuses a file over 5 MB with 400, not reading it all', async () => {
      const response = await sendWith([
        { name: 'huge.txt', content: new Uint8Array(ATTACHMENT_MAX_BYTES + 1) },
      ]);

      expect(await refusal(response)).toBe('Each file must be 5 MB or less.');
      expect(attachments.prepare).not.toHaveBeenCalled();
    });

    it('answers 429 with Retry-After once an address has sent too many bytes of files, checking none of them', async () => {
      const largest = Array.from({ length: 3 }, (_, index) => ({
        name: `${index}.txt`,
        content: new Uint8Array(ATTACHMENT_MAX_BYTES),
      }));
      expect((await sendWith(largest)).status).toBe(201);

      const refused = await sendWith(largest);

      expect(refused.status).toBe(429);
      expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(attachments.prepare).toHaveBeenCalledOnce();
      expect(service.send).toHaveBeenCalledOnce();
    });

    it('refuses a file sent under another part name', async () => {
      const response = await sendWith([
        { name: 'rows.txt', content: text('Rows'), part: 'file' },
      ]);

      expect(await refusal(response)).toBe('Send each file in a "files" part.');
    });
  });

  describe('GET /status (public)', () => {
    const status = (reference: string, email: string, from?: string) =>
      call(
        'GET',
        `/status?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`,
        { from }
      );

    it('tells anyone with the reference and email where it is up to', async () => {
      const response = await status('R-1001', 'dana@example.com');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        reference: 'R-1001',
        status: 'pending',
      });
      expect(service.statusOf).toHaveBeenCalledExactlyOnceWith(
        'R-1001',
        'dana@example.com'
      );
    });

    it('answers 404 when they do not match, saying nothing more', async () => {
      service.statusOf.mockResolvedValueOnce(null);

      const response = await status('R-1001', 'someone@example.com');

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        message: 'No request matches that reference and email.',
      });
    });

    it('answers 404 for a missing reference or email, reading nothing', async () => {
      const response = await call('GET', '/status');

      expect(response.status).toBe(404);
      expect(service.statusOf).not.toHaveBeenCalled();
    });

    it(`answers 429 with Retry-After after ${MAX_STATUS_CHECKS} checks from one address`, async () => {
      for (let i = 0; i < MAX_STATUS_CHECKS; i++) {
        await status('R-1001', 'dana@example.com');
      }

      const refused = await status('R-1001', 'dana@example.com');

      expect(refused.status).toBe(429);
      expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(service.statusOf).toHaveBeenCalledTimes(MAX_STATUS_CHECKS);
    });
  });

  describe('for supervisors', () => {
    it('lists the pending requests for a supervisor', async () => {
      const response = await call('GET', '', { role: 'supervisor' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([waiting]);
    });

    it('turns one into a ticket (201), as the supervisor signed in', async () => {
      const response = await call('POST', '/request-1/ticket', {
        role: 'supervisor',
        body: { queueId: 'billing', priority: 'high' },
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(newTicket);
      expect(service.turnIntoTicket).toHaveBeenCalledExactlyOnceWith(
        'request-1',
        { queueId: 'billing', priority: 'high' },
        USERS.supervisor
      );
    });

    it('dismisses one (204), as the supervisor signed in', async () => {
      const response = await call('POST', '/request-1/dismiss', {
        role: 'supervisor',
        body: { reason: 'spam' },
      });

      expect(response.status).toBe(204);
      expect(service.dismiss).toHaveBeenCalledExactlyOnceWith(
        'request-1',
        { reason: 'spam', duplicateOfTicketNumber: null },
        USERS.supervisor
      );
    });

    it('refuses a wrong decision body with 400, deciding nothing', async () => {
      const response = await call('POST', '/request-1/dismiss', {
        role: 'supervisor',
        body: { reason: 'boring' },
      });

      expect(response.status).toBe(400);
      expect(service.dismiss).not.toHaveBeenCalled();
    });

    it('passes on a conflict: someone decided it first (409)', async () => {
      service.turnIntoTicket.mockRejectedValueOnce(
        new ConflictException('Someone has decided this request already.')
      );

      const response = await call('POST', '/request-1/ticket', {
        role: 'supervisor',
        body: { queueId: 'billing', priority: 'high' },
      });

      expect(response.status).toBe(409);
    });

    it.each([
      ['GET', ''],
      ['POST', '/request-1/ticket'],
      ['POST', '/request-1/dismiss'],
    ] as const)(
      'answers %s %s with 401 signed out and 403 for agents and admins, deciding nothing',
      async (method, path) => {
        expect((await call(method, path)).status).toBe(401);
        expect((await call(method, path, { role: 'agent' })).status).toBe(403);
        expect((await call(method, path, { role: 'admin' })).status).toBe(403);
        expect(service.pending).not.toHaveBeenCalled();
        expect(service.turnIntoTicket).not.toHaveBeenCalled();
        expect(service.dismiss).not.toHaveBeenCalled();
      }
    );
  });
});
