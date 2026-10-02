import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { SignInDialog } from './sign-in-dialog';
import { SignInDialogActions } from './sign-in.actions';

describe('SignInDialog', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
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

  it('sends the user ID and password, then says sign-in is not available yet', async () => {
    const { dialog, userId, password, signIn, dispatch } = await render();

    await userId.setValue('sam.rivera');
    await password.setValue('correct horse battery');
    await signIn();

    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
      SignInDialogActions.submitted({
        request: { userId: 'sam.rivera', password: 'correct horse battery' },
      })
    );
    const notice = dialog.querySelector('.notice');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent?.trim()).toBe(
      'Signing in becomes available once the Helpdesk API is running.'
    );
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
