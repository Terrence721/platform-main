import {
  type CreateAccountRequest,
  type UserAccount,
  USER_ID_TAKEN_MESSAGE,
} from '@helpdesk/contract';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { hashPassword } from '../auth/password';
import { DATABASE, type Database } from '../database/database-token';
import { teams, users } from '../database/schema';

/** Reads and creates Helpdesk accounts, for admins. */
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /**
   * Every account, by name: user ID, name, role, team, whether they lead
   * it, and whether it is active. Only these columns are read, so a
   * password hash never leaves the database. Drizzle gives the left-joined
   * team as `null` for anyone without one (admins).
   */
  list(): Promise<UserAccount[]> {
    return this.database
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
      .leftJoin(teams, eq(users.teamId, teams.id))
      .orderBy(asc(users.name), asc(users.id));
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

    return this.database.transaction(async (tx) => {
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
  }
}
