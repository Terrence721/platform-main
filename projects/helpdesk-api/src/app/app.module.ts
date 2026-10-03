import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';

/**
 * The Helpdesk API's root module. The database connection is shared by
 * every feature; signing in (/api/auth) comes from AuthModule, and each
 * further feature (tickets, Team accounts) arrives as its own module in
 * `imports`.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
