import type { Injector } from '@angular/core';

/**
 * Opens the Reports popup, for the supervisor's and the admin's pages. The
 * popup's code (and the charts', when it draws them) is loaded on the
 * first click (dynamic `import()`), not with the page.
 */
export async function openReports(injector: Injector): Promise<void> {
  const [{ MatDialog }, { ReportsDialog }] = await Promise.all([
    import('@angular/material/dialog'),
    import('./reports.dialog'),
  ]);
  injector.get(MatDialog).open(ReportsDialog, {
    width: '72rem',
    maxWidth: 'calc(100vw - 2rem)',
    autoFocus: false,
  });
}
