import { inject, provideEnvironmentInitializer } from '@angular/core';
import { Routes } from '@angular/router';
import { EntityDataService } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { CapabilitiesDataService } from './landing/capabilities.data-service';
import { CAPABILITY } from './landing/capability';
import * as landingEffects from './landing/landing.effects';
import { landingFeature } from './landing/landing.feature';
import { canMatchRole } from './session/role.guard';

/**
 * The app's top-level routes, each page lazy-loaded. The public landing page
 * is the first page. Each role then has its own page, which only that role
 * can open: anyone else is sent to their own page, or, signed out, to the
 * landing page with the sign-in popup open. Any other address goes to the
 * landing page. A page's state and effects are registered on its route, so
 * they exist only once it is visited.
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
  {
    path: 'agent',
    canMatch: [canMatchRole('agent')],
    loadComponent: () => import('./agent/agent.page'),
    title: 'My tickets · Helpdesk',
  },
  {
    path: 'supervisor',
    canMatch: [canMatchRole('supervisor')],
    loadComponent: () => import('./supervisor/supervisor.page'),
    title: 'My team · Helpdesk',
  },
  {
    path: 'admin',
    canMatch: [canMatchRole('admin')],
    loadComponent: () => import('./admin/admin.page'),
    title: 'Team accounts · Helpdesk',
  },
  // An address that matches nothing, a typo or an old bookmark, goes to
  // the landing page rather than an empty one.
  { path: '**', redirectTo: '' },
];
