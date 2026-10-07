import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { hasPermission, Permission, Role, ROLES } from '@helpdesk/contract';

/** One row of the table: something a person can do, in the contract's terms. */
export interface Ability {
  label: string;
  /** A role can do it when it has every one of these. */
  permissions: readonly Permission[];
}

/**
 * What the landing page lists, in the mockup's order: only what the help
 * desk does (the mockup's priority changes and queue, customer and canned
 * reply management were never built, #1023).
 */
export const ABILITIES: readonly Ability[] = [
  {
    label: 'Work tickets: reply, add notes, change status',
    permissions: ['tickets:read', 'tickets:reply', 'tickets:update'],
  },
  { label: 'Take a ticket', permissions: ['tickets:assign-self'] },
  {
    label: "Assign or reassign within one's team",
    permissions: ['tickets:assign-others'],
  },
  { label: "Manage the team's accounts", permissions: ['admin:users'] },
];

const ROLE_LABELS: Readonly<Record<Role, string>> = {
  agent: 'Agent',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

interface AbilityRow {
  label: string;
  can: Readonly<Record<Role, boolean>>;
}

/**
 * The landing page's roles section: what each role may do, as a table.
 * Every cell comes from the contract's permissions, so the page cannot
 * promise more than the API allows.
 */
@Component({
  selector: 'hd-roles-table',
  imports: [MatCardModule, MatIconModule, MatTableModule],
  template: `
    <header>
      <h2 id="roles-title">Three roles, clear limits</h2>
      <p>
        Customers never need an account. Everyone who signs in has one of three
        roles.
      </p>
    </header>
    <mat-card appearance="outlined">
      <table mat-table [dataSource]="rows">
        <ng-container matColumnDef="ability">
          <th mat-header-cell *matHeaderCellDef scope="col">
            What they can do
          </th>
          <td mat-cell *matCellDef="let row">{{ row.label }}</td>
        </ng-container>
        @for (role of roles; track role) {
          <ng-container [matColumnDef]="role">
            <th mat-header-cell *matHeaderCellDef scope="col" class="role">
              {{ roleLabels[role] }}
            </th>
            <td mat-cell *matCellDef="let row" class="role">
              @if (row.can[role]) {
                <mat-icon aria-hidden="true">check</mat-icon>
                <span class="cdk-visually-hidden">Yes</span>
              } @else {
                <span class="no" aria-hidden="true">—</span>
                <span class="cdk-visually-hidden">No</span>
              }
            </td>
          </ng-container>
        }
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
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
    header p {
      margin: 0.625rem 0 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    mat-card {
      overflow-x: auto;
    }
    table {
      min-width: 32.5rem;
      --mat-table-background-color: transparent;
    }
    .role {
      width: 7.5rem;
      text-align: center;
    }
    mat-icon {
      vertical-align: middle;
      color: var(--mat-sys-primary);
    }
    .no {
      color: var(--mat-sys-outline);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesTable {
  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly columns = ['ability', ...ROLES];
  protected readonly rows: AbilityRow[] = ABILITIES.map(
    ({ label, permissions }) => ({
      label,
      can: {
        agent: canDo('agent', permissions),
        supervisor: canDo('supervisor', permissions),
        admin: canDo('admin', permissions),
      },
    })
  );
}

function canDo(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}
