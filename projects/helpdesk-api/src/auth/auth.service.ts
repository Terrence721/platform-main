import { CurrentUser, isUserId, PASSWORD_MAX_LENGTH } from '@helpdesk/contract';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module';
import { users } from '../database/schema';
import { hashPassword, verifyPassword } from './password';

/** What a session token carries: the user ID (`sub`) and role. */
interface SessionClaims {
  sub: string;
  role: CurrentUser['role'];
}

/**
 * Signs users in and recognizes them again. Every failed sign-in looks the
 * same from outside, in its answer and its timing, so user IDs cannot be
 * discovered; a deactivated user's session stops working straight away.
 */
@Injectable()
export class AuthService {
  /**
   * Checked when the user ID matches nobody, so an unknown user takes as
   * long as a wrong password. Made once, on first use.
   */
  private dummyHash: Promise<string> | undefined;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly jwt: JwtService
  ) {}

  /** The user and a session token, or `null` for any failure. */
  async signIn(
    userId: string,
    password: string
  ): Promise<{ user: CurrentUser; token: string } | null> {
    if (password.length > PASSWORD_MAX_LENGTH) {
      return null;
    }
    const row = isUserId(userId) ? await this.findUser(userId) : undefined;
    this.dummyHash ??= hashPassword('no user has this password');
    const matches = await verifyPassword(
      password,
      row?.passwordHash ?? (await this.dummyHash)
    );
    if (!row?.active || !matches) {
      return null;
    }
    const user = toCurrentUser(row);
    const claims: SessionClaims = { sub: user.id, role: user.role };
    return { user, token: await this.jwt.signAsync(claims) };
  }

  /** Who a session token belongs to, while it is valid and they are active. */
  async currentUser(token: string | undefined): Promise<CurrentUser | null> {
    if (!token) {
      return null;
    }
    let claims: SessionClaims;
    try {
      claims = await this.jwt.verifyAsync<SessionClaims>(token);
    } catch {
      return null;
    }
    if (typeof claims.sub !== 'string') {
      return null;
    }
    const row = await this.findUser(claims.sub);
    return row?.active ? toCurrentUser(row) : null;
  }

  private async findUser(id: string) {
    const [row] = await this.database
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        teamId: users.teamId,
        active: users.active,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row;
  }
}

function toCurrentUser(row: CurrentUser): CurrentUser {
  return { id: row.id, name: row.name, role: row.role, teamId: row.teamId };
}
