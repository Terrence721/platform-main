import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// The database token and type the services inject, apart from
// DatabaseModule: the module brings in pg and the Node driver, which the
// in-browser demo (#942) cannot load, while the services only need these
// two. The import above is a type, so it is gone after compiling.

/** The Drizzle client services inject to query the database. */
export const DATABASE = Symbol('DATABASE');

export type Database = NodePgDatabase;
