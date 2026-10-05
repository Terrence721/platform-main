import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ROLES, type UserAccount } from '@helpdesk/contract';

/** The columns, in order; each one can be sorted by. */
const COLUMNS = ['id', 'name', 'role', 'status'] as const;

type Column = (typeof COLUMNS)[number];

/** What the table shows: the sortable columns, then each row's Edit. */
const DISPLAYED_COLUMNS = [...COLUMNS, 'edit'] as const;

/** What each column sorts by, for an account. */
function sortValue(account: UserAccount, column: Column): string | number {
  switch (column) {
    case 'id':
      return account.id;
    case 'name':
      return account.name.toLowerCase();
    case 'role':
      // agent, supervisor, admin: the contract's order, not A to Z.
      return ROLES.indexOf(account.role);
    case 'status':
      return account.active ? 0 : 1;
  }
}

/**
 * A list of accounts as a table: user ID, name, role and status; the
 * supervisor who leads the team reads "Supervisor · Lead". Shows them
 * in the order given until a column header is clicked; each click sorts by
 * that column, then reverses, then returns to the order given. Role sorts
 * in role order, not alphabetically; active accounts sort before inactive.
 * Each row but the signed-in admin's own has an Edit button.
 */
@Component({
  selector: 'hd-accounts-table',
  imports: [MatButtonModule, MatIconModule, MatSortModule, MatTableModule],
  template: `
    <table mat-table [dataSource]="dataSource" matSort>
      <ng-container matColumnDef="id">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>User ID</th>
        <td mat-cell *matCellDef="let account">{{ account.id }}</td>
      </ng-container>
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
        <td mat-cell *matCellDef="let account">{{ account.name }}</td>
      </ng-container>
      <ng-container matColumnDef="role">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Role</th>
        <td mat-cell *matCellDef="let account">
          <span class="role" [class]="account.role"
            >{{ account.role }}
            @if (account.leadsTeam) {
              · lead
            }
          </span>
        </td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
        <td
          mat-cell
          *matCellDef="let account"
          [class.inactive]="!account.active"
        >
          {{ account.active ? 'Active' : 'Inactive' }}
        </td>
      </ng-container>
      <ng-container matColumnDef="edit">
        <th mat-header-cell *matHeaderCellDef>
          <span class="cdk-visually-hidden">Edit</span>
        </th>
        <td mat-cell *matCellDef="let account" class="edit">
          @if (account.id !== signedInId()) {
            <button
              matIconButton
              type="button"
              [attr.aria-label]="'Edit ' + account.name"
              (click)="edit.emit(account)"
            >
              <mat-icon>edit</mat-icon>
            </button>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: `
    /* The role as a pill: team leads green, members blue. light-dark()
       keeps each readable in the light and the dark theme. */
    .role {
      display: inline-block;
      padding: 0.125rem 0.625rem;
      border-radius: 1rem;
      font: var(--mat-sys-label-large);
      text-transform: capitalize;
    }
    .supervisor {
      color: light-dark(#1b5e20, #a5d6a7);
      background: light-dark(#e8f5e9, #1b3a1f);
    }
    .agent {
      color: light-dark(#0d47a1, #90caf9);
      background: light-dark(#e3f2fd, #10294a);
    }
    .inactive {
      color: var(--mat-sys-on-surface-variant);
      font-style: italic;
    }
    .edit {
      width: 3rem;
      text-align: end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountsTable {
  /** The accounts to show, in this order. */
  readonly accounts = input.required<UserAccount[]>();
  /** The signed-in admin's user ID: their own row has no Edit. */
  readonly signedInId = input<string | null>(null);
  /** An account whose Edit was clicked. */
  readonly edit = output<UserAccount>();

  protected readonly columns = DISPLAYED_COLUMNS;
  /** The accounts, sorted by the clicked header; unsorted, as given. */
  protected readonly dataSource = new MatTableDataSource<UserAccount>();
  private readonly sort = viewChild.required(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (account, column) =>
      sortValue(account, column as Column);
    effect(() => {
      this.dataSource.data = this.accounts();
    });
    effect(() => {
      this.dataSource.sort = this.sort();
    });
  }
}
