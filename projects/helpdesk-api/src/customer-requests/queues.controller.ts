// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import type { QueueSummary } from '@helpdesk/contract';
import { CustomerRequestsService } from '@helpdesk/server';
import { Controller, Get } from '@nestjs/common';
import { OnlyFor } from '../auth/role.guard';

/** The queues (/api/queues, #1026), for the supervisors who decide requests. */
@Controller('queues')
export class QueuesController {
  constructor(private readonly requests: CustomerRequestsService) {}

  /**
   * Every queue, by name: the Turn into ticket popup's choices. Only
   * supervisors, who turn requests into tickets: other roles get 403,
   * signed out 401.
   */
  @Get()
  @OnlyFor('supervisor')
  all(): Promise<QueueSummary[]> {
    return this.requests.queues();
  }
}
