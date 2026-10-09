import { CustomerRequestsService } from '@helpdesk/server';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerRequestsController } from './customer-requests.controller';
import { RequestLimits } from './request-limits';

/**
 * Customer requests (/api/requests, #1026): the public form's routes and
 * supervisors' New requests. AuthModule brings the guard the supervisors'
 * routes are behind; the database and the live hub come from the global
 * DatabaseModule and LiveModule. One RequestLimits for the whole API.
 */
@Module({
  imports: [AuthModule],
  controllers: [CustomerRequestsController],
  providers: [CustomerRequestsService, RequestLimits],
})
export class CustomerRequestsModule {}
