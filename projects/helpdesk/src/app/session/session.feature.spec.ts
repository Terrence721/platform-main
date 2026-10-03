import { CurrentUser, ROLES } from '@helpdesk/contract';
import { Action } from '@ngrx/store';
import { SignInDialogActions } from '../sign-in/sign-in.actions';
import { SessionApiActions } from './session.actions';
import {
  HOME_PAGES,
  initialSessionState,
  sessionFeature,
  SessionState,
} from './session.feature';

const alex: CurrentUser = {
  id: 'alex.morgan',
  name: 'Alex Morgan',
  role: 'admin',
  teamId: null,
};

/** The state after these actions, from the start. */
const after = (...actions: Action[]): SessionState =>
  actions.reduce(sessionFeature.reducer, initialSessionState);

describe('session state', () => {
  it('starts signed out, not yet checked', () => {
    expect(after()).toEqual({ user: null, checked: false, signInError: null });
  });

  it('holds the user after signing in', () => {
    expect(after(SessionApiActions.signedIn({ user: alex }))).toEqual({
      user: alex,
      checked: true,
      signInError: null,
    });
  });

  it('holds the user when start-up finds a session', () => {
    expect(
      after(SessionApiActions.sessionRestored({ user: alex })).user
    ).toEqual(alex);
  });

  it('is checked, and signed out, when start-up finds no session', () => {
    expect(after(SessionApiActions.noSession())).toEqual({
      user: null,
      checked: true,
      signInError: null,
    });
  });

  it('keeps why a sign-in failed, for the popup', () => {
    expect(
      after(
        SessionApiActions.noSession(),
        SessionApiActions.signInFailed({
          message: 'User ID or password is incorrect.',
        })
      )
    ).toEqual({
      user: null,
      checked: true,
      signInError: 'User ID or password is incorrect.',
    });
  });

  it('forgets an earlier failure when the form is sent again', () => {
    expect(
      after(
        SessionApiActions.signInFailed({ message: 'earlier' }),
        SignInDialogActions.submitted({
          request: { userId: 'alex.morgan', password: 'try again' },
        })
      ).signInError
    ).toBeNull();
  });

  it('forgets the failure once signed in', () => {
    expect(
      after(
        SessionApiActions.signInFailed({ message: 'earlier' }),
        SessionApiActions.signedIn({ user: alex })
      ).signInError
    ).toBeNull();
  });

  it('is signed out again after signing out', () => {
    expect(
      after(
        SessionApiActions.signedIn({ user: alex }),
        SessionApiActions.signedOut()
      )
    ).toEqual({ user: null, checked: true, signInError: null });
  });
});

describe('selectHomePage', () => {
  const homeOf = (user: CurrentUser | null) =>
    sessionFeature.selectHomePage.projector(user);

  it.each([
    ['admin', '/admin'],
    ['supervisor', '/supervisor'],
    ['agent', '/agent'],
  ] as const)('sends a signed-in %s to %s', (role, page) => {
    expect(homeOf({ ...alex, role })).toBe(page);
  });

  it('has no page for nobody', () => {
    expect(homeOf(null)).toBeNull();
  });

  it('has a page for exactly the contract roles', () => {
    expect(Object.keys(HOME_PAGES).sort()).toEqual([...ROLES].sort());
  });
});
