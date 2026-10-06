import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, inject, InjectionToken } from '@angular/core';
import {
  REPORT_AGENT_PARAM,
  REPORT_TEAM_PARAM,
  type ReportChoices,
  type ReportFigures,
  type ReportsResponse,
} from '@helpdesk/contract';
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

/** `loading` until an answer; a refresh keeps the figures shown. */
export type ReportsLoadState = 'loading' | 'loaded' | 'failed';

/**
 * Who the report is for: the caller's own default (an admin's every team,
 * a supervisor's own team), one team, or one agent.
 */
export type ReportPick =
  | { kind: 'default' }
  | { kind: 'team'; teamId: string }
  | { kind: 'agent'; agentId: string };

/** The pick a popup opens on; without one, the caller's default. */
export const INITIAL_REPORT_PICK = new InjectionToken<ReportPick>(
  'INITIAL_REPORT_PICK'
);

/** Every open ticket a row holds, whatever its priority. */
export function openTickets(row: ReportFigures): number {
  const { low, normal, high, urgent } = row.openByPriority;
  return low + normal + high + urgent;
}

/**
 * SLA met %: finished on time over finished with a due time, rounded to a
 * whole percent; `null` when nothing with a due time was finished.
 */
export function slaMetPercent(onTime: number, withDueTime: number) {
  return withDueTime === 0 ? null : Math.round((onTime / withDueTime) * 100);
}

/** GET /api/reports's query for a pick. */
function paramsFor(pick: ReportPick): HttpParams {
  const params = new HttpParams();
  switch (pick.kind) {
    case 'team':
      return params.set(REPORT_TEAM_PARAM, pick.teamId);
    case 'agent':
      return params.set(REPORT_AGENT_PARAM, pick.agentId);
    default:
      return params;
  }
}

/**
 * The Reports popup's figures (#967, #969), from GET /api/reports. Provided
 * by the popup, so it lives only while the popup is open; it loads when
 * created, for INITIAL_REPORT_PICK if the popup was given one. `select`
 * switches who the report is for (the figures go while the new ones load;
 * the "Report for" choices stay). `load` again keeps the current figures on
 * screen until the new ones come. A newer load replaces one still running.
 */
export const ReportsStore = signalStore(
  withState(() => ({
    pick: inject(INITIAL_REPORT_PICK, { optional: true }) ?? {
      kind: 'default' as const,
    },
    report: null as ReportsResponse | null,
    /** What the caller may pick, from the last answer; kept across picks. */
    choices: null as ReportChoices | null,
    loadState: 'loading' as ReportsLoadState,
    /** Whether a refresh is running, with figures already shown. */
    refreshing: false,
  })),
  withComputed(({ report }) => ({
    /**
     * The totals across the rows a report is about: the popup's summary
     * figures. A team's or every team's: its team rows (the agent rows are
     * part of them). An agent's: their own row.
     */
    summary: computed(() => {
      const current = report();
      const rows: ReportFigures[] =
        current === null
          ? []
          : current.teams.length > 0
            ? current.teams
            : current.agents;
      const sum = (pick: (row: ReportFigures) => number) =>
        rows.reduce((total, row) => total + pick(row), 0);
      return {
        open: sum(openTickets),
        overdue: sum((row) => row.overdue),
        finished: sum((row) => row.finished),
        slaMetPercent: slaMetPercent(
          sum((row) => row.finishedOnTime),
          sum((row) => row.finishedWithDueTime)
        ),
      };
    }),
  })),
  withMethods((store, http = inject(HttpClient)) => {
    const load = rxMethod<void>(
      pipe(
        tap(() =>
          store.report() === null
            ? patchState(store, { loadState: 'loading' })
            : patchState(store, { refreshing: true })
        ),
        switchMap(() =>
          http
            .get<ReportsResponse>(REPORTS_API, {
              params: paramsFor(store.pick()),
            })
            .pipe(
              tapResponse({
                next: (report) =>
                  patchState(store, {
                    report,
                    choices: report.choices,
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
    );
    return {
      /**
       * Loads the figures: the first time, again after a failure, or for
       * Refresh, when the figures shown stay until the new ones come.
       */
      load: () => load(),
      /** Reports on someone else: their figures replace the current ones. */
      select(pick: ReportPick): void {
        patchState(store, { pick, report: null });
        load();
      },
    };
  }),
  withHooks({
    onInit: (store) => store.load(),
  })
);
