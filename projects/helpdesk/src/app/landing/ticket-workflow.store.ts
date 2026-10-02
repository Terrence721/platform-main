import { computed } from '@angular/core';
import {
  canTransition,
  TICKET_STATUS_TRANSITIONS,
  TICKET_STATUSES,
  TicketStatus,
} from '@helpdesk/contract';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

/** How the landing page names and explains each status. */
export const STATUS_GUIDE: Readonly<
  Record<TicketStatus, { label: string; icon: string; meaning: string }>
> = {
  new: {
    label: 'New',
    icon: 'fiber_new',
    meaning:
      "Just arrived from a customer's email. Nobody has picked it up yet.",
  },
  open: {
    label: 'Open',
    icon: 'play_circle',
    meaning: 'Someone on the team is working on it.',
  },
  pending: {
    label: 'Pending',
    icon: 'hourglass_top',
    meaning:
      'Waiting on the customer. Their reply moves the ticket back to open.',
  },
  resolved: {
    label: 'Resolved',
    icon: 'task_alt',
    meaning: "Answered. If the customer says it isn't fixed, reopen it.",
  },
  closed: {
    label: 'Closed',
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
