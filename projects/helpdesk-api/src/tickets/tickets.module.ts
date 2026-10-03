import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

/**
 * Tickets for the people who work them (/api/tickets). AuthModule brings
 * the guard every endpoint here is behind; the database comes from the
 * global DatabaseModule. TicketsService is exported for features that show
 * someone's tickets (a supervisor's team members).
 */
@Module({
  imports: [AuthModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
