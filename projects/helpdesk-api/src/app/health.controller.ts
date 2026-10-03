import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module';

/**
 * What the health check answers while the API is up, and whether the
 * database answers too.
 */
export interface HealthStatus {
  status: 'ok';
  database: 'up' | 'down';
}

/**
 * GET /api/health: answers as soon as the API is running, so Docker Compose
 * (and anything else watching the API) can tell when it is ready. A database
 * that is down is reported, not turned into an error: the API itself is up.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  @Get()
  async check(): Promise<HealthStatus> {
    return { status: 'ok', database: await this.databaseState() };
  }

  private async databaseState(): Promise<HealthStatus['database']> {
    try {
      await this.database.execute(sql`select 1`);
      return 'up';
    } catch {
      return 'down';
    }
  }
}
