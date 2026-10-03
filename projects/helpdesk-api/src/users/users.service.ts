import type { UserAccount } from '@helpdesk/contract';
import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module';
import { teams, users } from '../database/schema';

/** Reads Helpdesk accounts, for admins. */
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /**
   * Every account, by name: user ID, name, role, team and whether it is
   * active. Only these columns are read, so a password hash never leaves
   * the database. Drizzle gives the left-joined team as `null` for anyone
   * without one (admins).
   */
  list(): Promise<UserAccount[]> {
    return this.database
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        team: { id: teams.id, name: teams.name },
        active: users.active,
      })
      .from(users)
      .leftJoin(teams, eq(users.teamId, teams.id))
      .orderBy(asc(users.name), asc(users.id));
  }
}
