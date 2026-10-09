import { PGlite } from '@electric-sql/pglite';
import { ATTACHMENT_MAX_BYTES, type CurrentUser } from '@helpdesk/contract';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import {
  customers,
  queues,
  requests,
  teams,
  tickets,
  users,
} from '../database/schema';
import { NOT_YOURS } from '../tickets/ticket-access';
import { AttachmentsService, NO_SUCH_FILE } from './attachments.service';
import type { ImageReEncoder } from './image-re-encoder';

const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** A PNG as a customer sends it, with something hidden after the image. */
const SENT_PNG = new Uint8Array([...PNG_SIGNATURE, 1, 2, 3, 0xde, 0xad]);
/** The same PNG drawn anew: only the picture. */
const CLEAN_PNG = new Uint8Array([...PNG_SIGNATURE, 1, 2, 3]);
const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj');
const TEXT = new TextEncoder().encode('Rows: 1,000\n');

const person = (
  id: string,
  role: 'supervisor' | 'agent',
  teamId: string
): CurrentUser => ({ id, name: id, role, teamId });
/** Atlas: Chris leads, Sam works. Beacon: Nina leads, Kai works. */
const chris = person('chris.taylor', 'supervisor', 'atlas');
const sam = person('sam.rivera', 'agent', 'atlas');
const nina = person('nina.patel', 'supervisor', 'beacon');
const kai = person('kai.morgan', 'agent', 'beacon');

// Attachments (#1026): files checked by their contents and kept with their
// request; listed with it, and opened only by staff who may see it.
describe('AttachmentsService', { timeout: 60_000 }, () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  const reEncoder = { reEncode: vi.fn<ImageReEncoder['reEncode']>() };
  let service: AttachmentsService;
  /** Sam's ticket, made from a request; and one made by no request. */
  let ticketForSam: string;
  let plainTicket: string;

  beforeAll(async () => {
    client = new PGlite();
    database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });
    await database.insert(queues).values({ id: 'billing', name: 'Billing' });
    await database.insert(teams).values([
      { id: 'atlas', name: 'Atlas' },
      { id: 'beacon', name: 'Beacon' },
    ]);
    await database
      .insert(users)
      .values(
        [chris, sam, nina, kai].map((user) => ({ ...user, passwordHash: 'x' }))
      );
    await database
      .update(teams)
      .set({ supervisorId: chris.id })
      .where(eq(teams.id, 'atlas'));
    await database
      .update(teams)
      .set({ supervisorId: nina.id })
      .where(eq(teams.id, 'beacon'));
    const [dana] = await database
      .insert(customers)
      .values({ name: 'Dana Whitfield', email: 'dana@example.com' })
      .returning({ id: customers.id });
    const ticket = {
      subject: 'Export stops at 1,000 rows',
      description: 'See the screenshot.',
      status: 'open' as const,
      priority: 'high' as const,
      requesterId: dana.id,
      queueId: 'billing',
      assigneeId: sam.id,
    };
    [{ id: ticketForSam }, { id: plainTicket }] = await database
      .insert(tickets)
      .values([ticket, ticket])
      .returning({ id: tickets.id });
    service = new AttachmentsService(database, reEncoder);
  });

  beforeEach(() => {
    reEncoder.reEncode.mockReset();
    reEncoder.reEncode.mockResolvedValue(CLEAN_PNG);
  });

  afterAll(() => client.close());

  /** A request, pending unless decided; resolves to its id. */
  async function requestWith(
    decided: { ticketId: string } | 'dismissed' | 'pending' = 'pending'
  ) {
    const decision =
      decided === 'pending'
        ? {}
        : {
            decidedById: chris.id,
            decidedAt: new Date(),
            ...(decided === 'dismissed'
              ? { status: 'dismissed' as const, dismissReason: 'spam' as const }
              : { status: 'ticket' as const, ticketId: decided.ticketId }),
          };
    const [{ id }] = await database
      .insert(requests)
      .values({
        name: 'Dana Whitfield',
        email: 'dana@example.com',
        category: 'bug',
        impact: 'blocked',
        subject: 'Export stops at 1,000 rows',
        description: 'See the screenshot.',
        where: null,
        consentedAt: new Date(),
        ...decision,
      })
      .returning({ id: requests.id });
    return id;
  }

  /** Keeps `files` with a new request; resolves to the request's id. */
  async function storedWith(
    files: { name: string; bytes: Uint8Array }[],
    decided?: Parameters<typeof requestWith>[0]
  ) {
    const requestId = await requestWith(decided);
    const prepared = await service.prepare(files);
    await database.transaction((tx) => service.store(tx, requestId, prepared));
    return requestId;
  }

  describe('prepare', () => {
    it('decides each type from its bytes, cleans each name, and redraws images', async () => {
      const prepared = await service.prepare([
        { name: 'C:\\Desktop\\shot', bytes: SENT_PNG },
        { name: 'invoice.pdf', bytes: PDF },
        { name: 'rows.csv', bytes: TEXT },
      ]);

      expect(prepared).toEqual([
        { fileName: 'shot.png', mediaType: 'image/png', content: CLEAN_PNG },
        { fileName: 'invoice.pdf', mediaType: 'application/pdf', content: PDF },
        { fileName: 'rows.csv.txt', mediaType: 'text/plain', content: TEXT },
      ]);
      expect(reEncoder.reEncode).toHaveBeenCalledExactlyOnceWith(
        SENT_PNG,
        'image/png'
      );
    });

    it('takes no files', async () => {
      await expect(service.prepare([])).resolves.toEqual([]);
    });

    it.each([
      [
        'more than 3 files',
        Array.from({ length: 4 }, (_, index) => ({
          name: `${index}.txt`,
          bytes: TEXT,
        })),
        'Attach at most 3 files.',
      ],
      [
        'a file over 5 MB, unread',
        [
          {
            name: 'huge.png',
            bytes: new Uint8Array(ATTACHMENT_MAX_BYTES + 1),
          },
        ],
        '"huge.png" is larger than 5 MB.',
      ],
      [
        'a type that is not allowed',
        [{ name: 'tool.exe', bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0]) }],
        '"tool.exe" isn\'t a PNG, JPEG, WebP, PDF or text file.',
      ],
      [
        'an empty file',
        [{ name: 'empty.txt', bytes: new Uint8Array() }],
        '"empty.txt" isn\'t a PNG, JPEG, WebP, PDF or text file.',
      ],
    ])('refuses %s, redrawing nothing', async (_, files, message) => {
      await expect(service.prepare(files)).rejects.toThrow(
        new BadRequestException(message)
      );
      expect(reEncoder.reEncode).not.toHaveBeenCalled();
    });

    it('refuses an image it cannot draw', async () => {
      reEncoder.reEncode.mockRejectedValue(new Error('corrupt'));

      await expect(
        service.prepare([{ name: 'shot.png', bytes: SENT_PNG }])
      ).rejects.toThrow(
        new BadRequestException('"shot.png" couldn\'t be read as an image.')
      );
    });

    it('refuses an image that comes out over 5 MB', async () => {
      reEncoder.reEncode.mockResolvedValue(
        new Uint8Array(ATTACHMENT_MAX_BYTES + 1)
      );

      await expect(
        service.prepare([{ name: 'shot.png', bytes: SENT_PNG }])
      ).rejects.toThrow(
        new BadRequestException('"shot.png" is larger than 5 MB.')
      );
    });

    // Fail closed: an image is never kept as it was sent.
    it('refuses images, and only images, with nothing to redraw them', async () => {
      const withoutReEncoder = new AttachmentsService(database);

      await expect(
        withoutReEncoder.prepare([{ name: 'invoice.pdf', bytes: PDF }])
      ).resolves.toHaveLength(1);
      await expect(
        withoutReEncoder.prepare([{ name: 'shot.png', bytes: SENT_PNG }])
      ).rejects.toThrow(
        new BadRequestException('"shot.png" couldn\'t be read as an image.')
      );
    });

    it('names a file in a message by its last part only', async () => {
      await expect(
        service.prepare([
          {
            name: '/home/dana/tool.exe',
            bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0]),
          },
        ])
      ).rejects.toThrow('"tool.exe" isn\'t');
    });
  });

  describe('store and listFor', () => {
    it("lists each request's files, oldest first, and none for one without", async () => {
      const withFiles = await storedWith([
        { name: 'shot.png', bytes: SENT_PNG },
        { name: 'rows.txt', bytes: TEXT },
      ]);
      const without = await requestWith();

      const listed = await service.listFor([withFiles, without]);

      expect(listed.get(withFiles)).toEqual([
        {
          id: expect.any(String),
          fileName: 'shot.png',
          mediaType: 'image/png',
          size: CLEAN_PNG.length,
        },
        {
          id: expect.any(String),
          fileName: 'rows.txt',
          mediaType: 'text/plain',
          size: TEXT.length,
        },
      ]);
      expect(listed.get(without)).toEqual([]);
    });

    it('asks nothing of the database for no requests', async () => {
      await expect(service.listFor([])).resolves.toEqual(new Map());
    });
  });

  describe('download', () => {
    /** The id of the first file kept with a new request. */
    async function fileOf(decided?: Parameters<typeof requestWith>[0]) {
      const requestId = await storedWith(
        [{ name: 'shot.png', bytes: SENT_PNG }],
        decided
      );
      return (await service.listFor([requestId])).get(requestId)?.[0].id ?? '';
    }

    const theFile = {
      fileName: 'shot.png',
      mediaType: 'image/png',
      content: CLEAN_PNG,
    };

    it("gives a supervisor a pending request's file", async () => {
      const id = await fileOf();

      for (const supervisor of [chris, nina]) {
        await expect(service.download(id, supervisor)).resolves.toEqual(
          theFile
        );
      }
    });

    it("gives a ticket's file to whoever may work on the ticket", async () => {
      const id = await fileOf({ ticketId: ticketForSam });

      await expect(service.download(id, sam)).resolves.toEqual(theFile);
      await expect(service.download(id, chris)).resolves.toEqual(theFile);
    });

    it.each([
      ["an agent, a pending request's", 'pending', kai],
      ["another team's agent, a ticket's", 'ticket', kai],
      ["another team's supervisor, a ticket's", 'ticket', nina],
      ["a supervisor, a dismissed request's", 'dismissed', chris],
    ] as const)('gives %s file no answer but 404', async (_, decided, user) => {
      const id = await fileOf(
        decided === 'ticket' ? { ticketId: ticketForSam } : decided
      );

      await expect(service.download(id, user)).rejects.toThrow(
        new NotFoundException(NO_SUCH_FILE)
      );
    });

    it.each(['not-a-uuid', '00000000-0000-4000-8000-000000000000'])(
      'answers 404 for no such file: %s',
      async (id) => {
        await expect(service.download(id, chris)).rejects.toThrow(
          new NotFoundException(NO_SUCH_FILE)
        );
      }
    );
  });

  describe('forTicket', () => {
    it('lists the files of the request a ticket came from', async () => {
      await storedWith([{ name: 'rows.txt', bytes: TEXT }], {
        ticketId: plainTicket,
      });

      const listed = await service.forTicket(plainTicket, sam);

      expect(listed.map(({ fileName }) => fileName)).toEqual(['rows.txt']);
    });

    it('lists none for a ticket that came from no request', async () => {
      const [{ id }] = await database
        .insert(tickets)
        .values({
          subject: 'Seeded',
          description: 'Seeded',
          status: 'open',
          priority: 'low',
          requesterId: (await database.select().from(customers))[0].id,
          queueId: 'billing',
          assigneeId: sam.id,
        })
        .returning({ id: tickets.id });

      await expect(service.forTicket(id, sam)).resolves.toEqual([]);
    });

    it("answers as the ticket's own rule does for someone who may not work on it", async () => {
      await expect(service.forTicket(ticketForSam, kai)).rejects.toThrow(
        new NotFoundException(NOT_YOURS)
      );
    });
  });
});
