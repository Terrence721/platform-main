import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'fs';
import { databaseUrl } from './src/database/database-url';

// drizzle-kit does not read .env itself; load it so DATABASE_URL set there
// is used (otherwise the local development database's address).
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// drizzle-kit's settings for the Helpdesk API: where the tables are defined
// and where generated migrations go (committed). Paths are relative to the
// repo root, where the `yarn db:*` scripts run drizzle-kit.
export default defineConfig({
  dialect: 'postgresql',
  schema: './projects/helpdesk-api/src/database/schema.ts',
  out: './projects/helpdesk-api/drizzle',
  dbCredentials: { url: databaseUrl() },
});
