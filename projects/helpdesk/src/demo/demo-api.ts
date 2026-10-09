import {
  type CurrentUser,
  isUserId,
  REPORT_AGENT_PARAM,
  REPORT_TEAM_PARAM,
  type Role,
  SIGN_IN_FAILED_MESSAGE,
} from '@helpdesk/contract';
import {
  CustomerRequestsService,
  type Database,
  DEFAULT_SEED_PASSWORD,
  historySince,
  NO_MATCHING_REQUEST,
  NO_TEAM_MESSAGE,
  readAssigneeId,
  readCreateAccount,
  readCustomerRequest,
  readDismissal,
  readMessage,
  readSignIn,
  readStatus,
  readTurnIntoTicket,
  readUpdateAccount,
  ReportsService,
  TeamsService,
  TicketMessagesService,
  TicketsService,
  users,
  UsersService,
} from '@helpdesk/server';
import { eq } from 'drizzle-orm';
import {
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from './nest-shim';

// The in-browser demo's API (#942): answers the app's /api requests in the
// page, from the demo database, with the server library's own services and
// request checks. Each route keeps its NestJS controller's rules: who may
// call it (@OnlyFor), what it calls, and the status and message of a
// refusal. The session lives in memory, so it ends on reload with
// everything else.

/** A request as the app sent it. */
export interface DemoRequest {
  method: string;
  /** The path, such as /api/tickets/mine (a full URL also works). */
  url: string;
  body: unknown;
}

/** An answer, as the real API would have sent it. */
export interface DemoResponse {
  status: number;
  body: unknown;
}

/** Who may call a route: these roles only (as the controller's @OnlyFor). */
type Access = readonly Role[];

interface Route {
  method: string;
  /** Matched against the whole path; its groups are the route's params. */
  path: RegExp;
  access: Access;
  /** What the route answers; it throws to refuse, as a controller does. */
  run: (context: {
    user: CurrentUser;
    params: string[];
    /** The query string's parameters, as a controller's @Query reads them. */
    query: URLSearchParams;
    body: unknown;
  }) => Promise<unknown> | unknown;
  /** The status of a success, when it is not 200. */
  status?: number;
}

/** An id in a path: anything up to the next slash. */
const ID = '([^/]+)';

/**
 * The demo's API. Created once with the demo database; `handle` answers
 * one request at a time, as the real API answers HTTP.
 */
export class DemoApi {
  private readonly tickets: TicketsService;
  private readonly messages: TicketMessagesService;
  private readonly teams: TeamsService;
  private readonly accounts: UsersService;
  private readonly reports: ReportsService;
  private readonly customerRequests: CustomerRequestsService;
  /** Who is signed in; `null` until someone signs in. */
  private signedIn: string | null = null;
  /**
   * Passwords of accounts made with Create Account during this visit. The
   * seeded accounts all use the public demo password; the demo never
   * checks a stored hash (that needs Node).
   */
  private readonly passwords = new Map<string, string>();
  private readonly routes: Route[];

  constructor(
    private readonly database: Database,
    private readonly now: () => Date = () => new Date()
  ) {
    this.tickets = new TicketsService(database);
    this.messages = new TicketMessagesService(database);
    this.teams = new TeamsService(database);
    this.accounts = new UsersService(database);
    this.reports = new ReportsService(database);
    this.customerRequests = new CustomerRequestsService(database);
    this.routes = this.defineRoutes();
  }

  /** Answers one request; a refusal comes back as Nest would send it. */
  async handle(request: DemoRequest): Promise<DemoResponse> {
    const url = new URL(request.url, 'http://demo.invalid');
    const path = url.pathname;
    try {
      if (request.method === 'POST' && path === '/api/auth/sign-in') {
        return { status: 200, body: { user: await this.signIn(request.body) } };
      }
      if (request.method === 'POST' && path === '/api/auth/sign-out') {
        this.signedIn = null;
        return { status: 204, body: null };
      }
      // Who is signed in: the user, or null for nobody (still a 200, as in
      // the API's AuthController).
      if (request.method === 'GET' && path === '/api/auth/me') {
        const user =
          this.signedIn === null ? null : await this.activeUser(this.signedIn);
        return { status: 200, body: { user } };
      }
      // The public Report an issue page (#1026), open to anyone, as in the
      // API's CustomerRequestsController; one visitor, so no limits.
      if (request.method === 'POST' && path === '/api/requests') {
        const sent = readCustomerRequest(request.body);
        return {
          status: 201,
          body: await this.customerRequests.send(sent, this.now()),
        };
      }
      if (request.method === 'GET' && path === '/api/requests/status') {
        const answer = await this.customerRequests.statusOf(
          url.searchParams.get('reference') ?? '',
          url.searchParams.get('email') ?? ''
        );
        if (answer === null) {
          throw new NotFoundException(NO_MATCHING_REQUEST);
        }
        return { status: 200, body: answer };
      }
      for (const route of this.routes) {
        const match = route.method === request.method && route.path.exec(path);
        if (match) {
          const user = await this.allowed(route.access);
          const body = await route.run({
            user,
            params: match.slice(1),
            query: url.searchParams,
            body: request.body,
          });
          return { status: route.status ?? 200, body };
        }
      }
      throw new NotFoundException(`Cannot ${request.method} ${path}`);
    } catch (error) {
      return refusal(error);
    }
  }

  /** The routes, as the API's controllers define them. */
  private defineRoutes(): Route[] {
    const agent = ['agent'] as const;
    const supervisor = ['supervisor'] as const;
    const agentOrSupervisor = ['agent', 'supervisor'] as const;
    return [
      // TicketsController
      {
        method: 'GET',
        path: /^\/api\/tickets\/mine$/,
        access: agent,
        run: ({ user }) => this.tickets.assignedTo(user.id),
      },
      {
        method: 'GET',
        path: /^\/api\/tickets\/unassigned$/,
        access: agent,
        run: () => this.tickets.unassigned(),
      },
      {
        method: 'GET',
        path: /^\/api\/tickets\/mine\/finished$/,
        access: agent,
        run: ({ user }) => this.tickets.recentlyFinished(user.id, this.now()),
      },
      // After mine and unassigned, which its pattern matches too.
      {
        method: 'GET',
        path: new RegExp(`^/api/tickets/${ID}$`),
        access: agentOrSupervisor,
        run: ({ user, params: [ticketId] }) => this.tickets.one(ticketId, user),
      },
      {
        method: 'PUT',
        path: new RegExp(`^/api/tickets/${ID}/assignee$`),
        access: ['supervisor', 'agent'],
        run: ({ user, params: [ticketId], body }) => {
          const assigneeId = readAssigneeId(body);
          if (user.role === 'supervisor') {
            return this.tickets.assign(ticketId, assigneeId, user.id);
          }
          if (assigneeId !== user.id) {
            throw new ForbiddenException(
              'Agents can only take tickets for themselves.'
            );
          }
          return this.tickets.take(ticketId, user.id);
        },
      },
      {
        method: 'PUT',
        path: new RegExp(`^/api/tickets/${ID}/status$`),
        access: agentOrSupervisor,
        run: ({ user, params: [ticketId], body }) =>
          this.tickets.changeStatus(ticketId, readStatus(body), user),
      },
      {
        method: 'GET',
        path: new RegExp(`^/api/tickets/${ID}/messages$`),
        access: agentOrSupervisor,
        run: ({ user, params: [ticketId] }) =>
          this.messages.conversation(ticketId, user),
      },
      {
        method: 'POST',
        path: new RegExp(`^/api/tickets/${ID}/messages$`),
        access: agentOrSupervisor,
        status: 201,
        run: ({ user, params: [ticketId], body }) =>
          this.messages.add(ticketId, readMessage(body), user),
      },
      // TeamsController
      {
        method: 'GET',
        path: /^\/api\/teams$/,
        access: ['admin'],
        run: () => this.teams.all(),
      },
      {
        method: 'GET',
        path: /^\/api\/teams\/mine$/,
        access: supervisor,
        run: async ({ user }) => {
          const overview = await this.teams.overviewFor(user.id);
          if (overview === null) {
            throw new NotFoundException(NO_TEAM_MESSAGE);
          }
          return overview;
        },
      },
      {
        method: 'GET',
        path: new RegExp(`^/api/teams/mine/members/${ID}/tickets$`),
        access: supervisor,
        run: async ({ user, params: [userId] }) => {
          const member = await this.memberOf(user, userId);
          return this.tickets.allAssignedTo(member.id);
        },
      },
      {
        method: 'GET',
        path: new RegExp(`^/api/teams/mine/members/${ID}/history$`),
        access: supervisor,
        run: async ({ user, params: [userId] }) => {
          const member = await this.memberOf(user, userId);
          const since = historySince(this.now());
          const { summary, tickets } = await this.tickets.historyFor(
            member.id,
            since
          );
          return { member, since: since.toISOString(), summary, tickets };
        },
      },
      // UsersController
      {
        method: 'GET',
        path: /^\/api\/users$/,
        access: ['admin'],
        run: () => this.accounts.list(),
      },
      {
        method: 'POST',
        path: /^\/api\/users$/,
        access: ['admin'],
        status: 201,
        run: async ({ body }) => {
          const request = readCreateAccount(body);
          const account = await this.accounts.create(request);
          this.passwords.set(account.id, request.password);
          return account;
        },
      },
      {
        method: 'PUT',
        path: new RegExp(`^/api/users/${ID}$`),
        access: ['admin'],
        run: ({ user, params: [userId], body }) =>
          this.accounts.update(userId, readUpdateAccount(body), user.id),
      },
      // CustomerRequestsController's supervisors' routes, and
      // QueuesController (#1026); sending and checking are public, above.
      {
        method: 'GET',
        path: /^\/api\/requests$/,
        access: supervisor,
        run: () => this.customerRequests.pending(),
      },
      {
        method: 'POST',
        path: new RegExp(`^/api/requests/${ID}/ticket$`),
        access: supervisor,
        status: 201,
        run: ({ user, params: [requestId], body }) =>
          this.customerRequests.turnIntoTicket(
            requestId,
            readTurnIntoTicket(body),
            user,
            this.now()
          ),
      },
      {
        method: 'POST',
        path: new RegExp(`^/api/requests/${ID}/dismiss$`),
        access: supervisor,
        status: 204,
        run: async ({ user, params: [requestId], body }) => {
          await this.customerRequests.dismiss(
            requestId,
            readDismissal(body),
            user,
            this.now()
          );
          return null;
        },
      },
      {
        method: 'GET',
        path: /^\/api\/queues$/,
        access: supervisor,
        run: () => this.customerRequests.queues(),
      },
      // ReportsController
      {
        method: 'GET',
        path: /^\/api\/reports$/,
        access: ['supervisor', 'admin'],
        run: ({ user, query }) =>
          this.reports.reportFor(
            user,
            {
              team: query.get(REPORT_TEAM_PARAM) ?? undefined,
              agent: query.get(REPORT_AGENT_PARAM) ?? undefined,
            },
            this.now()
          ),
      },
    ];
  }

  /**
   * Signs in: the account must exist and be active, and the password is
   * the demo's (or the one Create Account set during this visit). Every
   * failure gets the same 401, as in the real API.
   */
  private async signIn(body: unknown): Promise<CurrentUser> {
    const { userId, password } = readSignIn(body);
    const user = await this.activeUser(userId);
    const expected = this.passwords.get(userId) ?? DEFAULT_SEED_PASSWORD;
    if (user === null || password !== expected) {
      throw new UnauthorizedException(SIGN_IN_FAILED_MESSAGE);
    }
    this.signedIn = user.id;
    return user;
  }

  /**
   * The signed-in user, if the route allows them, as AuthGuard and
   * RoleGuard decide: 401 when nobody (still active) is signed in, 403
   * for a role the route is not for.
   */
  private async allowed(access: Access): Promise<CurrentUser> {
    const user =
      this.signedIn === null ? null : await this.activeUser(this.signedIn);
    if (user === null) {
      throw new UnauthorizedException();
    }
    if (!access.includes(user.role)) {
      throw new ForbiddenException();
    }
    return user;
  }

  /** The account by user ID, while it is active; otherwise `null`. */
  private async activeUser(userId: string): Promise<CurrentUser | null> {
    if (!isUserId(userId)) {
      return null;
    }
    const [row] = await this.database
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        teamId: users.teamId,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row?.active) {
      return null;
    }
    return { id: row.id, name: row.name, role: row.role, teamId: row.teamId };
  }

  /** The agent on this supervisor's team, or 404 (as TeamsController). */
  private async memberOf(user: CurrentUser, userId: string) {
    const member = await this.teams.agentLedBy(user.id, userId);
    if (member === null) {
      throw new NotFoundException('No such member on your team.');
    }
    return member;
  }
}

/** Nest's error names, by status, for the `error` field of a refusal. */
const ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
};

/**
 * An error as Nest answers it: an HTTP exception keeps its status and
 * message (`{ statusCode, message, error }`); anything else is a 500.
 */
function refusal(error: unknown): DemoResponse {
  // By shape, not class: in the demo build the services throw the
  // stand-in's exceptions, in the specs Nest's own; both have getStatus.
  if (isHttpException(error)) {
    const status = error.getStatus();
    const error_ = ERROR_NAMES[status] ?? 'Error';
    return {
      status,
      body:
        error.message === error_
          ? { statusCode: status, message: error.message }
          : { statusCode: status, message: error.message, error: error_ },
    };
  }
  console.error('The demo API failed.', error);
  return {
    status: 500,
    body: { statusCode: 500, message: 'Internal server error' },
  };
}

/** Whether an error carries an HTTP status, as Nest's exceptions do. */
function isHttpException(
  error: unknown
): error is Pick<HttpException, 'getStatus' | 'message'> {
  return (
    error instanceof Error &&
    typeof (error as Partial<HttpException>).getStatus === 'function'
  );
}
