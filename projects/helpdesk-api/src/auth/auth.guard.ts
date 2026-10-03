import type { CurrentUser } from '@helpdesk/contract';
import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SESSION_COOKIE } from './auth-config';
import { AuthService } from './auth.service';

/** A request as it reaches a guarded endpoint. */
export interface SessionRequest {
  /** Read by cookie-parser (main.ts). */
  cookies?: Record<string, string | undefined>;
  /** Set by AuthGuard once the session is recognized. */
  user?: CurrentUser;
}

/**
 * Lets a request through only with a valid session for an active user, and
 * attaches that user; otherwise answers 401 without saying why.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const user = await this.auth.currentUser(request.cookies?.[SESSION_COOKIE]);
    if (user === null) {
      throw new UnauthorizedException();
    }
    request.user = user;
    return true;
  }
}

/** The user AuthGuard attached to the request. */
export function signedInUserFrom(context: ExecutionContext): CurrentUser {
  const { user } = context.switchToHttp().getRequest<SessionRequest>();
  if (user === undefined) {
    // Only reachable if an endpoint forgets AuthGuard.
    throw new UnauthorizedException();
  }
  return user;
}

/** The signed-in user, in an endpoint behind AuthGuard. */
export const SignedInUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): CurrentUser =>
    signedInUserFrom(context)
);
