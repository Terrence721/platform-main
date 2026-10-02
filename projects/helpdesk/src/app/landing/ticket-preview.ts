import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { formatTicketNumber } from '@helpdesk/contract';
import { LetDirective, PushPipe } from '@ngrx/component';
import { Store } from '@ngrx/store';
import { landingFeature } from './landing.feature';
import { TicketPreviewStore } from './ticket-preview.store';

/**
 * The landing page's "My tickets" card: the showcase tickets by SLA, their
 * labels kept current by the card's own TicketPreviewStore. A ticket's
 * subject opens it to show its description.
 */
@Component({
  selector: 'hd-ticket-preview',
  imports: [
    LetDirective,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    PushPipe,
  ],
  providers: [TicketPreviewStore],
  template: `
    <mat-card appearance="raised" aria-labelledby="preview-title">
      <header>
        <mat-icon aria-hidden="true">inbox</mat-icon>
        <h2 id="preview-title">My tickets</h2>
        <span class="count">
          Example data · {{ (preview.rows$ | ngrxPush)?.length ?? 0 }} tickets
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
          <ul *ngrxLet="preview.rows$ as rows">
            @for (row of rows; track row.ticket.id) {
              <li>
                <span class="number">{{
                  formatTicketNumber(row.ticket.ticketNumber)
                }}</span>
                <button
                  type="button"
                  class="subject"
                  [attr.aria-expanded]="row.expanded"
                  [attr.aria-controls]="'details-' + row.ticket.id"
                  (click)="preview.toggleExpanded(row.ticket.id)"
                >
                  {{ row.ticket.subject }}
                </button>
                <span class="sla" [class]="row.sla.tone">{{
                  row.sla.text
                }}</span>
                <span class="meta">
                  <mat-chip-set>
                    <mat-chip [class]="row.ticket.priority">
                      {{ row.ticket.priority }}
                    </mat-chip>
                  </mat-chip-set>
                  <span>{{ row.ticket.queue.name }}</span>
                  <span>{{ row.ticket.requester.name }}</span>
                </span>
                <p
                  class="description"
                  [id]="'details-' + row.ticket.id"
                  [hidden]="!row.expanded"
                >
                  {{ row.ticket.description }}
                </p>
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
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;
      font: var(--mat-sys-title-small);
    }
    .subject:hover {
      text-decoration: underline;
    }
    .subject:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .meta,
    .description {
      grid-column: 2 / 4;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
    }
    .description {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-body-medium);
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
  protected readonly preview = inject(TicketPreviewStore);
  protected readonly loadState$ = inject(Store).select(
    landingFeature.selectLoadState
  );
  protected readonly formatTicketNumber = formatTicketNumber;
}
