// The interfaces are imported as types: decorated methods record their
// parameter and return types at run time (emitDecoratorMetadata), and an
// interface has no run-time value to record.
import {
  type CurrentUser,
  REPORT_AGENT_PARAM,
  REPORT_TEAM_PARAM,
  type ReportsResponse,
} from '@helpdesk/contract';
import { ReportsService } from '@helpdesk/server';
import { Controller, Get, Query } from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';

/** The Reports popup's figures (/api/reports). */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * Open work, SLA and reply times: for every team, one team (`?team=`)
   * with its agents, or one agent (`?agent=`); plus what the caller may
   * pick. Admins may pick any team or agent; supervisors get the team they
   * lead, and may pick one of its agents (anything else 404), and one who
   * leads no team gets 404. Both a team and an agent: 400. Agents get 403,
   * signed out 401.
   */
  @Get()
  @OnlyFor('supervisor', 'admin')
  report(
    @SignedInUser() user: CurrentUser,
    @Query(REPORT_TEAM_PARAM) team?: string,
    @Query(REPORT_AGENT_PARAM) agent?: string
  ): Promise<ReportsResponse> {
    return this.reports.reportFor(user, { team, agent });
  }
}
