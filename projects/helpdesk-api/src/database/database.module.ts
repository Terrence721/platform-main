import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseUrl } from './database-url';

/** The API's one pool of connections to PostgreSQL. */
export const PG_POOL = Symbol('PG_POOL');

/** The Drizzle client services inject to query the database. */
export const DATABASE = Symbol('DATABASE');

/**
 * How long a new connection may take before it fails: a database that
 * never answers then reads as down (e.g. in the health check) after 2s,
 * instead of leaving the request waiting.
 */
export const CONNECTION_TIMEOUT_MS = 2_000;

export type Database = NodePgDatabase;

/**
 * The API's database connection, available everywhere (global). The pool
 * connects on first use, not at start-up, so the API starts even while the
 * database is down (the health check then says so), and it is closed when
 * the API stops, so no connections are left open.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool =>
        new Pool({
          connectionString: databaseUrl(),
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        }),
    },
    {
      provide: DATABASE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool),
    },
  ],
  exports: [PG_POOL, DATABASE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
