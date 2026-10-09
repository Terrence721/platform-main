// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import type {
  CurrentUser,
  MemberHistory,
  PersonSummary,
  TeamListing,
  TeamOverview,
  TicketDto,
} from '@helpdesk/contract';
import {
  historySince,
  NO_TEAM_MESSAGE,
  TeamsService,
  TicketsService,
} from '@helpdesk/server';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';

/**
 * Teams (/api/teams): every team, for admins; and a team's members and
 * workload, for the supervisor who leads it.
 */
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly tickets: TicketsService
  ) {}

  /**
   * Every team by name, each with its lead (`null` while none): Team
   * accounts and its team choices, which an emptied team must stay in
   * (#1210). Only admins: other roles get 403, signed out 401.
   */
  @Get()
  @OnlyFor('admin')
  all(): Promise<TeamListing[]> {
    return this.teams.all();
  }

  /**
   * The supervisor's own team and its workload: the supervisor page's My
   * team. Only supervisors, like the page itself: other roles get 403,
   * signed out 401; a supervisor who leads no team gets 404.
   */
  @Get('mine')
  @OnlyFor('supervisor')
  async mine(@SignedInUser() user: CurrentUser): Promise<TeamOverview> {
    const overview = await this.teams.overviewFor(user.id);
    if (overview === null) {
      throw new NotFoundException(NO_TEAM_MESSAGE);
    }
    return overview;
  }

  /**
   * Every ticket of one agent on the supervisor's team: their open work
   * first, then their finished tickets. For the page's Team member list.
   */
  @Get('mine/members/:userId/tickets')
  @OnlyFor('supervisor')
  async memberTickets(
    @SignedInUser() user: CurrentUser,
    @Param('userId') userId: string
  ): Promise<TicketDto[]> {
    const member = await this.memberOf(user, userId);
    return this.tickets.allAssignedTo(member.id);
  }

  /**
   * One agent's last three months, for the member history popup: their
   * tickets created or changed since then, and how those add up.
   */
  @Get('mine/members/:userId/history')
  @OnlyFor('supervisor')
  async memberHistory(
    @SignedInUser() user: CurrentUser,
    @Param('userId') userId: string
  ): Promise<MemberHistory> {
    const member = await this.memberOf(user, userId);
    const since = historySince(new Date());
    const { summary, tickets } = await this.tickets.historyFor(
      member.id,
      since
    );
    return { member, since: since.toISOString(), summary, tickets };
  }

  /**
   * The agent, if they are on this supervisor's team; otherwise 404, the
   * same for another team's agent as for no such user, so a supervisor
   * cannot learn who exists elsewhere.
   */
  private async memberOf(
    user: CurrentUser,
    userId: string
  ): Promise<PersonSummary> {
    const member = await this.teams.agentLedBy(user.id, userId);
    if (member === null) {
      throw new NotFoundException('No such member on your team.');
    }
    return member;
  }
}
