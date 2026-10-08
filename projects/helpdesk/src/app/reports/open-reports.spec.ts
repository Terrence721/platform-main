import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { openReports } from './open-reports';
import { ReportsDialog } from './reports.dialog';
import { INITIAL_REPORT_PICK } from './reports.store';

describe('openReports', () => {
  /** The popups open now, by their dialog ID. */
  let opened: string[];
  const dialog = {
    open: vi.fn((_: unknown, config: MatDialogConfig) => {
      opened.push(String(config.id));
    }),
    getDialogById: (id: string) => (opened.includes(id) ? {} : undefined),
  };

  beforeEach(() => {
    opened = [];
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
      id: 'reports',
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

  // The first time, the popup's code is still on its way when a second
  // click comes, with no backdrop yet to stop it.
  it('opens one popup when Reports is clicked twice at once', async () => {
    const injector = TestBed.inject(Injector);

    await Promise.all([openReports(injector), openReports(injector)]);

    expect(dialog.open).toHaveBeenCalledOnce();
  });
});
