import {
  CustomerRequestsService,
  LiveHub,
  TicketMessagesService,
  TicketsService,
  UsersService,
} from '@helpdesk/server';
import { Module, type Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EventsController } from '../live/events.controller';
import { LiveModule } from '../live/live.module';
import { TicketsController } from '../tickets/tickets.controller';
import { AppModule } from './app.module';

/** The `LiveHub` this service or controller was given, if any. */
function liveHubOf(
  moduleRef: TestingModule,
  holder: Type<unknown>
): LiveHub | undefined {
  return (moduleRef.get(holder, { strict: false }) as { live?: LiveHub }).live;
}

// The services that publish take LiveHub as optional, since the
// in-browser demo builds them without it. So in the API a second LiveHub,
// or none, would start without a word, and what they publish would never
// reach /api/events: no live updates, and a deactivated person's stream
// left open (#1073).
describe('AppModule', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // Builds the whole API; the database is only reached by a query.
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('gives every service that publishes the LiveHub /api/events listens to', () => {
    const listened = liveHubOf(moduleRef, EventsController);

    expect(listened).toBeInstanceOf(LiveHub);
    for (const publisher of [
      TicketsService,
      TicketMessagesService,
      UsersService,
      // New requests' events (#1026).
      CustomerRequestsService,
    ]) {
      expect(liveHubOf(moduleRef, publisher)).toBe(listened);
    }
  });

  it('would show a module that provides a LiveHub of its own', async () => {
    @Module({
      imports: [AuthModule],
      controllers: [TicketsController],
      providers: [TicketsService, TicketMessagesService, LiveHub],
    })
    class WrongTicketsModule {}
    @Module({ imports: [DatabaseModule, LiveModule, WrongTicketsModule] })
    class WrongAppModule {}
    const wrong = await Test.createTestingModule({
      imports: [WrongAppModule],
    }).compile();

    try {
      expect(liveHubOf(wrong, TicketsService)).toBeInstanceOf(LiveHub);
      expect(liveHubOf(wrong, TicketsService)).not.toBe(
        liveHubOf(wrong, EventsController)
      );
    } finally {
      await wrong.close();
    }
  });
});
