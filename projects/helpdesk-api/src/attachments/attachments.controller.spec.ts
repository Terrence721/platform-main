import type { AttachmentSummary, CurrentUser } from '@helpdesk/contract';
import {
  AttachmentsService,
  NO_SUCH_FILE,
  type PreparedFile,
} from '@helpdesk/server';
import { type INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AttachmentsController } from './attachments.controller';

/** Who each session token signs in as. */
const SESSIONS: Record<string, CurrentUser> = {
  supervisor: {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    teamId: 'atlas',
  },
  agent: {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    teamId: 'atlas',
  },
  admin: {
    id: 'alex.morgan',
    name: 'Alex Morgan',
    role: 'admin',
    teamId: null,
  },
};

const fakeAuth = {
  currentUser: async (token: string | undefined) =>
    (token && SESSIONS[token]) || null,
};

const FILE_ID = '6f1c1b6e-2f0a-4a51-9a52-6a9b7c3d2e10';
const TICKET_ID = 'b2a7e0f4-4c3d-4b8e-9f1a-0d2c3b4a5e6f';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Attachments (#1026): a file only ever as a download, and a ticket's
// files for its popup. Who may see which is the service's, tested with
// it; here, what the routes hand it and how they answer.
describe('/api/attachments', () => {
  const attachments = {
    download: vi.fn<AttachmentsService['download']>(),
    forTicket: vi.fn<AttachmentsService['forTicket']>(),
  };
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    attachments.download.mockResolvedValue({
      fileName: 'shot.png',
      mediaType: 'image/png',
      content: PNG,
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: fakeAuth },
        { provide: AttachmentsService, useValue: attachments },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api`;
  });

  afterEach(async () => {
    await app.close();
  });

  /** GET this path as this session token, or signed out. */
  const get = (path: string, session: string | null = 'supervisor') =>
    fetch(`${base}${path}`, {
      headers:
        session === null ? {} : { cookie: `${SESSION_COOKIE}=${session}` },
    });

  /** Downloads a file the service answers with. */
  const download = async (file: PreparedFile) => {
    attachments.download.mockResolvedValue(file);
    return get(`/attachments/${FILE_ID}`);
  };

  describe('GET /attachments/:id', () => {
    it('sends the file for the caller, as the service allows', async () => {
      const response = await get(`/attachments/${FILE_ID}`, 'agent');

      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
      expect(attachments.download).toHaveBeenCalledExactlyOnceWith(
        FILE_ID,
        SESSIONS['agent']
      );
    });

    it('sends it only ever as a download, never to be shown or run', async () => {
      const response = await get(`/attachments/${FILE_ID}`);

      expect(Object.fromEntries(response.headers)).toMatchObject({
        'content-type': 'image/png',
        'content-length': '8',
        'content-disposition': `attachment; filename="shot.png"; filename*=UTF-8''shot.png`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
        'cache-control': 'private, no-store',
        'cross-origin-resource-policy': 'same-origin',
      });
    });

    it('names a file any computer can save, in its own letters where it can', async () => {
      const response = await download({
        fileName: 'Zoë’s "café" receipt (1).pdf',
        mediaType: 'application/pdf',
        content: PNG,
      });

      expect(response.headers.get('content-disposition')).toBe(
        `attachment; filename="Zo__s _caf__ receipt (1).pdf"; ` +
          `filename*=UTF-8''Zo%C3%AB%E2%80%99s%20%22caf%C3%A9%22%20receipt%20%281%29.pdf`
      );
    });

    it('says text is UTF-8', async () => {
      const response = await download({
        fileName: 'rows.txt',
        mediaType: 'text/plain',
        content: new TextEncoder().encode('Rows: 1,000'),
      });

      expect(response.headers.get('content-type')).toBe(
        'text/plain; charset=utf-8'
      );
    });

    it("passes on the service's 404", async () => {
      attachments.download.mockRejectedValue(
        new NotFoundException(NO_SUCH_FILE)
      );

      const response = await get(`/attachments/${FILE_ID}`);

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ message: NO_SUCH_FILE });
    });

    it.each([
      ['signed out', null, 401],
      ['an admin, who works no tickets', 'admin', 403],
    ])('refuses anyone %s', async (_, session, status) => {
      expect((await get(`/attachments/${FILE_ID}`, session)).status).toBe(
        status
      );
      expect(attachments.download).not.toHaveBeenCalled();
    });
  });

  describe('GET /tickets/:ticketId/attachments', () => {
    it("lists the ticket's files for the caller", async () => {
      const listed: AttachmentSummary[] = [
        { id: FILE_ID, fileName: 'shot.png', mediaType: 'image/png', size: 8 },
      ];
      attachments.forTicket.mockResolvedValue(listed);

      const response = await get(`/tickets/${TICKET_ID}/attachments`, 'agent');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(listed);
      expect(attachments.forTicket).toHaveBeenCalledExactlyOnceWith(
        TICKET_ID,
        SESSIONS['agent']
      );
    });

    it('refuses anyone signed out', async () => {
      expect(
        (await get(`/tickets/${TICKET_ID}/attachments`, null)).status
      ).toBe(401);
    });
  });
});
