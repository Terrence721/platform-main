import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * The Helpdesk API's root module. Each feature (tickets, sign-in, the
 * database) arrives as its own module in `imports`; for now the API only
 * answers its health check.
 */
@Module({
  controllers: [HealthController],
})
export class AppModule {}
