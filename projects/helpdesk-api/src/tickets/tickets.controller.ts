// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import { type CurrentUser, isUserId, type TicketDto } from '@helpdesk/contract';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
   * Every unassigned open ticket, most urgent first: the agent page's
   * Unassigned, work an agent may take. Only agents.
   */
  @Get('unassigned')
  @OnlyFor('agent')
  unassigned(): Promise<TicketDto[]> {
    return this.tickets.unassigned();
  }

  /**
   * Gives a ticket to an agent: 200 with the ticket; 400 for a body
   * without an agent. A supervisor gives it to an agent on their team, or
   * moves it from one to another (404 for a ticket or agent not on their
   * team). An agent takes an unassigned ticket for themselves only (403 for
   * anyone else; 409 if someone has taken it). 409 for a finished ticket.
   */
  @Put(':ticketId/assignee')
  @OnlyFor('supervisor', 'agent')
  assign(
    @SignedInUser() user: CurrentUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown
  ): Promise<TicketDto> {
    const assigneeId = readAssigneeId(body);
    if (user.role === 'supervisor') {
      return this.tickets.assign(ticketId, assigneeId, user.id);
    }
    if (assigneeId !== user.id) {
      throw new ForbiddenException(
        'Agents can only take tickets for themselves.'
      );
    }
    return this.tickets.take(ticketId, user.id);
  }
}
