import { TicketDto, TicketStatus } from '@helpdesk/contract';
import { createActionGroup, props } from '@ngrx/store';

/** Results of loading the example tickets the landing page's preview shows. */
export const LandingApiActions = createActionGroup({
  source: 'Landing API',
  events: {
    'Example Tickets Loaded': props<{ tickets: TicketDto[] }>(),
    /** `error` is shown to the visitor by the app's showErrors effect. */
    'Example Tickets Load Failed': props<{ error: string }>(),
  },
});

/** What the visitor does on the landing page. */
export const LandingPageActions = createActionGroup({
  source: 'Landing Page',
  events: {
    /** `null` shows tickets of every status. */
    'Status Filter Changed': props<{ status: TicketStatus | null }>(),
  },
});
