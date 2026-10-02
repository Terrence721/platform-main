import { TicketDto, TicketStatus } from '@helpdesk/contract';
import { createActionGroup, emptyProps, props } from '@ngrx/store';

/** Results of loading the showcase tickets the landing page's preview shows. */
export const LandingApiActions = createActionGroup({
  source: 'Landing API',
  events: {
    'Showcase Tickets Loaded': props<{ tickets: TicketDto[] }>(),
    /** `error` is shown to the visitor by the app's showErrors effect. */
    'Showcase Tickets Load Failed': props<{ error: string }>(),
  },
});

/** What the visitor does on the landing page. */
export const LandingPageActions = createActionGroup({
  source: 'Landing Page',
  events: {
    /** The page was opened; its showcase tickets load in response. */
    Opened: emptyProps(),
    /** `null` shows tickets of every status. */
    'Status Filter Changed': props<{ status: TicketStatus | null }>(),
  },
});
