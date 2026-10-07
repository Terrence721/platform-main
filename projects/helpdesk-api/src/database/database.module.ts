import {
  Global,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DATABASE, type Database } from '@helpdesk/server';
import { databaseUrl } from './database-url';

// Still exported from here, where most of the API imports them from.
export { DATABASE, type Database } from '@helpdesk/server';

/** The API's one pool of connections to PostgreSQL. */
export const PG_POOL = Symbol('PG_POOL');

/**
 * How long a new connection may take before it fails: a database that
 * never answers then reads as down (e.g. in the health check) after 2s,
 * instead of leaving the request waiting.
 */
export const CONNECTION_TIMEOUT_MS = 2_000;

const logger = new Logger('Database');

/**
 * The API's database connection, available everywhere (global). The pool
 * connects on first use, not at start-up, so the API starts even while the
 * database is down (the health check then says so), and it is closed when
 * the app is closed (`app.close()`), so no connections are left open.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const pool = new Pool({
          connectionString: databaseUrl(),
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
        });
        // An idle connection that breaks (the database restarts, the
        // network drops) is reported here. Without a listener Node would end
        // the process; logged instead, and the pool opens a new connection
        // when one is next needed.
        pool.on('error', (error) =>
          logger.error(`An idle database connection failed: ${error.message}`)
        );
        return pool;
      },
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
