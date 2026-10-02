import { LandingPageActions } from '../landing/landing.actions';
import { HIDDEN_PASSWORD, hidePasswords } from './hide-passwords';
import { SignInDialogActions } from './sign-in.actions';

describe('hidePasswords', () => {
  const submitted = SignInDialogActions.submitted({
    request: { userId: 'sam.rivera', password: 'correct horse battery' },
  });

  it('hides the password from the devtools, keeping the user ID', () => {
    expect(hidePasswords(submitted, 1)).toEqual({
      type: '[Sign In Dialog] Submitted',
      request: { userId: 'sam.rivera', password: HIDDEN_PASSWORD },
    });
  });

  it('leaves the action the store receives untouched', () => {
    hidePasswords(submitted, 1);

    expect(submitted.request.password).toBe('correct horse battery');
  });

  it('passes every other action through as it is', () => {
    const opened = LandingPageActions.opened();

    expect(hidePasswords(opened, 2)).toBe(opened);
  });
});
