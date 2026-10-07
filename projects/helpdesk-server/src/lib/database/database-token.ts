import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

// The database token and type the services inject, apart from
// DatabaseModule: the module brings in pg and the Node driver, which the
// in-browser demo (#942) cannot load, while the services only need these
// two. The import above is a type, so it is gone after compiling.

/** The Drizzle client services inject to query the database. */
export const DATABASE = Symbol('DATABASE');

/**
 * Any Drizzle PostgreSQL client: node-postgres in the API, PGlite in the
 * in-browser demo and the specs. Both extend this base, so either can be
 * passed as it is, and the compiler checks the services use only what both
 * have (#1043).
 */
export type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;
