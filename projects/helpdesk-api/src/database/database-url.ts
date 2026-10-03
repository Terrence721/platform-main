/**
 * The local development database (compose.yaml, .env.example): only ever
 * used when DATABASE_URL is not set.
 */
export const DEFAULT_DATABASE_URL =
  'postgres://helpdesk:helpdesk-dev-only@localhost:5435/helpdesk';

/**
 * Where the API's database is: DATABASE_URL, or the local development
 * database. Callers load .env into the environment first; this only reads.
 */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env['DATABASE_URL'] || DEFAULT_DATABASE_URL;
}
