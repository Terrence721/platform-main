import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { type Role, ROLES, type UserAccount } from '@helpdesk/contract';
import { map } from 'rxjs';
import type { TeamChoice } from './create-account.dialog';
import { TeamAccountsStore } from './team-accounts.store';

/** What the page opens the popup with. */
export interface EditAccountData {
  account: UserAccount;
  teams: TeamChoice[];
}

/**
 * The Edit account popup: an account's role, team (not for admins) and
 * whether it can sign in. Before saving it says what else the change
 * does: a lead replaced, a team left without one, open tickets going back
 * to Unassigned. It saves through the page's `TeamAccountsStore` (opened
 * with the page's injector), shows the API's message if that is refused,
 * and closes once saved. Save stays off until something has changed.
 */
@Component({
  selector: 'hd-edit-account-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit {{ account.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <p class="user-id">{{ account.id }}</p>
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
        @if (value().role !== 'admin') {
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
        <mat-slide-toggle formControlName="active">
          {{
            value().active ? 'Active: can sign in' : "Inactive: can't sign in"
          }}
        </mat-slide-toggle>
        @if (replacedLead(); as replaced) {
          <p class="warning" role="status">
            {{ replaced.leadName }} leads {{ replaced.teamName }} now. They'll
            stay on the team, but {{ account.name }} will lead it.
          </p>
        }
        @if (leftWithoutLead(); as teamName) {
          <p class="warning" role="status">
            {{ teamName }} will have no lead until another supervisor joins it.
          </p>
        }
        @if (leavesTeamWork()) {
          <p class="warning" role="status">
            Any open tickets {{ account.name }} holds will go back to
            Unassigned.
          </p>
        }
        @if (store.updateError(); as error) {
          <p class="error" role="alert">{{ error }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button
          matButton="filled"
          type="submit"
          [disabled]="saving() || !changed()"
        >
          Save
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
    mat-slide-toggle {
      display: block;
      margin: 0.5rem 0;
    }
    .user-id {
      margin: 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
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
export class EditAccountDialog {
  protected readonly data = inject<EditAccountData>(MAT_DIALOG_DATA);
  protected readonly store = inject(TeamAccountsStore);
  private readonly dialogRef = inject(MatDialogRef<EditAccountDialog>);

  protected readonly account = this.data.account;
  protected readonly roles = ROLES;
  protected readonly form = inject(NonNullableFormBuilder).group({
    role: [this.account.role as Role],
    teamId: [this.account.team?.id ?? '', Validators.required],
    active: [this.account.active],
  });
  /** The form as it stands, the team included while it is hidden. */
  protected readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );
  protected readonly saving = computed(
    () => this.store.updateState() === 'saving'
  );
  /** The team the account would be on: none for an admin. */
  private readonly teamId = computed(() =>
    this.value().role === 'admin' ? null : this.value().teamId || null
  );
  /** Whether anything differs from the account as it is. */
  protected readonly changed = computed(
    () =>
      this.value().role !== this.account.role ||
      this.teamId() !== (this.account.team?.id ?? null) ||
      this.value().active !== this.account.active
  );
  /** Whether the account would stop working tickets on its team. */
  protected readonly leavesTeamWork = computed(
    () =>
      this.account.team !== null &&
      this.account.role !== 'admin' &&
      this.account.active &&
      (!this.value().active ||
        this.value().role === 'admin' ||
        this.teamId() !== this.account.team.id)
  );
  /** Whether the account would lead its team after saving. */
  private readonly leads = computed(
    () =>
      this.value().active &&
      this.value().role === 'supervisor' &&
      this.teamId() !== null
  );
  /** The lead this account would replace, if its team has another. */
  protected readonly replacedLead = computed(() => {
    const unchanged =
      this.account.leadsTeam && this.teamId() === this.account.team?.id;
    if (!this.leads() || unchanged) {
      return null;
    }
    const team = this.data.teams.find(({ id }) => id === this.teamId());
    return team?.leadName
      ? { leadName: team.leadName, teamName: team.name }
      : null;
  });
  /** The team this account leads now, if saving leaves it with no lead. */
  protected readonly leftWithoutLead = computed(() => {
    const team = this.account.team;
    if (!this.account.leadsTeam || team === null) {
      return null;
    }
    const stillLeads = this.leads() && this.teamId() === team.id;
    return stillLeads ? null : team.name;
  });

  constructor() {
    // A fresh form: no earlier edit's result or error.
    this.store.resetUpdate();
    // An admin has no team, so the team is neither shown nor required.
    effect(() => {
      const teamId = this.form.controls.teamId;
      if (this.value().role === 'admin') {
        teamId.disable({ emitEvent: false });
      } else {
        teamId.enable({ emitEvent: false });
      }
    });
    effect(() => {
      if (this.store.updateState() === 'saved') {
        this.dialogRef.close(true);
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving() || !this.changed()) {
      this.form.markAllAsTouched();
      return;
    }
    const { role, active } = this.form.getRawValue();
    this.store.update({
      userId: this.account.id,
      request: { role, teamId: this.teamId(), active },
    });
  }
}
