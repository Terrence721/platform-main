import { LiveEvents } from '@helpdesk/server';
import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';

/**
 * Live updates (#950): one LiveEvents for the whole API, global so the
 * services that publish (in the tickets and users modules) and the
 * stream that listens (/api/events) share it. AuthModule brings the guard
 * the stream is behind.
 */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [LiveEvents],
  exports: [LiveEvents],
})
export class LiveModule {}
