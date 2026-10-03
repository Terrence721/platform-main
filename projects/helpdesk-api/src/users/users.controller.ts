// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import type { UserAccount } from '@helpdesk/contract';
import { Controller, Get } from '@nestjs/common';
import { OnlyFor } from '../auth/role.guard';
import { UsersService } from './users.service';

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
}
