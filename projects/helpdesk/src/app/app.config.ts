import {
  ApplicationConfig,
  isDevMode,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import * as appEffects from './app.effects';
import { routes } from './app.routes';
import { CAPABILITY } from './landing/capability';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(routes, withComponentInputBinding()),
    provideStore({ router: routerReducer }),
    provideRouterStore(),
    provideEffects(appEffects),
    // @ngrx/data's entity cache, for data the app only lists and edits
    // (the landing page's capabilities now; admin data once there is some).
    provideEntityData({ entityMetadata: { [CAPABILITY]: {} } }, withEffects()),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      name: 'Helpdesk',
    }),
  ],
};
