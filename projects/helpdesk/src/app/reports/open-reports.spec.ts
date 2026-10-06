import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { openReports } from './open-reports';
import { ReportsDialog } from './reports.dialog';
import { INITIAL_REPORT_PICK } from './reports.store';

describe('openReports', () => {
  const dialog = { open: vi.fn() };

  beforeEach(() => {
    dialog.open.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialog, useValue: dialog }],
    });
  });

  /** The settings the popup was opened with. */
  const config = () => dialog.open.mock.calls[0][1] as MatDialogConfig;

  it('opens the Reports popup, wide but within a phone screen', async () => {
    await openReports(TestBed.inject(Injector));

    expect(dialog.open).toHaveBeenCalledExactlyOnceWith(ReportsDialog, {
      width: '72rem',
      maxWidth: 'calc(100vw - 2rem)',
      // The charts, not the Refresh button, are what to see first.
      autoFocus: false,
    });
  });

  it('opens on the pick it is given', async () => {
    await openReports(TestBed.inject(Injector), {
      kind: 'agent',
      agentId: 'sam.rivera',
    });

    expect(config().injector?.get(INITIAL_REPORT_PICK)).toEqual({
      kind: 'agent',
      agentId: 'sam.rivera',
    });
  });
});
