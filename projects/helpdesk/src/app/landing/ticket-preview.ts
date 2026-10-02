import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { formatTicketNumber } from '@helpdesk/contract';
import { LetDirective, PushPipe } from '@ngrx/component';
import { Store } from '@ngrx/store';
import { landingFeature } from './landing.feature';

export type SlaTone = 'overdue' | 'soon' | 'ok' | 'none';

const MINUTE = 60_000;
/** Due within this many minutes counts as "soon". */
const SOON_MINUTES = 4 * 60;

/** A duration in minutes as people read it: "25m", "2h", "1d 4h". */
function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const rest = minutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${rest}m`;
}

/** How a ticket stands against its SLA at `now`, in words and as a tone. */
export function slaLabel(
  slaDueAt: string | null,
  now: Date
): { text: string; tone: SlaTone } {
  if (slaDueAt === null) {
    return { text: 'No SLA', tone: 'none' };
  }
  const minutes = Math.round(
    (new Date(slaDueAt).getTime() - now.getTime()) / MINUTE
  );
  if (minutes < 0) {
    return { text: `Overdue ${formatDuration(-minutes)}`, tone: 'overdue' };
  }
  return {
    text: `Due in ${formatDuration(minutes)}`,
    tone: minutes <= SOON_MINUTES ? 'soon' : 'ok',
  };
}

/** The landing page's "My tickets" card: the showcase tickets, by SLA. */
@Component({
  selector: 'hd-ticket-preview',
  imports: [
    LetDirective,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    PushPipe,
  ],
  template: `
    <mat-card appearance="raised" aria-labelledby="preview-title">
      <header>
        <mat-icon aria-hidden="true">inbox</mat-icon>
        <h2 id="preview-title">My tickets</h2>
        <span class="count">
          Example data · {{ (tickets$ | ngrxPush)?.length ?? 0 }} tickets
        </span>
      </header>
      @switch (loadState$ | ngrxPush) {
        @case ('failed') {
          <p class="message">The example tickets could not be loaded.</p>
        }
        @case ('loading') {
          <p class="message">Loading…</p>
        }
        @default {
          <ul *ngrxLet="tickets$ as tickets">
            @for (ticket of tickets; track ticket.id) {
              @let sla = slaLabel(ticket.slaDueAt, now);
              <li>
                <span class="number">{{
                  formatTicketNumber(ticket.ticketNumber)
                }}</span>
                <span class="subject">{{ ticket.subject }}</span>
                <span class="sla" [class]="sla.tone">{{ sla.text }}</span>
                <span class="meta">
                  <mat-chip-set>
                    <mat-chip [class]="ticket.priority">
                      {{ ticket.priority }}
                    </mat-chip>
                  </mat-chip-set>
                  <span>{{ ticket.queue.name }}</span>
                  <span>{{ ticket.requester.name }}</span>
                </span>
              </li>
            }
          </ul>
        }
      }
    </mat-card>
  `,
  styles: `
    header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .count,
    .meta,
    .number {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .count {
      margin-left: auto;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.25rem 0.75rem;
      align-items: center;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    li:last-child {
      border-bottom: 0;
    }
    .number {
      font-variant-numeric: tabular-nums;
    }
    .subject {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: var(--mat-sys-title-small);
    }
    .meta {
      grid-column: 2 / 4;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
    }
    .sla {
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
    }
    .overdue {
      color: var(--mat-sys-error);
    }
    .soon {
      color: #8a5000;
    }
    .ok {
      color: #1b6c35;
    }
    mat-chip {
      text-transform: capitalize;
    }
    .urgent {
      --mat-chip-elevated-container-color: var(--mat-sys-tertiary-container);
    }
    .high {
      --mat-chip-elevated-container-color: var(--mat-sys-primary-container);
    }
    .message {
      margin: 0;
      padding: 1.25rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketPreview {
  private readonly store = inject(Store);

  protected readonly tickets$ = this.store.select(
    landingFeature.selectVisibleTickets
  );
  protected readonly loadState$ = this.store.select(
    landingFeature.selectLoadState
  );
  /** Fixed when the card is created; step 6 keeps it ticking. */
  protected readonly now = new Date();
  protected readonly slaLabel = slaLabel;
  protected readonly formatTicketNumber = formatTicketNumber;
}
