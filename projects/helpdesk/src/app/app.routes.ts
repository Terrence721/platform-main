import { Routes } from '@angular/router';

/**
 * The app's top-level routes, each page lazy-loaded. The public landing page
 * is the first page; the sign-in page and the signed-in screens (tickets,
 * admin) add their entries as they are built.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./landing/landing.page'),
    title: 'Helpdesk',
  },
];
