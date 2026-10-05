import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { openReports } from './open-reports';
import { ReportsDialog } from './reports.dialog';

describe('openReports', () => {
  it('opens the Reports popup, wide but within a phone screen', async () => {
    const dialog = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialog, useValue: dialog }],
    });

    await openReports(TestBed.inject(Injector));

    expect(dialog.open).toHaveBeenCalledExactlyOnceWith(ReportsDialog, {
      width: '72rem',
      maxWidth: 'calc(100vw - 2rem)',
      // The charts, not the Refresh button, are what to see first.
      autoFocus: false,
    });
  });
});
