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
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  ACCOUNT_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type Role,
  ROLES,
  USER_ID_PATTERN,
} from '@helpdesk/contract';
import { TeamAccountsStore } from './team-accounts.store';

/** A team the new account can join, and who leads it now, if anyone. */
export interface TeamChoice {
  id: string;
  name: string;
  leadName: string | null;
}

/** What the page opens the popup with. */
export interface CreateAccountData {
  teams: TeamChoice[];
}

/**
 * The Create Account popup: user ID, name, role, team (not for admins) and
 * a starting password, checked against the contract's rules before
 * anything is sent. It creates through the page's `TeamAccountsStore`
 * (opened with the page's injector), shows the API's message if that is
 * refused, and closes with the new user ID once created.
 */
@Component({
  selector: 'hd-create-account-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Create account</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>User ID</mat-label>
          <input
            matInput
            formControlName="userId"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
          />
          <mat-hint>For example, nia.patel</mat-hint>
          @if (form.controls.userId.hasError('required')) {
            <mat-error>Enter a user ID.</mat-error>
          } @else {
            <mat-error>
              Use 3 to 32 lowercase letters, digits, dots and hyphens, starting
              with a letter.
            </mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" autocomplete="off" />
          @if (form.controls.name.hasError('maxlength')) {
            <mat-error
              >Names are at most {{ nameMaxLength }} characters.</mat-error
            >
          } @else {
            <mat-error>Enter a name.</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            @for (role of roles; track role) {
              <mat-option [value]="role" class="role-option">{{
                role
              }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (role() !== 'admin') {
          <mat-form-field appearance="outline">
            <mat-label>Team</mat-label>
            <mat-select formControlName="teamId">
              @for (team of data.teams; track team.id) {
                <mat-option [value]="team.id">{{ team.name }}</mat-option>
              }
            </mat-select>
            <mat-error>Choose a team.</mat-error>
          </mat-form-field>
        } @else {
          <p class="note">Admins belong to no team.</p>
        }
        @if (replacedLead(); as replaced) {
          <p class="warning" role="status">
            {{ replaced.leadName }} leads {{ replaced.teamName }} now. They'll
            stay on the team, but the new supervisor will lead it.
          </p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Starting password</mat-label>
          <input
            matInput
            formControlName="password"
            autocomplete="new-password"
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
          <mat-hint
            >{{ passwordMinLength }} to
            {{ passwordMaxLength }} characters</mat-hint
          >
          <mat-error>
            Use {{ passwordMinLength }} to {{ passwordMaxLength }} characters.
          </mat-error>
        </mat-form-field>
        @if (store.createError(); as error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="saving()">
          Create
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
    .role-option {
      text-transform: capitalize;
    }
    .note {
      margin: 0.5rem 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .warning,
    .error {
      margin: 0.75rem 0 0;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      font: var(--mat-sys-body-medium);
    }
    .warning {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAccountDialog {
  protected readonly data = inject<CreateAccountData>(MAT_DIALOG_DATA);
  protected readonly store = inject(TeamAccountsStore);
  private readonly dialogRef = inject(MatDialogRef<CreateAccountDialog>);

  protected readonly roles = ROLES;
  protected readonly nameMaxLength = ACCOUNT_NAME_MAX_LENGTH;
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  protected readonly form = inject(NonNullableFormBuilder).group({
    userId: ['', [Validators.required, Validators.pattern(USER_ID_PATTERN)]],
    name: [
      '',
      [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(ACCOUNT_NAME_MAX_LENGTH),
      ],
    ],
    role: ['agent' as Role],
    teamId: ['', Validators.required],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
      ],
    ],
  });
  protected readonly passwordHidden = signal(true);
  /**
   * The user ID last sent, which the popup closes with: the field stays
   * editable while saving, so it may no longer say what was created.
   */
  private sentUserId = '';
  protected readonly role = toSignal(this.form.controls.role.valueChanges, {
    initialValue: this.form.controls.role.value,
  });
  private readonly teamId = toSignal(this.form.controls.teamId.valueChanges, {
    initialValue: this.form.controls.teamId.value,
  });
  protected readonly saving = computed(
    () => this.store.createState() === 'saving'
  );
  /** The lead a new supervisor would replace, if their team has one. */
  protected readonly replacedLead = computed(() => {
    if (this.role() !== 'supervisor') {
      return null;
    }
    const team = this.data.teams.find(({ id }) => id === this.teamId());
    return team?.leadName
      ? { leadName: team.leadName, teamName: team.name }
      : null;
  });

  constructor() {
    // A fresh form: no earlier Create Account's result or error.
    this.store.resetCreate();
    // An admin has no team, so the team is neither shown nor required.
    effect(() => {
      const teamId = this.form.controls.teamId;
      if (this.role() === 'admin') {
        teamId.disable();
      } else {
        teamId.enable();
      }
    });
    effect(() => {
      if (this.store.createState() === 'created') {
        this.dialogRef.close(this.sentUserId);
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { userId, name, role, teamId, password } = this.form.getRawValue();
    this.sentUserId = userId;
    this.store.create({
      userId,
      name: name.trim(),
      role,
      teamId: role === 'admin' ? null : teamId,
      password,
    });
  }
}
