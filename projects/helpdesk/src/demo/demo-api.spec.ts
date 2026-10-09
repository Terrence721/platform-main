// @vitest-environment node
// PGlite runs WebAssembly that the simulated browser (jsdom) the app's
// other specs use cannot load; the real browser and Node both can.
import {
  isFinished,
  type ReportsResponse,
  SIGN_IN_FAILED_MESSAGE,
  type TeamListing,
  type TeamOverview,
  type TicketDto,
  type TicketMessage,
  type UserAccount,
} from '@helpdesk/contract';
import { DEFAULT_SEED_PASSWORD, UsersService } from '@helpdesk/server';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { DemoApi, type DemoResponse } from './demo-api';
import { type DemoDatabase, startDemoDatabase } from './demo-database';

const MIGRATIONS = fileURLToPath(
  new URL('../../../helpdesk-server/drizzle/', import.meta.url)
);

const NOW = new Date('2026-10-04T12:00:00.000Z');

// One database for the whole file: the tests run in order, and later ones
// build on what earlier ones did (a ticket taken, then answered).
describe('DemoApi', { timeout: 60_000 }, () => {
  let demo: DemoDatabase;
  let api: DemoApi;

  beforeAll(async () => {
    demo = await startDemoDatabase(
      (path) => readFile(MIGRATIONS + path, 'utf8'),
      NOW
    );
    api = new DemoApi(demo.database, () => NOW);
  });

  afterAll(() => demo.client.close());

  const call = (method: string, url: string, body: unknown = null) =>
    api.handle({ method, url, body });
  const signIn = (userId: string, password = DEFAULT_SEED_PASSWORD) =>
    call('POST', '/api/auth/sign-in', { userId, password });

  // The public Report an issue page (#1026), open to anyone, as in the
  // API's CustomerRequestsController. One visitor, so no limits.
  describe('customer requests, for anyone', () => {
    const sent = {
      name: 'Dana Whitfield',
      email: 'dana@example.com',
      category: 'billing',
      impact: 'blocked',
      subject: 'Charged twice',
      description: 'My card was charged twice this month.',
      where: null,
      consent: true,
      website: '',
      fillMilliseconds: 45_000,
    };

    it('keeps a request sent signed out, answering 201 with its reference', async () => {
      await call('POST', '/api/auth/sign-out');

      const { status, body } = await call('POST', '/api/requests', sent);

      expect(status).toBe(201);
      expect((body as { reference: string }).reference).toMatch(/^R-\d+$/);
    });

    it("refuses a wrong field with 400, in the API's words", async () => {
      expect(
        await call('POST', '/api/requests', { ...sent, email: 'dana' })
      ).toMatchObject({
        status: 400,
        body: {
          message: 'Enter your email address, such as dana@example.com.',
        },
      });
    });

    it('tells where a request is up to, by its reference and email, and 404 otherwise', async () => {
      const { body } = await call('POST', '/api/requests', sent);
      const { reference } = body as { reference: string };

      expect(
        await call(
          'GET',
          `/api/requests/status?reference=${reference}&email=DANA@example.com`
        )
      ).toEqual({ status: 200, body: { reference, status: 'pending' } });
      expect(
        await call(
          'GET',
          `/api/requests/status?reference=${reference}&email=x@example.com`
        )
      ).toMatchObject({
        status: 404,
        body: { message: 'No request matches that reference and email.' },
      });
    });
  });

  describe('signing in and out', () => {
    it('answers "nobody" (200) for who is signed in, before anyone is', async () => {
      expect(await call('GET', '/api/auth/me')).toEqual({
        status: 200,
        body: { user: null },
      });
    });

    it('still answers 401 for a route that needs someone signed in', async () => {
      expect(await call('GET', '/api/tickets/mine')).toEqual({
        status: 401,
        body: { statusCode: 401, message: 'Unauthorized' },
      });
    });

    it.each([
      ['a wrong password', 'sam.rivera', 'not-the-password'],
      ['an unknown user', 'no.one', DEFAULT_SEED_PASSWORD],
      ['a user ID that is not one', 'Sam Rivera', DEFAULT_SEED_PASSWORD],
    ])('refuses %s with the same 401', async (_, userId, password) => {
      expect(await signIn(userId, password)).toEqual({
        status: 401,
        body: {
          statusCode: 401,
          message: SIGN_IN_FAILED_MESSAGE,
          error: 'Unauthorized',
        },
      });
    });

    it('signs in with the demo password, and says who is signed in', async () => {
      const response = await signIn('sam.rivera');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: 'sam.rivera',
          name: 'Sam Rivera',
          role: 'agent',
          teamId: 'atlas',
        },
      });
      expect((await call('GET', '/api/auth/me')).body).toEqual(response.body);
    });

    it('signs out (204), after which nobody is signed in', async () => {
      expect(await call('POST', '/api/auth/sign-out')).toEqual({
        status: 204,
        body: null,
      });
      expect(await call('GET', '/api/auth/me')).toEqual({
        status: 200,
        body: { user: null },
      });
    });
  });

  describe('as an agent', () => {
    beforeAll(() => signIn('sam.rivera'));

    it("lists the agent's open tickets, all theirs", async () => {
      const { status, body } = await call('GET', '/api/tickets/mine');

      expect(status).toBe(200);
      expect((body as TicketDto[]).length).toBeGreaterThan(0);
      expect(
        (body as TicketDto[]).every(
          ({ assignee }) => assignee?.id === 'sam.rivera'
        )
      ).toBe(true);
    });

    it('takes an unassigned ticket, and then holds it', async () => {
      const unassigned = (await call('GET', '/api/tickets/unassigned'))
        .body as TicketDto[];
      const [ticket] = unassigned;

      const taken = await call('PUT', `/api/tickets/${ticket.id}/assignee`, {
        assigneeId: 'sam.rivera',
      });

      expect(taken.status).toBe(200);
      expect((taken.body as TicketDto).assignee?.id).toBe('sam.rivera');
      expect(
        ((await call('GET', '/api/tickets/mine')).body as TicketDto[]).some(
          ({ id }) => id === ticket.id
        )
      ).toBe(true);
    });

    it('refuses to take a ticket for someone else (403), as the API does', async () => {
      const [ticket] = (await call('GET', '/api/tickets/unassigned'))
        .body as TicketDto[];

      expect(
        await call('PUT', `/api/tickets/${ticket.id}/assignee`, {
          assigneeId: 'benny.lind',
        })
      ).toMatchObject({
        status: 403,
        body: { message: 'Agents can only take tickets for themselves.' },
      });
    });

    it('changes a ticket status, and refuses a body without one (400)', async () => {
      const [ticket] = (await call('GET', '/api/tickets/mine'))
        .body as TicketDto[];

      expect(
        await call('PUT', `/api/tickets/${ticket.id}/status`, {
          status: 'done',
        })
      ).toMatchObject({
        status: 400,
        body: { message: 'Choose new, open, pending, resolved or closed.' },
      });
      const changed = await call('PUT', `/api/tickets/${ticket.id}/status`, {
        status: 'resolved',
      });
      expect(changed.status).toBe(200);
      expect((changed.body as TicketDto).status).toBe('resolved');
    });

    it("lists the agent's tickets finished in the last day (Done)", async () => {
      const [ticket] = (await call('GET', '/api/tickets/mine'))
        .body as TicketDto[];
      await call('PUT', `/api/tickets/${ticket.id}/status`, {
        status: 'resolved',
      });

      const { status, body } = await call('GET', '/api/tickets/mine/finished');

      expect(status).toBe(200);
      expect((body as TicketDto[]).map(({ id }) => id)).toContain(ticket.id);
      expect(
        (body as TicketDto[]).every(
          (finished) =>
            finished.assignee?.id === 'sam.rivera' &&
            isFinished(finished.status)
        )
      ).toBe(true);
    });

    it('adds a reply (201) that the conversation then shows', async () => {
      const [ticket] = (await call('GET', '/api/tickets/mine'))
        .body as TicketDto[];

      const added = await call('POST', `/api/tickets/${ticket.id}/messages`, {
        kind: 'reply',
        body: '  Fixed on our side.  ',
      });

      expect(added.status).toBe(201);
      expect((added.body as TicketMessage).body).toBe('Fixed on our side.');
      const conversation = (
        await call('GET', `/api/tickets/${ticket.id}/messages`)
      ).body as TicketMessage[];
      expect(conversation.at(-1)).toEqual(added.body);
    });

    it('reads one of their tickets, and answers 404 for one that is not theirs', async () => {
      const [ticket] = (await call('GET', '/api/tickets/mine'))
        .body as TicketDto[];
      const [unassigned] = (await call('GET', '/api/tickets/unassigned'))
        .body as TicketDto[];

      expect(await call('GET', `/api/tickets/${ticket.id}`)).toEqual({
        status: 200,
        body: ticket,
      });
      expect(await call('GET', `/api/tickets/${unassigned.id}`)).toMatchObject({
        status: 404,
        body: { message: 'No such ticket among yours.' },
      });
    });

    it("refuses the admins' and supervisors' routes (403)", async () => {
      expect(await call('GET', '/api/users')).toEqual({
        status: 403,
        body: { statusCode: 403, message: 'Forbidden' },
      });
      expect((await call('GET', '/api/teams/mine')).status).toBe(403);
      expect((await call('GET', '/api/teams')).status).toBe(403);
      expect((await call('GET', '/api/reports')).status).toBe(403);
    });

    it('answers 404 for a route the API does not have', async () => {
      expect(await call('GET', '/api/nothing')).toMatchObject({
        status: 404,
        body: { message: 'Cannot GET /api/nothing' },
      });
    });
  });

  describe('as a supervisor', () => {
    beforeAll(() => signIn('chris.taylor'));

    it('shows the team the supervisor leads', async () => {
      const { status, body } = await call('GET', '/api/teams/mine');

      expect(status).toBe(200);
      expect((body as TeamOverview).id).toBe('atlas');
    });

    it('assigns an unassigned ticket to an agent on the team', async () => {
      const team = (await call('GET', '/api/teams/mine')).body as TeamOverview;
      const [ticket] = team.unassigned;
      const [agent] = team.members;

      const assigned = await call('PUT', `/api/tickets/${ticket.id}/assignee`, {
        assigneeId: agent.id,
      });

      expect(assigned.status).toBe(200);
      expect((assigned.body as TicketDto).assignee?.id).toBe(agent.id);
    });

    it("shows a member's tickets and three-month history", async () => {
      const tickets = await call(
        'GET',
        '/api/teams/mine/members/sam.rivera/tickets'
      );
      const history = await call(
        'GET',
        '/api/teams/mine/members/sam.rivera/history'
      );

      expect(tickets.status).toBe(200);
      expect(history).toMatchObject({
        status: 200,
        body: {
          member: { id: 'sam.rivera' },
          since: '2026-07-04T12:00:00.000Z',
        },
      });
    });

    it("reports on the supervisor's own team, and the unassigned work", async () => {
      const { status, body } = await call('GET', '/api/reports');
      const report = body as ReportsResponse;

      expect(status).toBe(200);
      expect(report).toMatchObject({
        asOf: NOW.toISOString(),
        scope: { teamId: 'atlas' },
      });
      expect(report.teams.map(({ teamId }) => teamId)).toEqual(['atlas', null]);
      // A row per agent on the team, and only their team to pick.
      expect(report.agents.length).toBeGreaterThan(0);
      expect(report.agents.every(({ teamId }) => teamId === 'atlas')).toBe(
        true
      );
      expect(report.choices.teams.map(({ teamId }) => teamId)).toEqual([
        'atlas',
      ]);
    });

    it('reports on one agent of the team when picked (?agent=)', async () => {
      const { status, body } = await call(
        'GET',
        '/api/reports?agent=sam.rivera'
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({
        scope: { agentId: 'sam.rivera' },
        teams: [],
        agents: [{ agentId: 'sam.rivera', name: 'Sam Rivera' }],
      });
    });

    it('answers 404 for another team or its agent, as the API does', async () => {
      expect(await call('GET', '/api/reports?team=beacon')).toMatchObject({
        status: 404,
        body: { message: 'No such team.' },
      });
      expect((await call('GET', '/api/reports?agent=nina.patel')).status).toBe(
        404
      );
    });

    it('answers 404 for an agent on another team, as for no one', async () => {
      const others = (await call('GET', '/api/teams/mine'))
        .body as TeamOverview;
      const notOnTeam = 'nina.patel';

      expect(others.members.some(({ id }) => id === notOnTeam)).toBe(false);
      expect(
        await call('GET', `/api/teams/mine/members/${notOnTeam}/tickets`)
      ).toMatchObject({
        status: 404,
        body: { message: 'No such member on your team.' },
      });
    });
  });

  describe('as an admin', () => {
    beforeAll(() => signIn('alex.morgan'));

    it('lists every account', async () => {
      const { status, body } = await call('GET', '/api/users');

      expect(status).toBe(200);
      expect((body as UserAccount[]).length).toBe(48);
    });

    // As the API's TeamsController: Team accounts lists the teams
    // themselves, so an emptied one is not lost (#1210).
    it('lists every team by name, each with its lead', async () => {
      const { status, body } = await call('GET', '/api/teams');
      const teams = body as TeamListing[];

      expect(status).toBe(200);
      expect(teams.map(({ name }) => name)).toEqual(
        teams.map(({ name }) => name).sort((a, b) => a.localeCompare(b))
      );
      expect(teams).toHaveLength(4);
      expect(teams.every(({ lead }) => lead !== null)).toBe(true);
    });

    it('reports on every team, the open work adding up across them', async () => {
      const { status, body } = await call('GET', '/api/reports');
      const report = body as ReportsResponse;
      const openInRows = report.teams.reduce(
        (total, { openByPriority }) =>
          total + Object.values(openByPriority).reduce((a, b) => a + b, 0),
        0
      );

      expect(status).toBe(200);
      expect(report.scope).toBe('all');
      expect(report.teams.map(({ name }) => name)).toEqual([
        'Team Atlas',
        'Team Beacon',
        'Team Comet',
        'Team Delta',
        'Unassigned',
      ]);
      expect(openInRows).toBeGreaterThan(0);
      expect(
        Object.values(report.openByStatus).reduce((a, b) => a + b, 0)
      ).toBe(openInRows);
    });

    it('creates an account (201) that then signs in with its own password', async () => {
      const created: DemoResponse = await call('POST', '/api/users', {
        userId: 'nia.new',
        name: 'Nia New',
        role: 'agent',
        teamId: 'atlas',
        password: 'a-starting-password',
      });

      expect(created).toMatchObject({ status: 201, body: { id: 'nia.new' } });
      expect((await signIn('nia.new')).status).toBe(401);
      expect((await signIn('nia.new', 'a-starting-password')).status).toBe(200);
    });

    it('refuses a Create Account body that is wrong (400)', async () => {
      await signIn('alex.morgan');

      expect(
        await call('POST', '/api/users', { userId: 'Nia New' })
      ).toMatchObject({ status: 400, body: { error: 'Bad Request' } });
    });

    it("deactivates an account: its open tickets go back, and it can't sign in", async () => {
      await signIn('alex.morgan');

      const changed = await call('PUT', '/api/users/sam.rivera', {
        role: 'agent',
        teamId: 'atlas',
        active: false,
      });

      expect(changed).toMatchObject({
        status: 200,
        body: { account: { id: 'sam.rivera', active: false } },
      });
      expect(
        (changed.body as { releasedTickets: number }).releasedTickets
      ).toBeGreaterThan(0);
      expect((await signIn('sam.rivera')).status).toBe(401);
    });

    it("refuses the admin's own account (409)", async () => {
      await signIn('alex.morgan');

      expect(
        await call('PUT', '/api/users/alex.morgan', {
          role: 'agent',
          teamId: 'atlas',
          active: true,
        })
      ).toMatchObject({
        status: 409,
        body: { message: "You can't change your own account." },
      });
    });

    it('answers an unexpected error with a 500, as Nest does', async () => {
      vi.spyOn(UsersService.prototype, 'list').mockRejectedValueOnce(
        new Error('The database went away.')
      );
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(await call('GET', '/api/users')).toEqual({
        status: 500,
        body: { statusCode: 500, message: 'Internal server error' },
      });
      expect(logged).toHaveBeenCalledWith(
        'The demo API failed.',
        expect.objectContaining({ message: 'The database went away.' })
      );
      logged.mockRestore();
    });
  });
});
