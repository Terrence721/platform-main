import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { requests, teams, users } from './schema';

const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** A request as the public form makes it: pending, nobody has decided. */
const SENT = {
  name: 'Dana Whitfield',
  email: 'dana.whitfield@example.com',
  category: 'billing',
  impact: 'blocked',
  subject: 'Charged twice',
  description: 'My card was charged twice this month.',
  where: null,
  consentedAt: new Date('2026-10-09T12:00:00Z'),
} as const;

/** A supervisor's decision: who, and when. */
const DECIDED = {
  decidedById: 'chris.taylor',
  decidedAt: new Date('2026-10-09T13:00:00Z'),
};

// The requests table as the migrations build it (#1026): its numbers, and
// the checks that keep a decision consistent with the request's status,
// refusing in the database what no code should ever write.
describe('the requests table', () => {
  let client: PGlite;
  let database: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    client = new PGlite();
    database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });
    await database.insert(teams).values({ id: 'atlas', name: 'Atlas' });
    await database.insert(users).values({
      id: 'chris.taylor',
      name: 'Chris Taylor',
      role: 'supervisor',
      teamId: 'atlas',
      passwordHash: 'x',
    });
  }, 60_000);

  afterAll(() => client.close());

  /** Inserts a request; resolves to its number, or rejects. */
  const insert = async (values: Partial<typeof requests.$inferInsert>) => {
    const [{ requestNumber }] = await database
      .insert(requests)
      .values({ ...SENT, ...values })
      .returning({ requestNumber: requests.requestNumber });
    return requestNumber;
  };

  it('keeps a request as sent, pending, numbered from 1001', async () => {
    const first = await insert({});

    expect(first).toBeGreaterThanOrEqual(1001);
    expect(await insert({})).toBe(first + 1);
  });

  it('keeps a dismissal, with its reason and who decided', async () => {
    await expect(
      insert({ status: 'dismissed', dismissReason: 'spam', ...DECIDED })
    ).resolves.toBeGreaterThan(1000);
  });

  it.each([
    [
      'a pending request someone decided',
      { ...DECIDED },
      'requests_decided_check',
    ],
    [
      'a decided request with no one who decided',
      { status: 'dismissed', dismissReason: 'spam' },
      'requests_decided_check',
    ],
    [
      'a ticket request with no ticket',
      { status: 'ticket', ...DECIDED },
      'requests_ticket_check',
    ],
    [
      'a dismissed request with no reason',
      { status: 'dismissed', ...DECIDED },
      'requests_dismissed_check',
    ],
    [
      'a pending request with a reason',
      { dismissReason: 'spam' },
      'requests_dismissed_check',
    ],
  ] as const)('refuses %s', async (_, values, constraint) => {
    // Drizzle wraps the database's error; its cause names the check.
    await expect(insert(values)).rejects.toMatchObject({
      cause: { constraint },
    });
  });
});
