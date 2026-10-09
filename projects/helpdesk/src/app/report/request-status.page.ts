import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RequestStatusStore } from './request-status.store';

/**
 * Check my request (#1026): a customer gives the reference from their
 * confirmation and the email they sent it with, and reads where their
 * request is up to, announced. A wrong email reads as no such request, as
 * the API answers. Open to anyone; the confirmation's link fills the
 * reference in (`?reference=R-1042`, by the router's input binding).
 */
@Component({
  selector: 'hd-request-status-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  providers: [RequestStatusStore],
  template: `
    <section class="column" aria-labelledby="status-title">
      <h1 id="status-title">Check my request</h1>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Reference</mat-label>
          <input
            matInput
            formControlName="reference"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <mat-hint>On your confirmation, such as R-1042.</mat-hint>
          <mat-error>Enter the reference from your confirmation.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input
            matInput
            type="email"
            formControlName="email"
            autocomplete="email"
          />
          <mat-hint>The one you sent it with.</mat-hint>
          <mat-error>Enter the email you sent it with.</mat-error>
        </mat-form-field>
        <button
          matButton="filled"
          type="submit"
          [disabled]="store.checkState() === 'checking'"
        >
          Check
        </button>
      </form>
      <!-- Always there, so a screen reader hears each new answer. -->
      <p class="answer" role="status">
        @if (store.checkState() === 'done') {
          {{ store.answer() }}
        }
      </p>
      @if (store.checkState() === 'failed') {
        <p class="check-error" role="alert">{{ store.answer() }}</p>
      }
    </section>
  `,
  styles: `
    .column {
      max-width: 32rem;
      margin-inline: auto;
      padding: 2.5rem 1rem;
    }
    h1 {
      margin: 0 0 1.5rem;
      font: var(--mat-sys-headline-large);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    button {
      align-self: flex-start;
    }
    .answer {
      margin: 1.5rem 0 0;
      font: var(--mat-sys-title-medium);
    }
    .answer:empty {
      margin: 0;
    }
    .check-error {
      margin: 1rem 0 0;
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RequestStatusPage {
  protected readonly store = inject(RequestStatusStore);
  /** The reference the address gives, from the confirmation's link. */
  readonly reference = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    reference: ['', Validators.required],
    email: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      const reference = this.reference();
      if (reference) {
        this.form.controls.reference.setValue(reference);
      }
    });
  }

  /** Checks the request, or marks what is missing. */
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const { reference, email } = this.form.getRawValue();
    this.store.check({ reference: reference.trim(), email: email.trim() });
  }
}
