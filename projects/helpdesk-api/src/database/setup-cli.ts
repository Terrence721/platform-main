import {
  DEFAULT_SEED_PASSWORD,
  hashPassword,
  seedDatabase,
  users,
} from '@helpdesk/server';
import { count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import { databaseUrl } from './database-url';
import { errorText } from './error-text';

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
    if (process.env['HELPDESK_MIGRATE'] !== 'false') {
      await migrate(database, { migrationsFolder: MIGRATIONS });
      console.log('Migrations applied.');
    } else {
      console.log('Migrations skipped (HELPDESK_MIGRATE=false).');
    }

    const bootstrapUserId = process.env['HELPDESK_BOOTSTRAP_ADMIN_USER_ID'];
    const bootstrapPassword = process.env['HELPDESK_BOOTSTRAP_ADMIN_PASSWORD'];
    if (bootstrapUserId && bootstrapPassword) {
      const [{ existing }] = await database
        .select({ existing: count() })
        .from(users)
        .where(eq(users.id, bootstrapUserId));
      if (!existing) {
        const name =
          process.env['HELPDESK_BOOTSTRAP_ADMIN_NAME'] || 'Administrator';
        await database.insert(users).values({
          id: bootstrapUserId,
          name,
          role: 'admin',
          passwordHash: await hashPassword(bootstrapPassword),
          active: true,
          teamId: null,
        });
        console.log(`Bootstrapped administrator ${bootstrapUserId}.`);
      }
    }

    if (process.env['HELPDESK_SEED'] !== 'true') {
      return;
    }
    const seedPassword =
      process.env['HELPDESK_SEED_PASSWORD'] || DEFAULT_SEED_PASSWORD;
    if (
      process.env['NODE_ENV'] === 'production' &&
      seedPassword === DEFAULT_SEED_PASSWORD
    ) {
      throw new Error(
        'HELPDESK_SEED_PASSWORD must be set in production; the published ' +
          'development password cannot be used to seed.'
      );
    }
    const [{ existing }] = await database
      .select({ existing: count() })
      .from(users);
    if (existing > 0) {
      console.log('Already seeded; leaving the data as it is.');
      return;
    }
    const summary = await seedDatabase(database, { password: seedPassword });
    console.log(
      `Seeded ${summary.users} users, ${summary.tickets} tickets and ` +
        `${summary.messages} messages.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`Database setup failed: ${errorText(error)}`);
  process.exitCode = 1;
});
