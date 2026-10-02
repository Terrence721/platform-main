import { SignInRequest } from '@helpdesk/contract';
import { createActionGroup, props } from '@ngrx/store';

/** What the person does in the sign-in popup. */
export const SignInDialogActions = createActionGroup({
  source: 'Sign In Dialog',
  events: {
    /**
     * The form was sent. The auth phase adds the effect that calls the API
     * with it. The request holds the password, so the store devtools must
     * not log it as it is.
     */
    Submitted: props<{ request: SignInRequest }>(),
  },
});
