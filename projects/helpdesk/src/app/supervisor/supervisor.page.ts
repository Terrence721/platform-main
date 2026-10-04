import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  formatTicketNumber,
  type PersonSummary,
  type TicketDto,
  type TicketStatus,
} from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import { STATUS_GUIDE } from '../landing/ticket-workflow.store';
import { sessionFeature } from '../session/session.feature';
import { openTicket } from '../tickets/open-ticket';
import { TicketTable } from '../tickets/ticket-table';
import type { AssignTicketData } from './assign-ticket.dialog';
import { MyTeamStore } from './my-team.store';

/** The statuses that still need work, and so can be assigned. */
const OPEN_WORK: readonly TicketStatus[] = ['new', 'open', 'pending'];

/**
 * A supervisor's own page: My team, their agents' workload, one agent's
 * tickets at a time (chosen from the Team member list; assigned tickets
 * show nowhere else), plus the unassigned work nobody holds yet. The
 * supervisor assigns unassigned tickets and reassigns a member's open ones
 * through "Assign to…", and moves a member's tickets through the workflow
 * with their Change status menu. A member's ticket subject opens that
 * ticket's details and conversation, to reply or add an internal note.
 * Only supervisors get here (the route's `canMatchRole('supervisor')`).
 * The page provides `MyTeamStore`, which loads the team when the page
 * opens.
 */
@Component({
  selector: 'hd-supervisor-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TicketTable,
  ],
  providers: [MyTeamStore],
  template: `
    <section class="column" aria-labelledby="supervisor-title">
      <p class="eyebrow">Supervisor</p>
      <h1 id="supervisor-title">My team</h1>
      @if (user(); as user) {
        <p class="greeting">Signed in as {{ user.name }}</p>
      }
      @switch (store.loadState()) {
        @case ('loading') {
          <mat-spinner diameter="40" aria-label="Loading your team" />
        }
        @case ('failed') {
          <p class="message" role="alert">
            Your team couldn't be loaded.
            <button matButton type="button" (click)="store.load()">
              Try again
            </button>
          </p>
        }
        @case ('no-team') {
          <p class="message">You don't lead a team yet.</p>
        }
        @default {
          @if (store.team(); as team) {
            <h2>{{ team.name }}</h2>
            <!-- Each agent with their open-ticket count, to choose from. -->
            <mat-form-field class="member-picker">
              <mat-label>Team member</mat-label>
              <mat-select
                placeholder="Choose a team member"
                [value]="store.selectedMemberId()"
                (valueChange)="store.selectMember($event)"
              >
                <!-- Chooses nobody, which hides a member's tickets again. -->
                <mat-option [value]="null">None</mat-option>
                @for (member of team.members; track member.id) {
                  <mat-option [value]="member.id">
                    {{ member.name }} ({{ member.openTickets }} open ·
                    {{ member.overdueTickets }} overdue)
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (selectedMember(); as member) {
              <h2 class="member-title">
                <button
                  class="name-link"
                  type="button"
                  [attr.aria-label]="member.name + ', view 3-month history'"
                  (click)="openHistory(member)"
                >
                  {{ member.name }}</button
                ><span>'s tickets</span>
              </h2>
              @switch (store.memberTicketsState()) {
                @case ('loading') {
                  <mat-spinner
                    diameter="40"
                    [attr.aria-label]="'Loading tickets for ' + member.name"
                  />
                }
                @case ('failed') {
                  <p class="message" role="alert">
                    {{ member.name }}'s tickets couldn't be loaded.
                    <button
                      matButton
                      type="button"
                      (click)="store.selectMember(member.id)"
                    >
                      Try again
                    </button>
                  </p>
                }
                @default {
                  @if (store.memberTickets().length === 0) {
                    <p class="message">
                      No tickets are assigned to {{ member.name }}.
                    </p>
                  } @else {
                    <hd-ticket-table
                      class="member"
                      [tickets]="store.memberTickets()"
                      actionLabel="Reassign"
                      [canAct]="isOpenWork"
                      (action)="openAssign($event)"
                      [statusMenu]="true"
                      (statusChange)="
                        store.changeStatus({
                          ticketId: $event.ticket.id,
                          status: $event.status,
                        })
                      "
                      [subjectLinks]="true"
                      (open)="open($event)"
                    />
                  }
                }
              }
            }

            <h2>Unassigned ({{ team.unassigned.length }})</h2>
            @if (team.unassigned.length === 0) {
              <p class="message">Nothing is waiting to be picked up.</p>
            } @else {
              <hd-ticket-table
                class="unassigned"
                [tickets]="team.unassigned"
                actionLabel="Assign"
                (action)="openAssign($event)"
              />
            }
          }
        }
      }
    </section>
  `,
  styles: `
    .column {
      max-width: 70rem;
      margin-inline: auto;
      padding: 2.5rem 1rem;
    }
    .eyebrow {
      margin: 0;
      font: var(--mat-sys-label-large);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--mat-sys-primary);
    }
    h1 {
      margin: 0.5rem 0 0;
      font: var(--mat-sys-headline-large);
    }
    h2 {
      margin: 2.5rem 0 0.75rem;
      font: var(--mat-sys-title-large);
    }
    .greeting {
      margin: 0.5rem 0 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .message {
      color: var(--mat-sys-on-surface-variant);
    }
    .member-picker {
      margin-top: 0.5rem;
      width: min(100%, 22rem);
    }
    /* A button that reads as a link: it opens the member's history. */
    .name-link {
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      color: var(--mat-sys-primary);
      text-decoration: underline;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SupervisorPage {
  protected readonly store = inject(MyTeamStore);
  protected readonly user = inject(Store).selectSignal(
    sessionFeature.selectUser
  );
  private readonly injector = inject(Injector);
  /** The team member chosen in the list, for their name. */
  protected readonly selectedMember = computed(() => {
    const id = this.store.selectedMemberId();
    return this.store.team()?.members.find((member) => member.id === id);
  });

  /**
   * Opens the member's 3-month history. The popup's code is loaded on the
   * first click (dynamic `import()`), not with the page.
   */
  protected async openHistory({ id, name }: PersonSummary): Promise<void> {
    const [{ MatDialog }, { MemberHistoryDialog }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./member-history.dialog'),
    ]);
    this.injector.get(MatDialog).open(MemberHistoryDialog, {
      data: { id, name },
      width: '60rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
  }

  /** Opens a team member's ticket: its details and conversation. */
  protected open(ticket: TicketDto): void {
    void openTicket(this.injector, ticket);
  }

  /** Whether a ticket still needs work, so it can be (re)assigned. */
  protected readonly isOpenWork = (ticket: TicketDto): boolean =>
    OPEN_WORK.includes(ticket.status);

  /**
   * Opens "Assign to…" for a ticket, with the team's agents and their
   * load; if one is chosen, the store assigns it. The popup's code is
   * loaded on the first click.
   */
  protected async openAssign(ticket: TicketDto): Promise<void> {
    const team = this.store.team();
    if (team === null) {
      return;
    }
    const [{ MatDialog }, { AssignTicketDialog }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./assign-ticket.dialog'),
    ]);
    const data: AssignTicketData = {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      currentAssigneeId: ticket.assignee?.id ?? null,
      members: team.members,
    };
    this.injector
      .get(MatDialog)
      .open(AssignTicketDialog, {
        data,
        width: '28rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      // The chosen agent's user ID; nothing when cancelled.
      .subscribe((agentId: unknown) => {
        if (typeof agentId === 'string') {
          this.store.assign({ ticketId: ticket.id, agentId });
        }
      });
  }

  /**
   * Says how an assignment went, in a snack bar: who has the ticket now,
   * or why it was refused. The snack bar's code is loaded when first
   * needed.
   */
  private async report(message: string): Promise<void> {
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    this.injector.get(MatSnackBar).open(message, undefined, {
      duration: 5000,
    });
  }

  constructor() {
    effect(() => {
      const state = this.store.assignState();
      untracked(() => {
        const ticket = this.store.lastAssigned();
        if (state === 'assigned' && ticket?.assignee) {
          void this.report(
            `${formatTicketNumber(ticket.ticketNumber)} assigned to ${ticket.assignee.name}`
          );
        } else if (state === 'failed') {
          void this.report(this.store.assignError() ?? '');
        }
      });
    });
    effect(() => {
      const state = this.store.statusState();
      untracked(() => {
        const ticket = this.store.lastChanged();
        if (state === 'changed' && ticket !== null) {
          void this.report(
            `${formatTicketNumber(ticket.ticketNumber)} is now ${STATUS_GUIDE[ticket.status].label}`
          );
        } else if (state === 'failed') {
          void this.report(this.store.statusError() ?? '');
        }
      });
    });
  }
}
