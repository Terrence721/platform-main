import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { EMPTY } from 'rxjs';
import { initialSessionState } from '../session/session.feature';
import { SignInDialog } from './sign-in-dialog';
import { SignInLauncher } from './sign-in-launcher';

describe('SignInLauncher', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({ initialState: { session: initialSessionState } }),
        provideMockActions(() => EMPTY),
      ],
    });
    return {
      launcher: TestBed.inject(SignInLauncher),
      dialog: TestBed.inject(MatDialog),
    };
  }

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
  });

  it('opens the sign-in popup', async () => {
    const { launcher, dialog } = setUp();

    await launcher.open();

    expect(dialog.openDialogs).toHaveLength(1);
    expect(dialog.openDialogs[0].componentInstance).toBeInstanceOf(
      SignInDialog
    );
  });

  it('opens one popup when clicked twice in quick succession', async () => {
    const { launcher, dialog } = setUp();

    await Promise.all([launcher.open(), launcher.open()]);

    expect(dialog.openDialogs).toHaveLength(1);
  });

  it('does not open a second popup over an open one', async () => {
    const { launcher, dialog } = setUp();

    await launcher.open();
    await launcher.open();

    expect(dialog.openDialogs).toHaveLength(1);
  });

  it('fits the popup to narrow screens', async () => {
    const { launcher } = setUp();

    await launcher.open();

    const pane = document.querySelector<HTMLElement>('.cdk-overlay-pane');
    expect(pane?.style.width).toBe('26rem');
    expect(pane?.style.maxWidth).toBe('calc(100vw - 2rem)');
  });
});
