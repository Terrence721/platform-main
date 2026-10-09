import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import {
  DISMISS_REASON_LABELS,
  DISMISS_REASONS,
  type DismissReason,
  formatTicketNumber,
  type PendingRequest,
} from '@helpdesk/contract';
import { NewRequestsStore } from './new-requests.store';

/** What the section opens the popup with. */
export interface DismissRequestData {
  request: PendingRequest;
}

/** A ticket number as typed, `#1002` or `1002`; `null` if it is not one. */
function ticketNumberOf(text: string): number | null {
  const match = /^\s*#?(\d{1,10})\s*$/.exec(text);
  const ticketNumber = match === null ? 0 : Number(match[1]);
  return ticketNumber >= 1 ? ticketNumber : null;
}

/**
 * Dismiss (#1026): why a request will not become a ticket. For Already
 * reported, the ticket it repeats: one of the possible duplicates, at a
 * click, or typed. It decides through the page's store and closes with
 * `true`; a refusal (someone decided it first, say) shows here.
 */
@Component({
  selector: 'hd-dismiss-request-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Dismiss {{ data.request.reference }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <p class="subject">{{ data.request.subject }}</p>
        <p id="reason-label">Why?</p>
        <mat-radio-group
          formControlName="reason"
          aria-labelledby="reason-label"
        >
          @for (reason of reasons; track reason) {
            <mat-radio-button [value]="reason">{{
              reasonLabels[reason]
            }}</mat-radio-button>
          }
        </mat-radio-group>
        @if (tried() && form.controls.reason.invalid) {
          <p class="reason-error">Choose why it is dismissed.</p>
        }
        @if (reason() === 'duplicate') {
          @if (duplicates.length > 0) {
            <div class="duplicates">
              @for (ticket of duplicates; track ticket.id) {
                <button
                  matButton="outlined"
                  type="button"
                  (click)="useTicket(ticket.ticketNumber)"
                >
                  Use {{ ticketNumberText(ticket.ticketNumber) }}
                  {{ ticket.subject }}
                </button>
              }
            </div>
          }
          <mat-form-field appearance="outline">
            <mat-label>Ticket it repeats</mat-label>
            <input
              matInput
              formControlName="ticketNumber"
              inputmode="numeric"
              autocomplete="off"
            />
            <mat-hint>Its number, such as #1002.</mat-hint>
            <mat-error>Enter the number of the ticket it repeats.</mat-error>
          </mat-form-field>
        }
        @if (store.decideError(); as error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          Dismiss request
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
    .subject,
    #reason-label {
      margin: 0;
    }
    .subject {
      font: var(--mat-sys-body-large);
      margin-bottom: 0.5rem;
    }
    mat-radio-group {
      display: flex;
      flex-direction: column;
    }
    .duplicates {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .reason-error {
      margin: 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
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
export class DismissRequestDialog {
  protected readonly data = inject<DismissRequestData>(MAT_DIALOG_DATA);
  protected readonly store = inject(NewRequestsStore);
  private readonly dialogRef = inject(MatDialogRef<DismissRequestDialog, true>);

  protected readonly reasons = DISMISS_REASONS;
  protected readonly reasonLabels = DISMISS_REASON_LABELS;
  protected readonly ticketNumberText = formatTicketNumber;
  /** The customer's open tickets, which a duplicate is likely to repeat. */
  protected readonly duplicates =
    this.data.request.possibleDuplicates.openTickets;

  protected readonly form = inject(NonNullableFormBuilder).group({
    reason: [null as DismissReason | null, this.required],
    ticketNumber: [
      '',
      (control: AbstractControl<string>): ValidationErrors | null =>
        this.form?.controls.reason.value === 'duplicate' &&
        ticketNumberOf(control.value) === null
          ? { ticketNumber: true }
          : null,
    ],
  });
  protected readonly reason = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: null,
  });
  /** Whether a dismissal was tried, so a missing reason says so. */
  protected readonly tried = signal(false);
  protected readonly saving = computed(
    () => this.store.decideState() === 'saving'
  );

  constructor() {
    // A fresh popup: no earlier decision's result or error.
    this.store.resetDecision();
    effect(() => {
      if (this.store.decideState() === 'done') {
        this.dialogRef.close(true);
      }
    });
  }

  private required(control: AbstractControl): ValidationErrors | null {
    return control.value === null ? { required: true } : null;
  }

  /** Fills the ticket in from one of the possible duplicates. */
  protected useTicket(ticketNumber: number): void {
    this.form.controls.ticketNumber.setValue(String(ticketNumber));
  }

  /** Dismisses the request, or says what is missing. */
  protected submit(): void {
    this.tried.set(true);
    this.form.controls.ticketNumber.updateValueAndValidity();
    this.form.markAllAsTouched();
    const { reason, ticketNumber } = this.form.getRawValue();
    if (this.form.invalid || reason === null) {
      return;
    }
    this.store.dismiss({
      requestId: this.data.request.id,
      request: {
        reason,
        duplicateOfTicketNumber:
          reason === 'duplicate' ? ticketNumberOf(ticketNumber) : null,
      },
    });
  }
}
