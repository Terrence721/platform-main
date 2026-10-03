// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import type {
  CurrentUser,
  MemberHistory,
  PersonSummary,
  TeamOverview,
  TicketDto,
} from '@helpdesk/contract';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';
import { TicketsService } from '../tickets/tickets.service';
import { TeamsService } from './teams.service';

/** How far back a team member's history goes. */
export const HISTORY_MONTHS = 3;

/** The start of a history ending `now`: the same moment, months earlier. */
export function historySince(now: Date): Date {
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - HISTORY_MONTHS);
  return since;
}

/** Teams, for the supervisors who lead them (/api/teams). */
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly tickets: TicketsService
  ) {}

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
      throw new NotFoundException('You do not lead a team.');
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
