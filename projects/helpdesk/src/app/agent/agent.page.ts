import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { sessionFeature } from '../session/session.feature';
import { TicketTable } from '../tickets/ticket-table';
import { MyTicketsStore } from './my-tickets.store';

/**
 * An agent's own page: My tickets, their open work, most urgent first.
 * Only agents get here (the route's `canMatchRole('agent')`). The page
 * provides `MyTicketsStore`, which loads the tickets when the page opens.
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
            <hd-ticket-table [tickets]="store.entities()" />
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
}
