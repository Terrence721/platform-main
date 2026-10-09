import { CustomerRequestsService } from '@helpdesk/server';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerRequestsController } from './customer-requests.controller';
import { QueuesController } from './queues.controller';
import { RequestLimits } from './request-limits';

/**
 * Customer requests (/api/requests, #1026): the public form's routes and
 * supervisors' New requests, with the queues (/api/queues) a request can
 * become a ticket in. AuthModule brings the guard the supervisors'
 * routes are behind; the database and the live hub come from the global
 * DatabaseModule and LiveModule. One RequestLimits for the whole API.
 */
@Module({
  imports: [AuthModule],
  controllers: [CustomerRequestsController, QueuesController],
  providers: [CustomerRequestsService, RequestLimits],
})
export class CustomerRequestsModule {}
