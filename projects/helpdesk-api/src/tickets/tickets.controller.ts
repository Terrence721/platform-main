// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import { type CurrentUser, isUserId, type TicketDto } from '@helpdesk/contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
} from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';
import { TicketsService } from './tickets.service';

/** The agent an Assign body names; anything else is refused with 400. */
export function readAssigneeId(body: unknown): string {
  const assigneeId =
    typeof body === 'object' && body !== null
      ? (body as { assigneeId?: unknown }).assigneeId
      : undefined;
  if (!isUserId(assigneeId)) {
    throw new BadRequestException('Choose an agent to assign the ticket to.');
  }
  return assigneeId;
}

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

  /**
   * A supervisor gives a ticket to an agent on their team, or moves it
   * from one to another: 200 with the ticket; 400 for a body without an
   * agent; 404 for a ticket or agent not on their team; 409 for a
   * finished ticket. Only supervisors.
   */
  @Put(':ticketId/assignee')
  @OnlyFor('supervisor')
  assign(
    @SignedInUser() user: CurrentUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown
  ): Promise<TicketDto> {
    return this.tickets.assign(ticketId, readAssigneeId(body), user.id);
  }
}
