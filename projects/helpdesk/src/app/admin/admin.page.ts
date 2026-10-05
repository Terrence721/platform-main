import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { UserAccount } from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import { sessionFeature } from '../session/session.feature';
import { AccountsTable } from './accounts-table';
import type { CreateAccountData, TeamChoice } from './create-account.dialog';
import type { EditAccountData } from './edit-account.dialog';
import { TeamAccountsStore } from './team-accounts.store';

/** One team's accounts. */
export interface AccountGroup {
  id: string;
  name: string;
  accounts: UserAccount[];
}

/**
 * Groups accounts by team, teams by name. Each group keeps the accounts'
 * order (by name). Accounts with no team (admins) are left out: this page
 * is about the teams.
 */
export function groupByTeam(accounts: UserAccount[]): AccountGroup[] {
  const groups = new Map<string, AccountGroup>();
  for (const { team, ...rest } of accounts) {
    if (team === null) {
      continue;
    }
    const group = groups.get(team.id) ?? { ...team, accounts: [] };
    group.accounts.push({ team, ...rest });
    groups.set(team.id, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * An admin's own page: Team accounts, each team's people in a sortable
 * table of its own, team leads (supervisors) in green and members (agents)
 * in blue. Admins belong to no team, so none is shown. Create Account,
 * beside the summary and at the bottom, opens a popup that adds someone
 * straight into their team's table. Each row's Edit (not on the admin's
 * own) opens a popup that changes the account's role and team or
 * deactivates it. A team without a lead says so. Only admins get here
 * (the route's `canMatchRole('admin')`). The page provides
 * `TeamAccountsStore`, which loads the accounts when the page opens.
 */
@Component({
  selector: 'hd-admin-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AccountsTable,
  ],
  providers: [TeamAccountsStore],
  template: `
    <section class="column" aria-labelledby="admin-title">
      <p class="eyebrow">Admin</p>
      <h1 id="admin-title">Team accounts</h1>
      @if (user(); as user) {
        <p class="greeting">Signed in as {{ user.name }}</p>
      }
      @switch (store.loadState()) {
        @case ('loading') {
          <mat-spinner diameter="40" aria-label="Loading the accounts" />
        }
        @case ('failed') {
          <p class="message" role="alert">
            The accounts couldn't be loaded.
            <button matButton type="button" (click)="store.load()">
              Try again
            </button>
          </p>
        }
        @default {
          <div class="summary-row">
            <p class="summary">
              {{ teamAccountCount() }} accounts in {{ groups().length }} teams
            </p>
            <button
              matButton="filled"
              type="button"
              class="create-top"
              (click)="openCreateAccount()"
            >
              <mat-icon>person_add</mat-icon>
              Create Account
            </button>
          </div>
          @for (group of groups(); track group.id) {
            <section class="team" [attr.aria-label]="group.name">
              <h2>
                {{ group.name }}
                <span class="count"
                  >· {{ group.accounts.length }} accounts</span
                >
                @if (!hasLead(group)) {
                  <!-- The space inside: Angular drops the one between. -->
                  <span class="no-lead">&nbsp;· No lead</span>
                }
              </h2>
              <hd-accounts-table
                [accounts]="group.accounts"
                [signedInId]="user()?.id ?? null"
                (edit)="openEditAccount($event)"
              />
            </section>
          }
          <div class="bottom-actions">
            <button
              matButton="filled"
              type="button"
              class="create-bottom"
              (click)="openCreateAccount()"
            >
              <mat-icon>person_add</mat-icon>
              Create Account
            </button>
          </div>
        }
      }
    </section>
  `,
  styles: `
    /* The same content column as the landing page and the toolbar. */
    .column {
      max-width: 70rem;
      margin-inline: auto;
      padding: 2.5rem 1rem;
    }
    .eyebrow {
      margin: 0;
      font: var(--mat-sys-label-large);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--mat-sys-primary);
    }
    h1 {
      margin: 0.5rem 0 0;
      font: var(--mat-sys-headline-large);
    }
    h2 {
      margin: 2.5rem 0 0.75rem;
      font: var(--mat-sys-title-large);
    }
    .greeting {
      margin: 0.5rem 0 1rem;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .message,
    .summary,
    .count {
      color: var(--mat-sys-on-surface-variant);
    }
    .count,
    .no-lead {
      font: var(--mat-sys-body-large);
    }
    .no-lead {
      color: var(--mat-sys-error);
    }
    .summary-row,
    .bottom-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1.5rem;
    }
    .bottom-actions {
      margin-top: 2rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminPage {
  protected readonly store = inject(TeamAccountsStore);
  protected readonly user = inject(Store).selectSignal(
    sessionFeature.selectUser
  );
  /** The accounts on teams, one group per team. */
  protected readonly groups = computed(() =>
    groupByTeam(this.store.entities())
  );
  /** How many accounts the teams hold between them. */
  protected readonly teamAccountCount = computed(() =>
    this.groups().reduce((total, group) => total + group.accounts.length, 0)
  );
  /** The teams a new account can join, each with who leads it now. */
  protected readonly teamChoices = computed((): TeamChoice[] =>
    this.groups().map(({ id, name, accounts }) => ({
      id,
      name,
      leadName: accounts.find(({ leadsTeam }) => leadsTeam)?.name ?? null,
    }))
  );
  private readonly injector = inject(Injector);

  /**
   * Opens the Create Account popup, with this page's injector so it
   * creates through this page's store. The popup's and the snack bar's
   * code load on the first click (dynamic `import()`), not with the page.
   * Once created, a snack bar names the new account.
   */
  protected async openCreateAccount(): Promise<void> {
    const [{ MatDialog }, { MatSnackBar }, { CreateAccountDialog }] =
      await Promise.all([
        import('@angular/material/dialog'),
        import('@angular/material/snack-bar'),
        import('./create-account.dialog'),
      ]);
    const data: CreateAccountData = { teams: this.teamChoices() };
    this.injector
      .get(MatDialog)
      .open(CreateAccountDialog, {
        data,
        injector: this.injector,
        width: '30rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      // The new user ID once created; nothing when cancelled.
      .subscribe((userId: unknown) => {
        if (typeof userId === 'string') {
          this.injector
            .get(MatSnackBar)
            .open(`Account ${userId} created`, undefined, { duration: 5000 });
        }
      });
  }

  /** Whether one of the team's accounts leads it. */
  protected hasLead(group: AccountGroup): boolean {
    return group.accounts.some(({ leadsTeam }) => leadsTeam);
  }

  /**
   * Opens the Edit account popup for one account, with this page's
   * injector so it saves through this page's store; its code loads on the
   * first click, as Create Account's does. Once saved, a snack bar names
   * the account and how many open tickets went back to Unassigned.
   */
  protected async openEditAccount(account: UserAccount): Promise<void> {
    const [{ MatDialog }, { MatSnackBar }, { EditAccountDialog }] =
      await Promise.all([
        import('@angular/material/dialog'),
        import('@angular/material/snack-bar'),
        import('./edit-account.dialog'),
      ]);
    const data: EditAccountData = { account, teams: this.teamChoices() };
    this.injector
      .get(MatDialog)
      .open(EditAccountDialog, {
        data,
        injector: this.injector,
        width: '30rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
      .afterClosed()
      // true once saved; nothing when cancelled.
      .subscribe((saved: unknown) => {
        const updated = this.store.updated();
        if (saved === true && updated !== null) {
          this.injector
            .get(MatSnackBar)
            .open(
              savedMessage(account.name, updated.releasedTickets),
              undefined,
              {
                duration: 5000,
              }
            );
        }
      });
  }
}

/** The snack bar after an edit: whose, and any tickets handed back. */
export function savedMessage(name: string, releasedTickets: number): string {
  if (releasedTickets === 0) {
    return `Saved ${name}.`;
  }
  const tickets =
    releasedTickets === 1 ? '1 open ticket' : `${releasedTickets} open tickets`;
  return `Saved ${name}. ${tickets} returned to Unassigned.`;
}
