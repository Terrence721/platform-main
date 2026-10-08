import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { CurrentUser, SIGN_IN_FAILED_MESSAGE } from '@helpdesk/contract';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject } from 'rxjs';
import { SessionApiActions } from '../session/session.actions';
import {
  initialSessionState,
  SESSION_ENDED_MESSAGE,
  SessionState,
} from '../session/session.feature';
import { SignInDialog } from './sign-in-dialog';
import { SignInDialogActions } from './sign-in.actions';

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};

describe('SignInDialog', () => {
  /** Renders the popup over this session state (signed out, by default). */
  async function render(session: Partial<SessionState> = {}) {
    const actions$ = new Subject<Action>();
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: { session: { ...initialSessionState, ...session } },
        }),
        provideMockActions(() => actions$),
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const store = TestBed.inject(MockStore);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(SignInDialog);
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const field = (label: string) =>
      loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    /** The input inside the field with this label, found as a user would. */
    const input = async (label: string) => {
      const control = await (await field(label)).getControl(MatInputHarness);
      if (!control) {
        throw new Error(`No input in the "${label}" field`);
      }
      return control;
    };
    const dialog = fixture.nativeElement as HTMLElement;
    return {
      dialog,
      dispatch,
      actions$,
      close,
      /** The popup goes away, however it was closed. */
      destroy: () => fixture.destroy(),
      /** What the session reducer would make of the API's answer. */
      setSession: (changes: Partial<SessionState>) => {
        store.setState({ session: { ...initialSessionState, ...changes } });
        fixture.detectChanges();
      },
      /** The error box under the form, if any. */
      errorBox: () => dialog.querySelector('.error'),
      userId: await input('User ID'),
      password: await input('Password'),
      errors: async (label: string) => (await field(label)).getTextErrors(),
      signIn: () =>
        loader
          .getHarness(MatButtonHarness.with({ text: 'Sign in' }))
          .then((button) => button.click()),
      button: (text: string) =>
        loader.getHarness(MatButtonHarness.with({ text })),
      /** The show/hide button, clicked and checked by its accessible name. */
      eye: () => {
        const eyeButton = dialog.querySelector<HTMLButtonElement>(
          'button[aria-label$="password"]'
        );
        if (!eyeButton) {
          throw new Error('No show/hide password button');
        }
        return eyeButton;
      },
    };
  }

  it('asks for a user ID and a password, with Cancel and Sign in', async () => {
    const { dialog, userId, password, button } = await render();

    expect(dialog.querySelector('h2')?.textContent).toBe('Sign in to Helpdesk');
    expect(await userId.getType()).toBe('text');
    expect(await password.getType()).toBe('password');
    expect(await (await button('Cancel')).getAppearance()).toBe('text');
    expect(await (await button('Sign in')).getAppearance()).toBe('filled');
  });

  it('helps password managers fill the form in', async () => {
    const { userId, password } = await render();

    expect(await (await userId.host()).getAttribute('autocomplete')).toBe(
      'username'
    );
    expect(await (await password.host()).getAttribute('autocomplete')).toBe(
      'current-password'
    );
  });

  it('says what is missing and sends nothing when the form is empty', async () => {
    const { dispatch, errors, signIn } = await render();

    await signIn();

    expect(await errors('User ID')).toEqual(['Enter your user ID.']);
    expect(await errors('Password')).toEqual(['Enter your password.']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('explains what a user ID looks like', async () => {
    const { userId, password, errors, signIn, dispatch } = await render();

    await userId.setValue('Sam Rivera');
    await password.setValue('correct horse battery');
    await signIn();

    expect(await errors('User ID')).toEqual([
      'Use lowercase letters, digits, dots and hyphens, starting with a letter.',
    ]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('sends the user ID and password once, and waits for the answer', async () => {
    const { userId, password, signIn, dispatch, button, errorBox } =
      await render();

    await userId.setValue('sam.rivera');
    await password.setValue('correct horse battery');
    await signIn();

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      SignInDialogActions.submitted({
        request: { userId: 'sam.rivera', password: 'correct horse battery' },
      })
    );
    expect(await (await button('Sign in')).isDisabled()).toBe(true);
    expect(errorBox()).toBeNull();
  });

  it('shows why signing in failed, and lets the user try again', async () => {
    const { userId, password, signIn, button, errorBox, setSession } =
      await render();
    await userId.setValue('sam.rivera');
    await password.setValue('wrong password');
    await signIn();

    setSession({ checked: true, signInError: SIGN_IN_FAILED_MESSAGE });

    expect(errorBox()?.getAttribute('role')).toBe('alert');
    expect(errorBox()?.textContent?.trim()).toBe(SIGN_IN_FAILED_MESSAGE);
    expect(await (await button('Sign in')).isDisabled()).toBe(false);
  });

  it('does not show a failure from before it opened', async () => {
    const { errorBox, button } = await render({
      checked: true,
      signInError: SIGN_IN_FAILED_MESSAGE,
    });

    expect(errorBox()).toBeNull();
    expect(await (await button('Sign in')).isDisabled()).toBe(false);
  });

  // A session that ended during work brings the popup back by itself, so it
  // says why before anything is typed.
  it('says why it opened when the session ended during work', async () => {
    const { dialog, setSession } = await render({
      checked: true,
      signInNotice: SESSION_ENDED_MESSAGE,
    });

    const notice = dialog.querySelector('.notice');
    expect(notice?.textContent?.trim()).toBe(SESSION_ENDED_MESSAGE);
    expect(notice?.getAttribute('role')).toBe('status');

    setSession({ checked: true, signInNotice: null });
    expect(dialog.querySelector('.notice')).toBeNull();
  });

  // Cancel, Escape or a click outside: the next popup, opened later from
  // the toolbar, must not still say the session ended.
  it('says it closed, so its word about an ended session goes with it', async () => {
    const { dispatch, destroy } = await render({
      checked: true,
      signInNotice: SESSION_ENDED_MESSAGE,
    });

    destroy();

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      SignInDialogActions.closed()
    );
  });

  it('closes once signed in', async () => {
    const { actions$, close } = await render();

    actions$.next(SessionApiActions.signInFailed({ message: 'no' }));
    expect(close).not.toHaveBeenCalled();

    actions$.next(SessionApiActions.signedIn({ user: sam }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('shows and hides the password', async () => {
    const { password, eye } = await render();
    const eyeButton = eye();

    expect(eyeButton.getAttribute('aria-label')).toBe('Show password');
    expect(eyeButton.type).toBe('button');
    eyeButton.click();
    expect(await password.getType()).toBe('text');
    expect(eyeButton.getAttribute('aria-label')).toBe('Hide password');
    expect(eyeButton.getAttribute('aria-pressed')).toBe('true');
    eyeButton.click();
    expect(await password.getType()).toBe('password');
  });
});
