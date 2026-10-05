// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import type {
  CurrentUser,
  UpdateAccountResponse,
  UserAccount,
} from '@helpdesk/contract';
import {
  readCreateAccount,
  readUpdateAccount,
  UsersService,
} from '@helpdesk/server';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';

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

  /**
   * Changes an account from the Edit account popup: its role, team and
   * whether it can sign in. 200 with the account and how many open tickets
   * went back to Unassigned; 400 for a field that is wrong or a team that
   * does not fit the role; 404 for no such account; 409 for the admin's own
   * account or for leaving no active admin. Only admins.
   */
  @Put(':userId')
  @OnlyFor('admin')
  update(
    @SignedInUser() admin: CurrentUser,
    @Param('userId') userId: string,
    @Body() body: unknown
  ): Promise<UpdateAccountResponse> {
    return this.users.update(userId, readUpdateAccount(body), admin.id);
  }
}
