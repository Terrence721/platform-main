// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import type { CurrentUser, ReportsResponse } from '@helpdesk/contract';
import { ReportsService, scopeFor } from '@helpdesk/server';
import { Controller, Get } from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';

/** The Reports page's figures (/api/reports). */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * Open work, SLA and reply times by team: every team for an admin, the
   * supervisor's own team for a supervisor; both with the Unassigned row.
   * Agents get 403, signed out 401; a supervisor on no team gets 404.
   */
  @Get()
  @OnlyFor('supervisor', 'admin')
  report(@SignedInUser() user: CurrentUser): Promise<ReportsResponse> {
    return this.reports.report(scopeFor(user));
  }
}
