import { inject, provideEnvironmentInitializer } from '@angular/core';
import { Routes } from '@angular/router';
import { EntityDataService } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { CapabilitiesDataService } from './landing/capabilities.data-service';
import { CAPABILITY } from './landing/capability';
import * as landingEffects from './landing/landing.effects';
import { landingFeature } from './landing/landing.feature';

/**
 * The app's top-level routes, each page lazy-loaded. The public landing page
 * is the first page; the sign-in page and the signed-in screens (tickets,
 * admin) add their entries as they are built. A page's state and effects are
 * registered on its route, so they exist only once it is visited.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./landing/landing.page'),
    providers: [
      provideState(landingFeature),
      provideEffects(landingEffects),
      // The capabilities come from the app itself until the API serves them.
      provideEnvironmentInitializer(() =>
        inject(EntityDataService).registerService(
          CAPABILITY,
          inject(CapabilitiesDataService)
        )
      ),
    ],
    title: 'Helpdesk',
  },
];
