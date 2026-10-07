// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import {
  type SessionResponse,
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
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { SESSION_COOKIE, sessionCookieOptions } from './auth-config';
import type { SessionRequest } from './auth.guard';
import { AuthService } from './auth.service';
import { SignInLimits, TooManySignInsException } from './sign-in-limits';

/** The part of Express's response the session cookie needs. */
interface CookieResponse {
  cookie(name: string, value: string, options: object): void;
  clearCookie(name: string, options: object): void;
  setHeader(name: string, value: string): void;
}

/** The part of Express's request sign-in needs, besides the body. */
interface SignInRequest {
  is(type: string): string | false | null;
}

/** /api/auth: signing in and out, and who is signed in. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limits: SignInLimits
  ) {}

  /**
   * Signs in: sets the session cookie and answers with the user. Only the
   * app's JSON is accepted: a form, which a page on another site could post
   * to sign its visitor in to the attacker's account, gets 401. After
   * MAX_FAILED_SIGN_INS failures for one user ID in the window, and when
   * too many sign-ins are being checked at once, the answer is 429 with
   * Retry-After, before any password is checked.
   */
  @Post('sign-in')
  @HttpCode(200)
  async signIn(
    @Body() body: unknown,
    @Req() request: SignInRequest,
    @Res({ passthrough: true }) response: CookieResponse
  ): Promise<SignInResponse> {
    if (!request.is('application/json')) {
      throw new UnauthorizedException(SIGN_IN_FAILED_MESSAGE);
    }
    const { userId, password } = readSignIn(body);
    try {
      const wait = this.limits.secondsToWait(userId);
      if (wait > 0) {
        throw new TooManySignInsException(wait);
      }
      const result = await this.limits.run(() =>
        this.auth.signIn(userId, password)
      );
      if (result === null) {
        this.limits.failed(userId);
        throw new UnauthorizedException(SIGN_IN_FAILED_MESSAGE);
      }
      this.limits.succeeded(userId);
      response.cookie(SESSION_COOKIE, result.token, sessionCookieOptions());
      return { user: result.user };
    } catch (error) {
      if (error instanceof TooManySignInsException) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      throw error;
    }
  }

  /**
   * Who is signed in: the user, or `null` without a valid session (none,
   * expired, or an inactive account). Always 200, so the app's question on
   * start-up ("is anyone signed in?") never logs a failed request; every
   * other endpoint still answers 401 when signed out.
   */
  @Get('me')
  async me(@Req() request: SessionRequest): Promise<SessionResponse> {
    return {
      user: await this.auth.currentUser(request.cookies?.[SESSION_COOKIE]),
    };
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
