import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

/**
 * Teams for the supervisors who lead them (/api/teams). AuthModule brings
 * the guard every endpoint here is behind, TicketsModule the team members'
 * tickets; the database comes from the global DatabaseModule.
 */
@Module({
  imports: [AuthModule, TicketsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
