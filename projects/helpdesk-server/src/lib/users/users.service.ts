import {
  type CreateAccountRequest,
  LAST_ADMIN_MESSAGE,
  OWN_ACCOUNT_MESSAGE,
  type UpdateAccountRequest,
  type UpdateAccountResponse,
  type UserAccount,
  USER_ID_TAKEN_MESSAGE,
} from '@helpdesk/contract';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { hashPassword } from '../auth/password';
import { DATABASE, type Database } from '../database/database-token';
import { teams, tickets, users } from '../database/schema';
import { LiveEvents } from '../live/live-events';
import { OPEN_WORK_STATUSES } from '../tickets/tickets.service';

/**
 * Reads, creates and changes Helpdesk accounts, for admins. Each change is
 * told to the open pages it concerns (`live`, #950): accounts to admins
 * and supervisors; tickets an edit hands back, as unassigned work.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    // Named, as an optional parameter's recorded type is only `Object`.
    @Optional() @Inject(LiveEvents) private readonly live?: LiveEvents
  ) {}

  /** Tells admins and supervisors the accounts changed. */
  private accountsChanged(): void {
    this.live?.publish({
      event: { type: 'accounts' },
      audience: { kind: 'accounts' },
    });
  }

  /**
   * Every account, by name: user ID, name, role, team, whether they lead
   * it, and whether it is active. Only these columns are read, so a
   * password hash never leaves the database. Drizzle gives the left-joined
   * team as `null` for anyone without one (admins).
   */
  list(): Promise<UserAccount[]> {
    return selectAccounts(this.database).orderBy(
      asc(users.name),
      asc(users.id)
    );
  }

  /**
   * Creates an account, all in one transaction, so a refusal leaves nothing
   * behind. An admin has no team; an agent or supervisor needs one that
   * exists (400 otherwise). A taken user ID is 409. The password is stored
   * only as its hash. A new supervisor becomes their team's lead; the
   * previous lead stays on the team, no longer leading it. The fields'
   * formats are checked before this, where the request arrives.
   */
  async create(request: CreateAccountRequest): Promise<UserAccount> {
    const { userId, name, role, teamId, password } = request;
    if (role === 'admin' && teamId !== null) {
      throw new BadRequestException('An admin belongs to no team.');
    }
    if (role !== 'admin' && teamId === null) {
      throw new BadRequestException('Choose a team.');
    }
    // Hashing is slow on purpose, so it happens before the transaction.
    const passwordHash = await hashPassword(password);

    const account = await this.database.transaction(async (tx) => {
      let team: { id: string; name: string } | null = null;
      if (teamId !== null) {
        [team = null] = await tx
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(eq(teams.id, teamId));
        if (team === null) {
          throw new BadRequestException('That team does not exist.');
        }
      }
      // The user ID's primary key decides, so two admins creating the
      // same ID at once cannot both succeed.
      const created = await tx
        .insert(users)
        .values({ id: userId, name, role, passwordHash, teamId })
        .onConflictDoNothing({ target: users.id })
        .returning({ id: users.id, active: users.active });
      if (created.length === 0) {
        throw new ConflictException(USER_ID_TAKEN_MESSAGE);
      }
      if (role === 'supervisor' && team !== null) {
        await tx
          .update(teams)
          .set({ supervisorId: userId })
          .where(eq(teams.id, team.id));
      }
      return {
        id: userId,
        name,
        role,
        team,
        // A new supervisor has just become the lead.
        leadsTeam: role === 'supervisor',
        active: created[0].active,
      };
    });
    this.accountsChanged();
    return account;
  }

  /**
   * Changes an account's role, team and whether it can sign in, all in one
   * transaction with the account locked, so a refusal changes nothing.
   *
   * - 404 for no such account; 409 for the admin's own account, or for a
   *   change that would leave no active admin; the team rules are Create
   *   Account's (400).
   * - Someone who is no longer an active agent on the same team
   *   (deactivated, moved to another team, made a supervisor or an admin)
   *   hands their open tickets (new, open, pending) back to Unassigned, the
   *   list every team works from; finished tickets keep their assignee, for
   *   the history.
   * - A lead who is deactivated, stops being a supervisor or moves team
   *   leaves that team with no lead; an active supervisor newly on a team,
   *   or newly a supervisor there, becomes its lead (as in Create Account).
   */
  async update(
    userId: string,
    request: UpdateAccountRequest,
    adminId: string
  ): Promise<UpdateAccountResponse> {
    const { role, teamId, active } = request;
    if (userId === adminId) {
      throw new ConflictException(OWN_ACCOUNT_MESSAGE);
    }
    if (role === 'admin' && teamId !== null) {
      throw new BadRequestException('An admin belongs to no team.');
    }
    if (role !== 'admin' && teamId === null) {
      throw new BadRequestException('Choose a team.');
    }

    const { response, released, formerTeamId } =
      await this.database.transaction(async (tx) => {
        const [before] = await tx
          .select({
            role: users.role,
            teamId: users.teamId,
            active: users.active,
          })
          .from(users)
          .where(eq(users.id, userId))
          .for('update');
        if (before === undefined) {
          throw new NotFoundException('No such account.');
        }
        if (teamId !== null) {
          const [team] = await tx
            .select({ id: teams.id })
            .from(teams)
            .where(eq(teams.id, teamId));
          if (team === undefined) {
            throw new BadRequestException('That team does not exist.');
          }
        }

        // An active admin who stops being one needs another active admin
        // left. The others are locked too, so two admins removing each other
        // at once cannot both succeed.
        const stopsBeingAdmin =
          before.role === 'admin' &&
          before.active &&
          (role !== 'admin' || !active);
        if (stopsBeingAdmin) {
          const otherAdmins = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.role, 'admin'),
                eq(users.active, true),
                ne(users.id, userId)
              )
            )
            .for('update');
          if (otherAdmins.length === 0) {
            throw new ConflictException(LAST_ADMIN_MESSAGE);
          }
        }

        await tx
          .update(users)
          .set({ role, teamId, active })
          .where(eq(users.id, userId));

        // Open work goes back to Unassigned when its holder is no longer an
        // active agent on the same team. Supervisors don't work tickets, and
        // reassigning takes only an agent's, so a new supervisor's would be
        // stuck (#1009).
        const leavesTeamWork =
          !active || role !== 'agent' || teamId !== before.teamId;
        const released = leavesTeamWork
          ? await tx
              .update(tickets)
              .set({ assigneeId: null })
              .where(
                and(
                  eq(tickets.assigneeId, userId),
                  inArray(tickets.status, [...OPEN_WORK_STATUSES])
                )
              )
              .returning({ id: tickets.id })
          : [];

        // The team lead.
        const stillLeads =
          active && role === 'supervisor' && teamId === before.teamId;
        if (!stillLeads) {
          await tx
            .update(teams)
            .set({ supervisorId: null })
            .where(eq(teams.supervisorId, userId));
        }
        const becomesLead =
          active &&
          role === 'supervisor' &&
          teamId !== null &&
          (before.role !== 'supervisor' || teamId !== before.teamId);
        if (becomesLead) {
          await tx
            .update(teams)
            .set({ supervisorId: userId })
            .where(eq(teams.id, teamId));
        }

        const [account] = await selectAccounts(tx).where(eq(users.id, userId));
        return {
          response: { account, releasedTickets: released.length },
          released,
          formerTeamId: before.teamId,
        };
      });

    this.accountsChanged();
    // Their open streams judge by the account as it was: end them, and the
    // browser reconnects under the new role and team, or not at all (#1073).
    this.live?.endStreamsOf(userId);
    // Each ticket handed back is unassigned work now: everyone's
    // Unassigned list changes, and the holder's and their old team's.
    for (const { id } of released) {
      this.live?.publish({
        event: { type: 'ticket', ticketId: id },
        audience: {
          kind: 'ticket',
          holderIds: [userId],
          teamIds: formerTeamId === null ? [] : [formerTeamId],
          unassigned: true,
        },
      });
    }
    return response;
  }
}

/**
 * Accounts as the admin page shows them: user ID, name, role, team,
 * whether they lead it, and whether they are active. Only these columns
 * are read, so a password hash never leaves the database. Drizzle gives
 * the left-joined team as `null` for anyone without one (admins).
 */
function selectAccounts(database: Pick<Database, 'select'>) {
  return database
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      team: { id: teams.id, name: teams.name },
      // Someone with no team leads none: null = false.
      leadsTeam: sql<boolean>`coalesce(${teams.supervisorId} = ${users.id}, false)`,
      active: users.active,
    })
    .from(users)
    .leftJoin(teams, eq(users.teamId, teams.id));
}
