import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  formatTicketNumber,
  type TicketDto,
  type TicketStatus,
} from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import { STATUS_GUIDE } from '../landing/ticket-workflow.store';
import { sessionFeature } from '../session/session.feature';
import { isFinished, Sounds } from '../sound/sounds';
import { openTicket } from '../tickets/open-ticket';
import { TicketTable } from '../tickets/ticket-table';
import { MyTicketsStore } from './my-tickets.store';

/**
 * An agent's own page: My tickets, their open work, most urgent first,
 * each with a Change status menu; then Unassigned, the work nobody holds,
 * which they may take for themselves ("Take it"); then Done, what they
 * finished in the last 24 hours, where a resolved ticket can be reopened.
 * A subject in My tickets or Done opens that ticket's details and
 * conversation, to reply or add an internal note. Only agents get here (the route's `canMatchRole('agent')`). The page
 * provides `MyTicketsStore`, which loads all three when the page opens.
 */
@Component({
  selector: 'hd-agent-page',
  imports: [MatButtonModule, MatProgressSpinnerModule, TicketTable],
  providers: [MyTicketsStore],
  template: `
    <section class="column" aria-labelledby="agent-title">
      <p class="eyebrow">Agent</p>
      <h1 id="agent-title">My tickets</h1>
      @if (user(); as user) {
        <p class="greeting">Signed in as {{ user.name }}</p>
      }
      @switch (store.loadState()) {
        @case ('loading') {
          <mat-spinner diameter="40" aria-label="Loading your tickets" />
        }
        @case ('failed') {
          <p class="message" role="alert">
            Your tickets couldn't be loaded.
            <button matButton type="button" (click)="store.load()">
              Try again
            </button>
          </p>
        }
        @default {
          @if (store.entities().length === 0) {
            <p class="message">Nothing is assigned to you right now.</p>
          } @else {
            <hd-ticket-table
              class="mine"
              [tickets]="store.entities()"
              [statusMenu]="true"
              (statusChange)="changeStatus($event)"
              [subjectLinks]="true"
              (open)="open($event)"
            />
          }
        }
      }

      <h2>Unassigned ({{ store.unassigned().length }})</h2>
      @switch (store.unassignedState()) {
        @case ('loading') {
          <mat-spinner
            diameter="32"
            aria-label="Loading the unassigned tickets"
          />
        }
        @case ('failed') {
          <p class="message" role="alert">
            The unassigned tickets couldn't be loaded.
            <button matButton type="button" (click)="store.loadUnassigned()">
              Try again
            </button>
          </p>
        }
        @default {
          @if (store.unassigned().length === 0) {
            <p class="message">Nothing is waiting to be picked up.</p>
          } @else {
            <hd-ticket-table
              class="unassigned"
              [tickets]="store.unassigned()"
              actionLabel="Take it"
              (action)="take($event)"
            />
          }
        }
      }

      <h2>Done (24 h)</h2>
      @switch (store.finishedState()) {
        @case ('loading') {
          <mat-spinner
            diameter="32"
            aria-label="Loading your finished tickets"
          />
        }
        @case ('failed') {
          <p class="message" role="alert">
            Your finished tickets couldn't be loaded.
            <button matButton type="button" (click)="store.loadFinished()">
              Try again
            </button>
          </p>
        }
        @default {
          @if (store.finished().length === 0) {
            <p class="message">Nothing finished in the last 24 hours.</p>
          } @else {
            <hd-ticket-table
              class="done"
              [tickets]="store.finished()"
              [statusMenu]="true"
              (statusChange)="changeStatus($event)"
              [subjectLinks]="true"
              (open)="open($event)"
            />
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
      margin: 0.5rem 0 2rem;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .message {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AgentPage {
  protected readonly store = inject(MyTicketsStore);
  protected readonly user = inject(Store).selectSignal(
    sessionFeature.selectUser
  );
  private readonly injector = inject(Injector);
  /** A chime when taking or finishing a ticket works; a low tone if not. */
  private readonly sounds = inject(Sounds);

  /** The signed-in agent takes this ticket for themselves. */
  protected take(ticket: TicketDto): void {
    const user = this.user();
    if (user !== null) {
      this.store.take({ ticketId: ticket.id, agentId: user.id });
    }
  }

  /** Moves one of the agent's tickets to the status chosen in its menu. */
  protected changeStatus({
    ticket,
    status,
  }: {
    ticket: TicketDto;
    status: TicketStatus;
  }): void {
    this.store.changeStatus({ ticketId: ticket.id, status });
  }

  /** Opens one of the agent's tickets: its details and conversation. */
  protected open(ticket: TicketDto): void {
    void openTicket(this.injector, ticket);
  }

  /**
   * Says how taking a ticket or changing a status went, in a snack bar.
   * The snack bar's code is loaded when first needed.
   */
  private async report(message: string): Promise<void> {
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    this.injector.get(MatSnackBar).open(message, undefined, {
      duration: 5000,
    });
  }

  constructor() {
    effect(() => {
      const state = this.store.takeState();
      untracked(() => {
        const ticket = this.store.lastTaken();
        if (state === 'taken' && ticket !== null) {
          this.sounds.play('success');
          void this.report(
            `${formatTicketNumber(ticket.ticketNumber)} is yours`
          );
        } else if (state === 'failed') {
          this.sounds.play('error');
          void this.report(this.store.takeError() ?? '');
        }
      });
    });
    effect(() => {
      const state = this.store.statusState();
      untracked(() => {
        const ticket = this.store.lastChanged();
        if (state === 'changed' && ticket !== null) {
          if (isFinished(ticket.status)) {
            this.sounds.play('success');
          }
          void this.report(
            `${formatTicketNumber(ticket.ticketNumber)} is now ${STATUS_GUIDE[ticket.status].label}`
          );
        } else if (state === 'failed') {
          this.sounds.play('error');
          void this.report(this.store.statusError() ?? '');
        }
      });
    });
  }
}
