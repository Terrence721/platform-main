import { PGlite } from '@electric-sql/pglite';
import { ATTACHMENT_MAX_BYTES } from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { attachments, requests } from './schema';

const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** The first bytes of a PNG, as a stand-in for a whole file. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The attachments table as the migrations build it (#1026): a request's
// files, kept whole, and the checks that refuse in the database what no
// code should ever write.
describe('the attachments table', () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;
  let requestId: string;

  beforeAll(async () => {
    client = new PGlite();
    database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });
    [{ id: requestId }] = await database
      .insert(requests)
      .values({
        name: 'Dana Whitfield',
        email: 'dana.whitfield@example.com',
        category: 'bug',
        impact: 'blocked',
        subject: 'Export stops at 1,000 rows',
        description: 'Screenshot attached.',
        where: null,
        consentedAt: new Date('2026-10-09T12:00:00Z'),
      })
      .returning({ id: requests.id });
  }, 60_000);

  afterAll(() => client.close());

  /** Inserts an attachment to the request; resolves to its id, or rejects. */
  const insert = async (values: Partial<typeof attachments.$inferInsert>) => {
    const [{ id }] = await database
      .insert(attachments)
      .values({
        requestId,
        fileName: 'export.png',
        mediaType: 'image/png',
        size: PNG.length,
        content: PNG,
        ...values,
      })
      .returning({ id: attachments.id });
    return id;
  };

  it('keeps a file whole, with its name, type and size', async () => {
    const id = await insert({});

    const [kept] = await database
      .select()
      .from(attachments)
      .where(eq(attachments.id, id));
    expect(kept).toMatchObject({
      requestId,
      fileName: 'export.png',
      mediaType: 'image/png',
      size: 8,
    });
    expect([...kept.content]).toEqual([...PNG]);
    expect(kept.createdAt).toBeInstanceOf(Date);
  });

  it('refuses a type that is not allowed', async () => {
    await expect(
      insert({ mediaType: 'image/svg+xml' as 'image/png' })
    ).rejects.toThrow();
  });

  it('refuses a file for no request', async () => {
    await expect(
      insert({ requestId: '00000000-0000-4000-8000-000000000000' })
    ).rejects.toMatchObject({
      cause: { constraint: 'attachments_request_id_requests_id_fk' },
    });
  });

  it.each([
    [
      'a size that does not match the bytes',
      { size: 9 },
      'attachments_size_check',
    ],
    [
      'a file over 5 MB',
      {
        size: ATTACHMENT_MAX_BYTES + 1,
        content: new Uint8Array(ATTACHMENT_MAX_BYTES + 1),
      },
      'attachments_size_check',
    ],
    [
      'an empty file',
      { size: 0, content: new Uint8Array() },
      'attachments_size_check',
    ],
    ['an empty file name', { fileName: '' }, 'attachments_file_name_check'],
  ] as const)('refuses %s', async (_, values, constraint) => {
    // Drizzle wraps the database's error; its cause names the check.
    await expect(insert(values)).rejects.toMatchObject({
      cause: { constraint },
    });
  });
});
