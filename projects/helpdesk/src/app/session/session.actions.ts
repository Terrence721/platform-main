import type { CurrentUser } from '@helpdesk/contract';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

/** What the API says about the session. */
export const SessionApiActions = createActionGroup({
  source: 'Session API',
  events: {
    /** A sign-in from the popup worked. */
    'Signed In': props<{ user: CurrentUser }>(),
    /**
     * A sign-in from the popup failed. `message`, not `error`: the popup
     * shows it, so the app-wide error snack bar (showErrors) must not.
     */
    'Sign In Failed': props<{ message: string }>(),
    /** On start-up, the browser still had a valid session. */
    'Session Restored': props<{ user: CurrentUser }>(),
    /** On start-up, there was no session (or it had expired). */
    'No Session': emptyProps(),
    /** The session has been ended. */
    'Signed Out': emptyProps(),
    /**
     * The API refused a call while signed in (401): the session ran out, or
     * the account was deactivated or changed. Sign in again.
     */
    'Session Ended': emptyProps(),
  },
});

/** What the signed-in user does in the toolbar. */
export const ToolbarActions = createActionGroup({
  source: 'Toolbar',
  events: {
    'Sign Out Clicked': emptyProps(),
  },
});
