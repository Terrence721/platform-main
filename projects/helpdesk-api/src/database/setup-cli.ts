import { DEFAULT_SEED_PASSWORD, seedDatabase, users } from '@helpdesk/server';
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import { databaseUrl } from './database-url';

// The Docker image's first step (`node setup.js && node main.js`): brings
// the database at DATABASE_URL up to date before the API starts. Applies the
// migrations shipped next to this file, then, with HELPDESK_SEED=true, seeds
// a database that has no users yet. Safe to run on every start: migrations
// already applied are skipped, and a seeded database is left as it is.

/** The migrations, copied beside the built file (webpack.config.cjs). */
const MIGRATIONS = join(dirname(process.argv[1]), 'drizzle');

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    const database = drizzle(pool);
    await migrate(database, { migrationsFolder: MIGRATIONS });
    console.log('Migrations applied.');

    if (process.env['HELPDESK_SEED'] !== 'true') {
      return;
    }
    const [{ existing }] = await database
      .select({ existing: count() })
      .from(users);
    if (existing > 0) {
      console.log('Already seeded; leaving the data as it is.');
      return;
    }
    const summary = await seedDatabase(database, {
      password: process.env['HELPDESK_SEED_PASSWORD'] || DEFAULT_SEED_PASSWORD,
    });
    console.log(
      `Seeded ${summary.users} users, ${summary.tickets} tickets and ` +
        `${summary.messages} messages.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    `Database setup failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
