import { Action } from '@ngrx/store';
import { StoreDevtoolsConfig } from '@ngrx/store-devtools';
import { SignInDialogActions } from './sign-in.actions';

/** The shape `provideStoreDevtools({ actionSanitizer })` expects. */
type ActionSanitizer = NonNullable<StoreDevtoolsConfig['actionSanitizer']>;

/** What the devtools show in place of a password. */
export const HIDDEN_PASSWORD = '••••••••';

type Submitted = ReturnType<typeof SignInDialogActions.submitted>;

function isSubmitted(action: Action): action is Submitted {
  return action.type === SignInDialogActions.submitted.type;
}

/**
 * The store devtools' action sanitizer: a copy of each action that carries
 * a password, with the password hidden, for the devtools only. The store
 * and effects still receive the action unchanged.
 */
export const hidePasswords: ActionSanitizer = (action) =>
  isSubmitted(action)
    ? {
        ...action,
        request: { ...action.request, password: HIDDEN_PASSWORD },
      }
    : action;
