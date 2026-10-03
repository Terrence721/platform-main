// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import {
  ACCOUNT_NAME_MAX_LENGTH,
  type CreateAccountRequest,
  isRole,
  isUserId,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type UserAccount,
} from '@helpdesk/contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { OnlyFor } from '../auth/role.guard';
import { UsersService } from './users.service';

/**
 * The fields of a Create Account body, checked one by one; the first that
 * is wrong is refused with 400 and says what is expected. The name is
 * trimmed. Team rules (whether this role needs a team) are the service's.
 */
export function readCreateAccount(body: unknown): CreateAccountRequest {
  const fields = (typeof body === 'object' && body !== null ? body : {}) as {
    userId?: unknown;
    name?: unknown;
    role?: unknown;
    teamId?: unknown;
    password?: unknown;
  };
  if (!isUserId(fields.userId)) {
    throw new BadRequestException(
      'Use a user ID of 3 to 32 lowercase letters, digits, dots and hyphens, starting with a letter.'
    );
  }
  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  if (name.length === 0 || name.length > ACCOUNT_NAME_MAX_LENGTH) {
    throw new BadRequestException(
      `Enter a name of 1 to ${ACCOUNT_NAME_MAX_LENGTH} characters.`
    );
  }
  if (!isRole(fields.role)) {
    throw new BadRequestException('Choose agent, supervisor or admin.');
  }
  const teamId = fields.teamId ?? null;
  if (teamId !== null && typeof teamId !== 'string') {
    throw new BadRequestException('Choose a team.');
  }
  const password = fields.password;
  if (
    typeof password !== 'string' ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new BadRequestException(
      `Use a password of ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`
    );
  }
  return { userId: fields.userId, name, role: fields.role, teamId, password };
}

/** Helpdesk accounts, for admins (/api/users). */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /**
   * Every account, by name: the admin page's Team accounts. Only admins,
   * like the page itself: other roles get 403, signed out 401.
   */
  @Get()
  @OnlyFor('admin')
  list(): Promise<UserAccount[]> {
    return this.users.list();
  }

  /**
   * Creates an account from the Create Account form: 201 with the new
   * account; 400 for a field that is wrong or a team that does not fit the
   * role; 409 for a user ID someone has. Only admins.
   */
  @Post()
  @OnlyFor('admin')
  create(@Body() body: unknown): Promise<UserAccount> {
    return this.users.create(readCreateAccount(body));
  }
}
