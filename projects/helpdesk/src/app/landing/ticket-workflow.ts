import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TicketWorkflowStore } from './ticket-workflow.store';

/**
 * The landing page's "How a ticket moves" section: the statuses in order,
 * one of them picked, the ones a ticket can move to from it highlighted,
 * and a card explaining it. The page puts it in its `#workflow` band.
 */
@Component({
  selector: 'hd-ticket-workflow',
  imports: [MatCardModule, MatChipsModule, MatIconModule],
  providers: [TicketWorkflowStore],
  template: `
    <header>
      <h2 id="workflow-title">How a ticket moves</h2>
      <p>
        Five statuses, and only the moves that make sense. Pick one to see where
        a ticket can go from there.
      </p>
    </header>
    <mat-chip-listbox aria-label="Ticket statuses, in order">
      @for (step of store.steps(); track step.status) {
        @if (!$first) {
          <mat-icon class="arrow" aria-hidden="true">arrow_forward</mat-icon>
        }
        <mat-chip-option
          [selected]="step.picked"
          [selectable]="!step.picked"
          [class.reachable]="step.reachable"
          (selectionChange)="$event.selected && store.select(step.status)"
        >
          <mat-icon matChipAvatar>{{ step.icon }}</mat-icon>
          {{ step.label }}
        </mat-chip-option>
      }
    </mat-chip-listbox>
    <mat-card appearance="outlined" aria-live="polite">
      <h3>{{ store.guide().label }}</h3>
      <p>{{ store.guide().meaning }}</p>
      <p class="next">
        @if (store.isFinal()) {
          Final: a closed ticket stays closed.
        } @else {
          Can move to: {{ nextLabels() }}
        }
      </p>
    </mat-card>
  `,
  styles: `
    header {
      max-width: 40em;
      margin-bottom: 1.75rem;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
      font-size: clamp(1.625rem, 3.4vw, 2.125rem);
      line-height: 1.2;
    }
    p {
      margin: 0.625rem 0 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .arrow {
      align-self: center;
      color: var(--mat-sys-outline);
    }
    .reachable {
      --mat-chip-outline-color: var(--mat-sys-primary);
      --mat-chip-label-text-color: var(--mat-sys-primary);
      --mat-chip-with-icon-icon-color: var(--mat-sys-primary);
    }
    mat-card {
      max-width: 40em;
      margin-top: 1.5rem;
      padding: 1rem 1.25rem;
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .next {
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketWorkflowSection {
  protected readonly store = inject(TicketWorkflowStore);

  /** The statuses a ticket can move to from the picked one, for reading. */
  protected readonly nextLabels = computed(() =>
    this.store
      .steps()
      .filter((step) => step.reachable)
      .map(({ label }) => label)
      .join(', ')
  );
}
