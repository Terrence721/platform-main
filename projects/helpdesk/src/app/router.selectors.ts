import { getRouterSelectors, RouterReducerState } from '@ngrx/router-store';
import { createSelector } from '@ngrx/store';

/**
 * Selectors over the router state that `provideRouterStore()` keeps. The
 * slice is read directly, not through createFeatureSelector, because it is
 * undefined until the first navigation and the feature selector warns
 * about that in development.
 */
export const { selectFragment } = getRouterSelectors(
  (state: { router: RouterReducerState }) => state.router
);

/** The landing page's sections that the toolbar links to, in page order. */
export const PAGE_SECTIONS = [
  { fragment: 'features', label: 'Features' },
  { fragment: 'workflow', label: 'How it works' },
  { fragment: 'roles', label: 'Roles' },
] as const;

export type PageSection = (typeof PAGE_SECTIONS)[number]['fragment'];

/**
 * The section the URL points at, such as `features` for `/#features`, or
 * `null` when it points at none of them. It changes when a link is
 * followed, not when the visitor scrolls by hand.
 */
export const selectCurrentSection = createSelector(
  selectFragment,
  (fragment): PageSection | null =>
    PAGE_SECTIONS.find((section) => section.fragment === fragment)?.fragment ??
    null
);
