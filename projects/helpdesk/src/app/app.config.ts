import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { DOCUMENT, ViewportScroller } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import * as appEffects from './app.effects';
import { routes } from './app.routes';
import { CAPABILITY } from './landing/capability';
import {
  goHomeAfterSignIn,
  leaveAfterSignOut,
  restoreSession,
  signIn,
  signOut,
} from './session/session.effects';
import { sessionFeature } from './session/session.feature';
import { hidePasswords } from './sign-in/hide-passwords';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Links like /#features scroll to their section; back and forward
      // return to where the visitor was.
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
    // Stop short of the sticky toolbar, so it does not cover the section it
    // scrolled to. Measured each time: the toolbar is shorter on phones.
    provideAppInitializer(() => {
      const document = inject(DOCUMENT);
      inject(ViewportScroller).setOffset(() => [
        0,
        document.querySelector('mat-toolbar')?.clientHeight ?? 0,
      ]);
    }),
    provideStore({ router: routerReducer }),
    provideRouterStore(),
    // Who is signed in: checked with the API on start-up, then kept here.
    provideState(sessionFeature),
    provideEffects(appEffects, {
      restoreSession,
      signIn,
      goHomeAfterSignIn,
      signOut,
      leaveAfterSignOut,
    }),
    // @ngrx/data's entity cache, for data the app only lists and edits
    // (the landing page's capabilities now; admin data once there is some).
    provideEntityData({ entityMetadata: { [CAPABILITY]: {} } }, withEffects()),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      name: 'Helpdesk',
      // The devtools see sign-in actions with the password hidden.
      actionSanitizer: hidePasswords,
    }),
  ],
};
