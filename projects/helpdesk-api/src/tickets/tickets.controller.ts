// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import type { CurrentUser, TicketDto } from '@helpdesk/contract';
import { Controller, Get } from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';
import { TicketsService } from './tickets.service';

/** Tickets, for the people who work them (/api/tickets). */
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /**
   * The agent's own open work, most urgent first: the agent page's My
   * tickets. Only agents, like the page itself: other roles get 403,
   * signed out 401.
   */
  @Get('mine')
  @OnlyFor('agent')
  mine(@SignedInUser() user: CurrentUser): Promise<TicketDto[]> {
    return this.tickets.assignedTo(user.id);
  }
}
