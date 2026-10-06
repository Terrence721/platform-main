import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { LiveModule } from '../live/live.module';
import { ReportsModule } from '../reports/reports.module';
import { TeamsModule } from '../teams/teams.module';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';
import { HealthController } from './health.controller';

/**
 * The Helpdesk API's root module. The database connection is shared by
 * every feature; signing in (/api/auth) comes from AuthModule, tickets
 * (/api/tickets) from TicketsModule, teams (/api/teams) from TeamsModule,
 * accounts (/api/users) from UsersModule, the Reports page's figures
 * (/api/reports) from ReportsModule, and live updates (/api/events) from
 * LiveModule. Each further feature arrives as its own module in `imports`.
 */
@Module({
  imports: [
    DatabaseModule,
    LiveModule,
    AuthModule,
    TicketsModule,
    TeamsModule,
    UsersModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
