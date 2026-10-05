import { HttpClient } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import type { ReportsResponse, TeamReport } from '@helpdesk/contract';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';

/** Where the figures come from, through the dev server's proxy. */
export const REPORTS_API = '/api/reports';

/** `loading` until the first answer; a refresh keeps the figures shown. */
export type ReportsLoadState = 'loading' | 'loaded' | 'failed';

/** Every open ticket a row holds, whatever its priority. */
export function openTickets(team: TeamReport): number {
  const { low, normal, high, urgent } = team.openByPriority;
  return low + normal + high + urgent;
}

/**
 * SLA met %: finished on time over finished with a due time, rounded to a
 * whole percent; `null` when nothing with a due time was finished.
 */
export function slaMetPercent(onTime: number, withDueTime: number) {
  return withDueTime === 0 ? null : Math.round((onTime / withDueTime) * 100);
}

/**
 * The Reports popup's figures (#967), from GET /api/reports. Provided by
 * the popup, so it lives only while the popup is open; it loads when
 * created, and `load` again keeps the current figures on screen until the
 * new ones come. A newer load replaces one still running.
 */
export const ReportsStore = signalStore(
  withState({
    report: null as ReportsResponse | null,
    loadState: 'loading' as ReportsLoadState,
    /** Whether a refresh is running, with figures already shown. */
    refreshing: false,
  }),
  withComputed(({ report }) => ({
    /** The totals across every row: the popup's summary figures. */
    summary: computed(() => {
      const teams = report()?.teams ?? [];
      const sum = (pick: (team: TeamReport) => number) =>
        teams.reduce((total, team) => total + pick(team), 0);
      const finishedOnTime = sum((team) => team.finishedOnTime);
      const finishedWithDueTime = sum((team) => team.finishedWithDueTime);
      return {
        open: sum(openTickets),
        overdue: sum((team) => team.overdue),
        finished: sum((team) => team.finished),
        slaMetPercent: slaMetPercent(finishedOnTime, finishedWithDueTime),
      };
    }),
  })),
  withMethods((store, http = inject(HttpClient)) => ({
    /**
     * Loads the figures: the first time, again after a failure, or for
     * Refresh, when the figures already shown stay until the new ones come.
     */
    load: rxMethod<void>(
      pipe(
        tap(() =>
          store.report() === null
            ? patchState(store, { loadState: 'loading' })
            : patchState(store, { refreshing: true })
        ),
        switchMap(() =>
          http.get<ReportsResponse>(REPORTS_API).pipe(
            tapResponse({
              next: (report) =>
                patchState(store, {
                  report,
                  loadState: 'loaded',
                  refreshing: false,
                }),
              // A failed refresh keeps the figures already shown.
              error: () =>
                patchState(store, {
                  loadState: store.report() === null ? 'failed' : 'loaded',
                  refreshing: false,
                }),
            })
          )
        )
      )
    ),
  })),
  withHooks({
    onInit: (store) => store.load(),
  })
);
