import type { CurrentUser, Role } from '@helpdesk/contract';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { SignInDialogActions } from '../sign-in/sign-in.actions';
import { SessionApiActions } from './session.actions';

/** Each role's own page, the only one it may open after signing in. */
export const HOME_PAGES: Readonly<Record<Role, string>> = {
  admin: '/admin',
  supervisor: '/supervisor',
  agent: '/agent',
};

export interface SessionState {
  /** The signed-in user; `null` while signed out. */
  user: CurrentUser | null;
  /**
   * Whether the start-up session check has answered. Until then a reload
   * must not be mistaken for being signed out.
   */
  checked: boolean;
  /** Why the last sign-in failed, for the popup; `null` otherwise. */
  signInError: string | null;
}

export const initialSessionState: SessionState = {
  user: null,
  checked: false,
  signInError: null,
};

export const sessionFeature = createFeature({
  name: 'session',
  reducer: createReducer(
    initialSessionState,
    on(
      SessionApiActions.signedIn,
      SessionApiActions.sessionRestored,
      (state, { user }): SessionState => ({
        ...state,
        user,
        checked: true,
        signInError: null,
      })
    ),
    on(SessionApiActions.signInFailed, (state, { message }): SessionState => ({
      ...state,
      signInError: message,
    })),
    // A new attempt clears the last one's error.
    on(SignInDialogActions.submitted, (state): SessionState => ({
      ...state,
      signInError: null,
    })),
    on(
      SessionApiActions.noSession,
      SessionApiActions.signedOut,
      (): SessionState => ({ ...initialSessionState, checked: true })
    )
  ),
  extraSelectors: ({ selectUser }) => ({
    /** The signed-in user's own page; `null` while signed out. */
    selectHomePage: createSelector(selectUser, (user) =>
      user === null ? null : HOME_PAGES[user.role]
    ),
  }),
});
