// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import {
  type CurrentUser,
  SIGN_IN_FAILED_MESSAGE,
  type SignInResponse,
} from '@helpdesk/contract';
import { readSignIn } from '@helpdesk/server';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SESSION_COOKIE, sessionCookieOptions } from './auth-config';
import { AuthGuard, SignedInUser } from './auth.guard';
import { AuthService } from './auth.service';

/** The part of Express's response the session cookie needs. */
interface CookieResponse {
  cookie(name: string, value: string, options: object): void;
  clearCookie(name: string, options: object): void;
}

/** /api/auth: signing in and out, and who is signed in. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Signs in: sets the session cookie and answers with the user. */
  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse
  ): Promise<SignInResponse> {
    const { userId, password } = readSignIn(body);
    const result = await this.auth.signIn(userId, password);
    if (result === null) {
      throw new UnauthorizedException(SIGN_IN_FAILED_MESSAGE);
    }
    response.cookie(SESSION_COOKIE, result.token, sessionCookieOptions());
    return { user: result.user };
  }

  /** Who is signed in; 401 without a valid session. */
  @Get('me')
  @UseGuards(AuthGuard)
  me(@SignedInUser() user: CurrentUser): SignInResponse {
    return { user };
  }

  /** Signs out: the browser drops the session cookie. */
  @Post('sign-out')
  @HttpCode(204)
  signOut(@Res({ passthrough: true }) response: CookieResponse): void {
    // The same settings as when it was set, without its lifetime, or the
    // browser keeps it.
    const { maxAge: _maxAge, ...options } = sessionCookieOptions();
    response.clearCookie(SESSION_COOKIE, options);
  }
}
