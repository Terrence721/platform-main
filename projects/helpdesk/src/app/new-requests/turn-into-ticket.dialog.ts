import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  type PendingRequest,
  type QueueSummary,
  SUGGESTED_PRIORITY,
  TICKET_PRIORITIES,
  type TicketDto,
  type TicketPriority,
} from '@helpdesk/contract';
import { NewRequestsStore } from './new-requests.store';

/** Each priority as the popup offers it. */
const PRIORITY_LABELS: Readonly<Record<TicketPriority, string>> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

/** What the section opens the popup with. */
export interface TurnIntoTicketData {
  request: PendingRequest;
  queues: QueueSummary[];
}

/**
 * Turn into ticket (#1026): a supervisor confirms the queue, starting on
 * the one the request's category suggests, and the priority, starting on
 * the one its impact suggests; then the ticket is made, `new` and
 * Unassigned. It decides through the page's store and closes with the new
 * ticket; a refusal (someone decided it first, say) shows here.
 */
@Component({
  selector: 'hd-turn-into-ticket-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Turn {{ data.request.reference }} into a ticket</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <p class="subject">{{ data.request.subject }}</p>
        <mat-form-field appearance="outline">
          <mat-label>Queue</mat-label>
          <mat-select formControlName="queueId" aria-label="Queue">
            @for (queue of data.queues; track queue.id) {
              <mat-option [value]="queue.id">{{ queue.name }}</mat-option>
            }
          </mat-select>
          <mat-error>Choose a queue.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority" aria-label="Priority">
            @for (priority of priorities; track priority) {
              <mat-option [value]="priority">{{
                priorityLabels[priority]
              }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (store.decideError(); as error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          Create ticket
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: min(26rem, 100%);
    }
    .subject {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-body-large);
    }
    .error {
      margin: 0;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnIntoTicketDialog {
  protected readonly data = inject<TurnIntoTicketData>(MAT_DIALOG_DATA);
  protected readonly store = inject(NewRequestsStore);
  private readonly dialogRef = inject(
    MatDialogRef<TurnIntoTicketDialog, TicketDto>
  );

  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly form = inject(NonNullableFormBuilder).group({
    queueId: [this.data.request.suggestedQueueId ?? '', Validators.required],
    priority: [
      SUGGESTED_PRIORITY[this.data.request.impact] as TicketPriority,
      Validators.required,
    ],
  });
  protected readonly saving = computed(
    () => this.store.decideState() === 'saving'
  );

  constructor() {
    // A fresh popup: no earlier decision's result or error.
    this.store.resetDecision();
    effect(() => {
      const ticket = this.store.ticket();
      if (this.store.decideState() === 'done' && ticket !== null) {
        this.dialogRef.close(ticket);
      }
    });
  }

  /** Makes the ticket, or marks the queue as missing. */
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.store.turnIntoTicket({
      requestId: this.data.request.id,
      request: this.form.getRawValue(),
    });
  }
}
