// @vitest-environment node
// PGlite runs WebAssembly that the simulated browser (jsdom) the app's
// other specs use cannot load; the real browser and Node both can.
import { TicketsService } from '@helpdesk/server';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { type DemoDatabase, startDemoDatabase } from './demo-database';

/** The migrations the demo build ships, read from disk here. */
const MIGRATIONS = fileURLToPath(
  new URL('../../../helpdesk-server/drizzle/', import.meta.url)
);

const NOW = new Date('2026-10-04T12:00:00.000Z');

describe('startDemoDatabase', { timeout: 60_000 }, () => {
  let demo: DemoDatabase;
  const read: string[] = [];

  // One start for every test: they only read.
  beforeAll(async () => {
    demo = await startDemoDatabase(async (path) => {
      read.push(path);
      return readFile(MIGRATIONS + path, 'utf8');
    }, NOW);
  });

  afterAll(() => demo.client.close());

  it('reads the journal first, then each migration in its order', () => {
    expect(read).toEqual([
      'meta/_journal.json',
      '0000_init.sql',
      '0001_ticket_messages.sql',
    ]);
  });

  it('creates every table the API uses', async () => {
    const { rows } = await demo.client.query<{ name: string }>(
      `select table_name as name from information_schema.tables
       where table_schema = 'public' order by table_name`
    );

    expect(rows.map(({ name }) => name)).toEqual([
      'customers',
      'queues',
      'teams',
      'ticket_messages',
      'tickets',
      'users',
    ]);
  });

  it('seeds it as the real stack does', () => {
    expect(demo.summary).toMatchObject({
      users: 48,
      teams: 4,
      tickets: 1000,
      messages: expect.any(Number),
    });
    expect(demo.summary.messages).toBeGreaterThan(0);
  });

  it("answers the API's services, such as Sam's open tickets", async () => {
    const mine = await new TicketsService(demo.database).assignedTo(
      'sam.rivera'
    );

    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every(({ assignee }) => assignee?.id === 'sam.rivera')).toBe(
      true
    );
  });
});
