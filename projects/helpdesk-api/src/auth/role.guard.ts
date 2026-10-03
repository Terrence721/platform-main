import type { Role } from '@helpdesk/contract';
import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard, signedInUserFrom } from './auth.guard';

/** Where `OnlyFor` records the role an endpoint is for. */
export const ONLY_FOR_ROLE = 'helpdesk:only-for-role';

/**
 * Lets a request through only if the signed-in user has the endpoint's
 * role (from `OnlyFor`); otherwise answers 403. An endpoint without a role
 * is closed to everyone, so a forgotten `OnlyFor` fails safe. Runs after
 * AuthGuard, which has already turned away anyone signed out with 401.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const role = this.reflector.getAllAndOverride<Role | undefined>(
      ONLY_FOR_ROLE,
      [context.getHandler(), context.getClass()]
    );
    if (role === undefined || signedInUserFrom(context).role !== role) {
      throw new ForbiddenException();
    }
    return true;
  }
}

/**
 * Opens an endpoint (or a whole controller) to one role only, as the app
 * opens each role's page only to that role: signed out gets 401, any
 * other role 403.
 */
export function OnlyFor(role: Role) {
  return applyDecorators(
    SetMetadata(ONLY_FOR_ROLE, role),
    UseGuards(AuthGuard, RoleGuard)
  );
}
