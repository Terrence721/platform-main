import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  formatTicketNumber,
  type PendingRequest,
  REQUEST_CATEGORY_LABELS,
  REQUEST_IMPACT_LABELS,
  type TicketDto,
} from '@helpdesk/contract';
import { CustomerFiles } from '../attachments/customer-files';
import { Sounds } from '../sound/sounds';
import { minuteClock } from '../tickets/minute-clock';
import type { DismissRequestData } from './dismiss-request.dialog';
import { NewRequestsStore } from './new-requests.store';
import type { TurnIntoTicketData } from './turn-into-ticket.dialog';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago a time was, in words: `just now`, `2 hours ago`. */
export function timeAgo(at: string, now: Date): string {
  const elapsed = now.getTime() - new Date(at).getTime();
  const [count, unit] =
    elapsed >= DAY
      ? [Math.floor(elapsed / DAY), 'day']
      : elapsed >= HOUR
        ? [Math.floor(elapsed / HOUR), 'hour']
        : [Math.floor(elapsed / MINUTE), 'minute'];
  if (count < 1) {
    return 'just now';
  }
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/**
 * Supervisors' New requests (#1026): what customers reported, oldest
 * first, one card each, with the files they sent and what might make it
 * a duplicate (the same customer's open tickets and earlier requests).
 * Turn into ticket and
 * Dismiss open their popups; after a decision a snack bar says what became
 * of the request. Shown on the supervisor page, which provides
 * `NewRequestsStore`, so the popups decide through the same store.
 */
@Component({
  selector: 'hd-new-requests',
  imports: [CustomerFiles, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <section aria-labelledby="new-requests-title">
      <h2 id="new-requests-title">
        New requests{{
          store.loadState() === 'loaded' ? ' · ' + requests().length : ''
        }}
      </h2>
      @switch (store.loadState()) {
        @case ('loading') {
          <mat-spinner diameter="40" aria-label="Loading new requests" />
        }
        @case ('failed') {
          <p class="message" role="alert">
            New requests couldn't be loaded.
            <button matButton type="button" (click)="store.load()">
              Try again
            </button>
          </p>
        }
        @default {
          @for (request of requests(); track request.id) {
            <article class="request" [attr.aria-label]="request.reference">
              <p class="meta">{{ meta(request) }}</p>
              <h3>{{ request.subject }}</h3>
              <p class="from">{{ from(request) }}</p>
              <p class="description">{{ request.description }}</p>
              <!-- Shows nothing for a request without files. -->
              <hd-customer-files [files]="request.attachments" />
              @if (duplicates(request); as duplicates) {
                <p class="duplicates">
                  <strong>Possible duplicates:</strong> {{ duplicates }}
                </p>
              }
              <div class="actions">
                <button
                  matButton="filled"
                  type="button"
                  (click)="openTurnIntoTicket(request)"
                >
                  Turn into ticket
                </button>
                <button
                  matButton="outlined"
                  type="button"
                  (click)="openDismiss(request)"
                >
                  Dismiss
                </button>
              </div>
            </article>
          } @empty {
            <p class="message empty">No new requests.</p>
          }
        }
      }
    </section>
  `,
  styles: `
    h2 {
      margin: 2.5rem 0 0.75rem;
      font: var(--mat-sys-title-large);
    }
    .message {
      color: var(--mat-sys-on-surface-variant);
    }
    .request {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 1rem 1.25rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);
    }
    .request p,
    h3 {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .meta,
    .from {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    h3 {
      font: var(--mat-sys-title-medium);
    }
    .description {
      white-space: pre-line;
    }
    .duplicates {
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewRequests {
  protected readonly store = inject(NewRequestsStore);
  private readonly injector = inject(Injector);
  private readonly sounds = inject(Sounds);
  /** Now, to the minute, so "2 hours ago" keeps up by itself. */
  private readonly now = minuteClock();

  /** The pending requests, oldest first: the longest waiting on top. */
  protected readonly requests = computed(() =>
    [...this.store.entities()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    )
  );

  /** Its reference, how long ago it came in, its category and impact. */
  protected meta(request: PendingRequest): string {
    return [
      request.reference,
      timeAgo(request.createdAt, this.now()),
      REQUEST_CATEGORY_LABELS[request.category],
      REQUEST_IMPACT_LABELS[request.impact],
    ].join(' · ');
  }

  /** Who sent it, and where it happened if they said. */
  protected from(request: PendingRequest): string {
    const sender = `${request.name} <${request.email}>`;
    return request.where === null ? sender : `${sender} · ${request.where}`;
  }

  /** The same customer's open tickets and earlier requests; `''` if none. */
  protected duplicates({ possibleDuplicates }: PendingRequest): string {
    return [
      ...possibleDuplicates.openTickets.map(
        (ticket) =>
          `open ticket ${formatTicketNumber(ticket.ticketNumber)} ${ticket.subject}`
      ),
      ...possibleDuplicates.earlierRequests.map(
        (earlier) => `earlier request ${earlier.reference}`
      ),
    ].join(' · ');
  }

  /**
   * Opens Turn into ticket; once the ticket is made, says its number. The
   * popup's code is loaded on the first click; a second click while it is
   * on its way finds the first popup open, and leaves it.
   */
  protected async openTurnIntoTicket(request: PendingRequest): Promise<void> {
    const [{ MatDialog }, { TurnIntoTicketDialog }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./turn-into-ticket.dialog'),
    ]);
    const dialog = this.injector.get(MatDialog);
    const id = `ticket-${request.id}`;
    if (dialog.getDialogById(id)) {
      return;
    }
    const data: TurnIntoTicketData = { request, queues: this.store.queues() };
    dialog
      .open(TurnIntoTicketDialog, {
        id,
        data,
        // The page's injector, so the popup decides through its store.
        injector: this.injector,
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      // The new ticket; nothing when cancelled.
      .subscribe((ticket: TicketDto | undefined) => {
        if (ticket) {
          this.decided(
            `${request.reference} is now ticket ${formatTicketNumber(ticket.ticketNumber)}, in Unassigned.`
          );
        }
      });
  }

  /** Opens Dismiss; once dismissed, says so. Loaded as Turn into ticket. */
  protected async openDismiss(request: PendingRequest): Promise<void> {
    const [{ MatDialog }, { DismissRequestDialog }] = await Promise.all([
      import('@angular/material/dialog'),
      import('./dismiss-request.dialog'),
    ]);
    const dialog = this.injector.get(MatDialog);
    const id = `dismiss-${request.id}`;
    if (dialog.getDialogById(id)) {
      return;
    }
    const data: DismissRequestData = { request };
    dialog
      .open(DismissRequestDialog, {
        id,
        data,
        injector: this.injector,
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      // `true` once dismissed; nothing when cancelled.
      .subscribe((dismissed: true | undefined) => {
        if (dismissed) {
          this.decided(`${request.reference} dismissed.`);
        }
      });
  }

  /**
   * Says what became of a request, in a snack bar, with the success
   * chime. The snack bar's code is loaded when first needed.
   */
  private async decided(message: string): Promise<void> {
    this.sounds.play('success');
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    this.injector.get(MatSnackBar).open(message, undefined, {
      duration: 5000,
    });
  }
}
