import type { CurrentUser, LiveEvent } from '@helpdesk/contract';
import { LiveHub } from '@helpdesk/server';
import { INestApplication, type MessageEvent } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { SESSION_COOKIE } from '../auth/auth-config';
import { AuthGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { EventsController, KEEP_ALIVE_MS } from './events.controller';

/** Who each session token signs in as. */
const SESSIONS: Record<string, CurrentUser> = {
  sam: { id: 'sam.rivera', name: 'Sam Rivera', role: 'agent', teamId: 'atlas' },
  bea: { id: 'bea.quinn', name: 'Bea Quinn', role: 'agent', teamId: 'beacon' },
};

/** A session that outlasts every test. */
const later = () => new Date(Date.now() + 60 * 60_000);
/** When the "brief" session ends: set in the test that opens it. */
let briefEndsAt = later();

const fakeAuth = {
  currentUser: async (token: string | undefined) =>
    (token && (SESSIONS[token] ?? (token === 'brief' && SESSIONS['sam']))) ||
    null,
  sessionEndsAt: async (token: string | undefined) =>
    token === 'brief' ? briefEndsAt : token ? later() : null,
};

/** A change to a ticket Sam holds, on Atlas. */
const ticketSamHolds = {
  event: { type: 'ticket', ticketId: 'ticket-1' } satisfies LiveEvent,
  audience: {
    kind: 'ticket' as const,
    holderIds: ['sam.rivera'],
    teamIds: ['atlas'],
    unassigned: false,
  },
};

/** A change to unassigned work: everyone's Unassigned list. */
const unassignedWork = {
  event: { type: 'ticket', ticketId: 'ticket-2' } satisfies LiveEvent,
  audience: {
    kind: 'ticket' as const,
    holderIds: [],
    teamIds: [],
    unassigned: true,
  },
};

describe('/api/events', () => {
  let app: INestApplication;
  let live: LiveHub;
  let base: string;
  /** Streams to close after each test. */
  const open: AbortController[] = [];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        AuthGuard,
        LiveHub,
        { provide: AuthService, useValue: fakeAuth },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // As main.ts sets the app up.
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.listen(0);
    live = app.get(LiveHub);
    const { port } = app.getHttpServer().address() as AddressInfo;
    base = `http://localhost:${port}/api/events`;
  });

  afterEach(async () => {
    open.splice(0).forEach((stream) => stream.abort());
    await app.close();
  });

  /** GET /api/events as this session token, or signed out. */
  async function connect(session: string | null) {
    const stream = new AbortController();
    open.push(stream);
    const response = await fetch(base, {
      headers:
        session === null ? {} : { cookie: `${SESSION_COOKIE}=${session}` },
      signal: stream.signal,
    });
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    return {
      response,
      /** The next `message` event's data, parsed. */
      async next(): Promise<unknown> {
        for (;;) {
          const end = buffer.indexOf('\n\n');
          if (end >= 0) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const data = block
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (data && !block.includes('event: ping')) {
              return JSON.parse(data.slice('data: '.length));
            }
            continue;
          }
          const chunk = await reader?.read();
          if (!chunk || chunk.done) {
            throw new Error('The stream ended.');
          }
          buffer += decoder.decode(chunk.value, { stream: true });
        }
      },
    };
  }

  it('turns away a signed-out request (401)', async () => {
    const { response } = await connect(null);

    expect(response.status).toBe(401);
  });

  it('streams the events that concern the signed-in person', async () => {
    const sam = await connect('sam');

    expect(sam.response.status).toBe(200);
    expect(sam.response.headers.get('content-type')).toContain(
      'text/event-stream'
    );
    live.publish(ticketSamHolds);
    expect(await sam.next()).toEqual(ticketSamHolds.event);
  });

  it("leaves out what doesn't concern them", async () => {
    const bea = await connect('bea');

    // Sam's ticket first: Bea hears only the unassigned work after it.
    live.publish(ticketSamHolds);
    live.publish(unassignedWork);

    expect(await bea.next()).toEqual(unassignedWork.event);
  });

  it('says it is still there every so often, as a ping pages ignore', async () => {
    vi.useFakeTimers();
    try {
      const heard: MessageEvent[] = [];
      const subscription = new EventsController(
        live,
        fakeAuth as unknown as AuthService
      )
        .events(SESSIONS['sam'], { cookies: { [SESSION_COOKIE]: 'sam' } })
        .subscribe((event) => heard.push(event));

      await vi.advanceTimersByTimeAsync(KEEP_ALIVE_MS);

      expect(heard).toEqual([{ type: 'ping', data: '' }]);
      subscription.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  // A stream judges by the account as it was when it opened, so it must not
  // outlive its session or an account change; the browser then reconnects,
  // through the sign-in check again (#1073).
  describe('ending', () => {
    it('ends the stream when its session ends, pings and all', async () => {
      briefEndsAt = new Date(Date.now() + 300);
      const sam = await connect('brief');

      expect(sam.response.status).toBe(200);
      await expect(sam.next()).rejects.toThrow('The stream ended.');
    });

    it("ends the stream when the person's account changes, and only theirs", async () => {
      const sam = await connect('sam');
      const bea = await connect('bea');

      live.endStreamsOf('sam.rivera');
      live.publish(unassignedWork);

      await expect(sam.next()).rejects.toThrow('The stream ended.');
      expect(await bea.next()).toEqual(unassignedWork.event);
    });
  });
});
