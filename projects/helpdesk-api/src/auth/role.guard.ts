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

/** Where `OnlyFor` records the roles an endpoint is for. */
export const ONLY_FOR_ROLE = 'helpdesk:only-for-role';

/**
 * Lets a request through only if the signed-in user has one of the
 * endpoint's roles (from `OnlyFor`); otherwise answers 403. An endpoint
 * without roles is closed to everyone, so a forgotten `OnlyFor` fails
 * safe. Runs after AuthGuard, which has already turned away anyone signed
 * out with 401.
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<readonly Role[] | undefined>(
      ONLY_FOR_ROLE,
      [context.getHandler(), context.getClass()]
    );
    if (!roles?.includes(signedInUserFrom(context).role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}

/**
 * Opens an endpoint (or a whole controller) to these roles only, as the
 * app opens each role's page only to that role: signed out gets 401, any
 * other role 403. Usually one role; several when an endpoint serves more
 * than one page.
 */
export function OnlyFor(role: Role, ...moreRoles: Role[]) {
  return applyDecorators(
    SetMetadata(ONLY_FOR_ROLE, [role, ...moreRoles]),
    UseGuards(AuthGuard, RoleGuard)
  );
}
