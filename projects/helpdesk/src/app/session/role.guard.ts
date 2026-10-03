import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import type { Role } from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import { filter, map, take } from 'rxjs';
import { SignInLauncher } from '../sign-in/sign-in-launcher';
import { HOME_PAGES, sessionFeature } from './session.feature';

/**
 * Lets only `role` open a page. It first waits for the start-up session
 * check, so a reload is not mistaken for being signed out. Signed out: the
 * landing page, with the sign-in popup open. Another role: that role's own
 * page, never this one.
 */
export function canMatchRole(role: Role): CanMatchFn {
  return () => {
    const router = inject(Router);
    const signIn = inject(SignInLauncher);
    return inject(Store)
      .select(sessionFeature.selectSessionState)
      .pipe(
        filter(({ checked }) => checked),
        take(1),
        map(({ user }) => {
          if (user === null) {
            void signIn.open();
            return router.parseUrl('/');
          }
          return user.role === role
            ? true
            : router.parseUrl(HOME_PAGES[user.role]);
        })
      );
  };
}
