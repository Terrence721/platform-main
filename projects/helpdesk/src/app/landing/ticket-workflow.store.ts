import { computed } from '@angular/core';
import {
  canTransition,
  TICKET_STATUS_TRANSITIONS,
  TICKET_STATUSES,
  type TicketStatus,
} from '@helpdesk/contract';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { STATUS_LABELS } from '../tickets/status-labels';

/**
 * How the landing page names and explains each status: the app's own label
 * (`STATUS_LABELS`), an icon, and what it means, in what the app does.
 */
export const STATUS_GUIDE: Readonly<
  Record<TicketStatus, { label: string; icon: string; meaning: string }>
> = {
  new: {
    label: STATUS_LABELS.new,
    icon: 'fiber_new',
    meaning: 'Just raised. Nobody has picked it up yet.',
  },
  open: {
    label: STATUS_LABELS.open,
    icon: 'play_circle',
    meaning: 'Someone on the team is working on it.',
  },
  pending: {
    label: STATUS_LABELS.pending,
    icon: 'hourglass_top',
    meaning:
      'Waiting on the customer. Whoever holds it moves it back to open when they hear back.',
  },
  resolved: {
    label: STATUS_LABELS.resolved,
    icon: 'task_alt',
    meaning: "Answered. If the customer says it isn't fixed, reopen it.",
  },
  closed: {
    label: STATUS_LABELS.closed,
    icon: 'lock',
    meaning: 'Final. A new problem gets a new ticket and a new number.',
  },
};

/** One status in the workflow, as seen from the picked one. */
export interface WorkflowStep {
  status: TicketStatus;
  label: string;
  icon: string;
  picked: boolean;
  /** Whether a ticket can move here from the picked status. */
  reachable: boolean;
}

/**
 * The "How a ticket moves" section's state: which status the visitor has
 * picked, and from it where a ticket can go next. The statuses and moves
 * come from the contract, so the page shows exactly what the API allows.
 * Provided by the section, so it lives as long as the section.
 */
export const TicketWorkflowStore = signalStore(
  withState<{ picked: TicketStatus }>({ picked: 'new' }),
  withComputed(({ picked }) => ({
    steps: computed((): WorkflowStep[] =>
      TICKET_STATUSES.map((status) => ({
        status,
        label: STATUS_GUIDE[status].label,
        icon: STATUS_GUIDE[status].icon,
        picked: status === picked(),
        reachable: canTransition(picked(), status),
      }))
    ),
    guide: computed(() => STATUS_GUIDE[picked()]),
    isFinal: computed(() => TICKET_STATUS_TRANSITIONS[picked()].length === 0),
  })),
  withMethods((store) => ({
    select(status: TicketStatus): void {
      patchState(store, { picked: status });
    },
  }))
);
