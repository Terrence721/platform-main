import { PGlite } from '@electric-sql/pglite';
import {
  type Database,
  DEFAULT_SEED_PASSWORD,
  seedDatabase,
  type SeedSummary,
} from '@helpdesk/server';
import { drizzle } from 'drizzle-orm/pglite';

/** Where drizzle-kit lists the migrations, in the order they apply. */
const JOURNAL = 'meta/_journal.json';

/** What drizzle-kit puts between the statements of one migration. */
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

/** The database the in-browser demo (#942) runs on, ready to use. */
export interface DemoDatabase {
  /** PGlite itself, to close when the demo ends. */
  client: PGlite;
  /** The Drizzle client the API's services take. */
  database: Database;
  /** What the seed made, such as how many tickets. */
  summary: SeedSummary;
}

/**
 * Starts the demo's database: PostgreSQL in the page (PGlite), migrated
 * with the API's own migrations and filled with the API's own seed, as
 * `yarn start:helpdesk` does on every run, so each visit starts fresh and
 * due times are counted from `now`. `readFile` reads a file from the
 * migrations folder (projects/helpdesk-server/drizzle): over the network in
 * the browser, from disk in the specs.
 */
export async function startDemoDatabase(
  readFile: (path: string) => Promise<string>,
  now = new Date()
): Promise<DemoDatabase> {
  const client = new PGlite();
  const journal = JSON.parse(await readFile(JOURNAL)) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries) {
    for (const statement of (await readFile(`${tag}.sql`)).split(
      STATEMENT_BREAKPOINT
    )) {
      if (statement.trim() !== '') {
        await client.exec(statement);
      }
    }
  }

  // The services are typed for the node-postgres driver; both are Drizzle's
  // Postgres databases with the same query builder (as in the API's specs).
  const database = drizzle(client) as unknown as Database;
  const summary = await seedDatabase(database, {
    now,
    password: DEFAULT_SEED_PASSWORD,
  });
  return { client, database, summary };
}
