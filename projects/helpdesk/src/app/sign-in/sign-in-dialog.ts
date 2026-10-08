import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PASSWORD_MAX_LENGTH, USER_ID_PATTERN } from '@helpdesk/contract';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { SessionApiActions } from '../session/session.actions';
import { sessionFeature } from '../session/session.feature';
import { SignInDialogActions } from './sign-in.actions';

/**
 * The sign-in popup: a user ID and a password, checked against the
 * contract's rules before anything is sent. Sending dispatches
 * `[Sign In Dialog] Submitted`. A failure shows under the form; on
 * success the popup closes, and the session effects go to the user's page.
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
        @if (notice(); as notice) {
          <p class="notice" role="status">{{ notice }}</p>
        }
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
        @if (error(); as error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="sending()">
          Sign in
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      display: block;
      width: 100%;
      margin-top: 0.5rem;
    }
    .error,
    .notice {
      margin: 0.75rem 0 0;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      font: var(--mat-sys-body-medium);
    }
    .error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .notice {
      margin: 0 0 0.25rem;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
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
  /** Whether this popup has sent the form, so an older failure never shows. */
  private readonly sent = signal(false);
  private readonly signInError = this.store.selectSignal(
    sessionFeature.selectSignInError
  );
  /** Why the last sign-in from this popup failed, if it did. */
  protected readonly error = computed(() =>
    this.sent() ? this.signInError() : null
  );
  /** Why the popup opened by itself (the session ended), until a send. */
  protected readonly notice = this.store.selectSignal(
    sessionFeature.selectSignInNotice
  );
  /** Sent, and no answer yet: a send clears the error, a failure sets it. */
  protected readonly sending = computed(
    () => this.sent() && this.signInError() === null
  );

  constructor() {
    const dialogRef = inject(MatDialogRef<SignInDialog>);
    inject(Actions)
      .pipe(ofType(SessionApiActions.signedIn), takeUntilDestroyed())
      .subscribe(() => dialogRef.close());
  }

  protected submit(): void {
    if (this.form.invalid || this.sending()) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.dispatch(
      SignInDialogActions.submitted({ request: this.form.getRawValue() })
    );
    this.sent.set(true);
  }
}
