import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PASSWORD_MAX_LENGTH, USER_ID_PATTERN } from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import { SignInDialogActions } from './sign-in.actions';

/**
 * The sign-in popup: a user ID and a password, checked against the
 * contract's rules before anything is sent. Sending dispatches
 * `[Sign In Dialog] Submitted`; until the API exists, the popup then says
 * that signing in is not available yet.
 */
@Component({
  selector: 'hd-sign-in-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Sign in to Helpdesk</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>User ID</mat-label>
          <input
            matInput
            formControlName="userId"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
          />
          <mat-hint>For example, sam.rivera</mat-hint>
          @if (form.controls.userId.hasError('required')) {
            <mat-error>Enter your user ID.</mat-error>
          } @else {
            <mat-error>
              Use lowercase letters, digits, dots and hyphens, starting with a
              letter.
            </mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input
            matInput
            formControlName="password"
            autocomplete="current-password"
            [type]="passwordHidden() ? 'password' : 'text'"
          />
          <button
            matIconButton
            matSuffix
            type="button"
            [attr.aria-label]="
              passwordHidden() ? 'Show password' : 'Hide password'
            "
            [attr.aria-pressed]="!passwordHidden()"
            (click)="passwordHidden.set(!passwordHidden())"
          >
            <mat-icon>{{
              passwordHidden() ? 'visibility' : 'visibility_off'
            }}</mat-icon>
          </button>
          @if (form.controls.password.hasError('required')) {
            <mat-error>Enter your password.</mat-error>
          } @else {
            <mat-error>
              Passwords are at most {{ passwordMaxLength }} characters.
            </mat-error>
          }
        </mat-form-field>
        @if (sent()) {
          <p class="notice" role="status">
            Signing in becomes available once the Helpdesk API is running.
          </p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit">Sign in</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      display: block;
      width: 100%;
      margin-top: 0.5rem;
    }
    .notice {
      margin: 0.75rem 0 0;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-body-medium);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInDialog {
  private readonly store = inject(Store);

  protected readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  protected readonly form = inject(NonNullableFormBuilder).group({
    userId: ['', [Validators.required, Validators.pattern(USER_ID_PATTERN)]],
    password: [
      '',
      [Validators.required, Validators.maxLength(PASSWORD_MAX_LENGTH)],
    ],
  });
  protected readonly passwordHidden = signal(true);
  /** Whether the form has been sent, so the popup can say what happens next. */
  protected readonly sent = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.dispatch(
      SignInDialogActions.submitted({ request: this.form.getRawValue() })
    );
    this.sent.set(true);
  }
}
