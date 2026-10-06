import { Injector } from '@angular/core';
import type { ReportPick } from './reports.store';

/**
 * Opens the Reports popup, for the supervisor's and the admin's pages: on
 * `pick` when given (say, the agent picked in Team member), otherwise on
 * the caller's own default. The popup's code (and the charts', when it
 * draws them) is loaded on the first click (dynamic `import()`), not with
 * the page.
 */
export async function openReports(
  injector: Injector,
  pick?: ReportPick
): Promise<void> {
  const [{ MatDialog }, { ReportsDialog }, { INITIAL_REPORT_PICK }] =
    await Promise.all([
      import('@angular/material/dialog'),
      import('./reports.dialog'),
      import('./reports.store'),
    ]);
  injector.get(MatDialog).open(ReportsDialog, {
    width: '72rem',
    maxWidth: 'calc(100vw - 2rem)',
    // The charts, not the Refresh button, are what to see first.
    autoFocus: false,
    ...(pick && {
      injector: Injector.create({
        providers: [{ provide: INITIAL_REPORT_PICK, useValue: pick }],
        parent: injector,
      }),
    }),
  });
}
