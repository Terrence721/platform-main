import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';

/**
 * The Helpdesk API's root module. The database connection is shared by
 * every feature; each feature (tickets, sign-in) arrives as its own module
 * in `imports`.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class AppModule {}
