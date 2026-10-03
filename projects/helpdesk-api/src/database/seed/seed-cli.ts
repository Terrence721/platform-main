import { drizzle } from 'drizzle-orm/node-postgres';
import { existsSync } from 'fs';
import { Pool } from 'pg';
import { databaseUrl } from '../database-url';
import { DEFAULT_SEED_PASSWORD, seedDatabase } from './seed';

// `yarn db:seed`: fills the empty, migrated database with the seed data and
// says how to sign in. Run from the repo root (yarn start:helpdesk runs it
// after migrating).

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main(): Promise<void> {
  const password =
    process.env['HELPDESK_SEED_PASSWORD'] || DEFAULT_SEED_PASSWORD;
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    const summary = await seedDatabase(drizzle(pool), { password });
    console.log(
      `Seeded ${summary.users} users, ${summary.teams} teams, ` +
        `${summary.queues} queues, ${summary.customers} customers and ` +
        `${summary.tickets} tickets in ${(summary.milliseconds / 1000).toFixed(1)}s.`
    );
    console.log(
      `Sign in as any of them with the password "${password}", e.g. ` +
        `admin ${summary.examples.admin.join(', ')}; ` +
        `supervisor ${summary.examples.supervisor.join(', ')}; ` +
        `agent ${summary.examples.agent.join(', ')}.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    `Seeding failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
