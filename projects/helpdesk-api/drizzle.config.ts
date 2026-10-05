import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'fs';
import { databaseUrl } from './src/database/database-url';

// drizzle-kit does not read .env itself; load it so DATABASE_URL set there
// is used (otherwise the local development database's address).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// drizzle-kit's settings for the Helpdesk API: where the tables (and the
// Reports popup's views) are defined and where generated migrations go
// (committed), all in the helpdesk-server library. Paths are relative to
// the repo root, where the `yarn db:*` scripts run drizzle-kit.
export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './projects/helpdesk-server/src/lib/database/schema.ts',
    './projects/helpdesk-server/src/lib/database/reporting.ts',
  ],
  out: './projects/helpdesk-server/drizzle',
  dbCredentials: { url: databaseUrl() },
});
