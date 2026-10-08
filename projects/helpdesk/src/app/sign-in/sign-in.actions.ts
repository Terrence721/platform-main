import type { SignInRequest } from '@helpdesk/contract';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

/** What the person does in the sign-in popup. */
export const SignInDialogActions = createActionGroup({
  source: 'Sign In Dialog',
  events: {
    /**
     * The form was sent; the session effects (`signIn`) send it to the API.
     * The request holds the password, so the store devtools must not log it
     * as it is (`hidePasswords`).
     */
    Submitted: props<{ request: SignInRequest }>(),
    /**
     * The popup went away (signed in, Cancel, Escape or a click outside), so
     * what it said about an ended session goes too.
     */
    Closed: emptyProps(),
  },
});
