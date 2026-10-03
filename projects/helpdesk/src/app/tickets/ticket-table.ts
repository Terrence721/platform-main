import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  formatTicketNumber,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketDto,
} from '@helpdesk/contract';
import { slaLabel } from '../landing/ticket-preview.store';
import { STATUS_GUIDE } from '../landing/ticket-workflow.store';

/** The columns, in order; each one can be sorted by. */
const COLUMNS = [
  'ticketNumber',
  'subject',
  'customer',
  'priority',
  'status',
  'due',
] as const;

type Column = (typeof COLUMNS)[number];

/** A ticket as a row: what each cell shows, and what each column sorts by. */
interface TicketRow {
  ticketNumber: string;
  subject: string;
  customer: string;
  priority: string;
  status: string;
  sla: ReturnType<typeof slaLabel>;
  sortBy: Record<Column, string | number>;
}

/**
 * A list of tickets as a table: number, subject, customer, priority,
 * status, and time left against the SLA (overdue in the error color).
 * Shows the tickets in the order given until a column header is clicked;
 * each click sorts by that column, then reverses, then returns to the
 * order given. Priority and status sort in their workflow order, not
 * alphabetically; Due sorts by due time, no SLA last. Time left is as of
 * when the tickets arrive.
 */
@Component({
  selector: 'hd-ticket-table',
  imports: [MatChipsModule, MatSortModule, MatTableModule],
  template: `
    <table mat-table [dataSource]="dataSource" matSort>
      <ng-container matColumnDef="ticketNumber">
        <th
          mat-header-cell
          *matHeaderCellDef
          mat-sort-header
          sortActionDescription="Sort by ticket number"
        >
          #
        </th>
        <td mat-cell *matCellDef="let row">{{ row.ticketNumber }}</td>
      </ng-container>
      <ng-container matColumnDef="subject">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Subject</th>
        <td mat-cell *matCellDef="let row">{{ row.subject }}</td>
      </ng-container>
      <ng-container matColumnDef="customer">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
        <td mat-cell *matCellDef="let row">{{ row.customer }}</td>
      </ng-container>
      <ng-container matColumnDef="priority">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Priority</th>
        <td mat-cell *matCellDef="let row">
          <mat-chip-set>
            <mat-chip [class]="row.priority">{{ row.priority }}</mat-chip>
          </mat-chip-set>
        </td>
      </ng-container>
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
        <td mat-cell *matCellDef="let row">{{ row.status }}</td>
      </ng-container>
      <ng-container matColumnDef="due">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Due</th>
        <td mat-cell *matCellDef="let row" [class]="row.sla.tone">
          {{ row.sla.text }}
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: `
    mat-chip {
      text-transform: capitalize;
    }
    .urgent {
      --mat-chip-elevated-container-color: var(--mat-sys-tertiary-container);
    }
    .high {
      --mat-chip-elevated-container-color: var(--mat-sys-primary-container);
    }
    .overdue {
      color: var(--mat-sys-error);
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketTable {
  /** The tickets to show, in this order. */
  readonly tickets = input.required<TicketDto[]>();

  protected readonly columns = COLUMNS;
  private readonly rows = computed(() => {
    const now = new Date();
    return this.tickets().map((ticket): TicketRow => ({
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
      subject: ticket.subject,
      customer: ticket.requester.name,
      priority: ticket.priority,
      status: STATUS_GUIDE[ticket.status].label,
      sla: slaLabel(ticket.slaDueAt, now),
      sortBy: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject.toLowerCase(),
        customer: ticket.requester.name.toLowerCase(),
        priority: TICKET_PRIORITIES.indexOf(ticket.priority),
        status: TICKET_STATUSES.indexOf(ticket.status),
        // No SLA sorts after every due time.
        due:
          ticket.slaDueAt === null
            ? Number.MAX_SAFE_INTEGER
            : new Date(ticket.slaDueAt).getTime(),
      },
    }));
  });

  /** The rows, sorted by the clicked header; unsorted, in the order given. */
  protected readonly dataSource = new MatTableDataSource<TicketRow>();
  private readonly sort = viewChild.required(MatSort);

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) =>
      row.sortBy[column as Column];
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.dataSource.sort = this.sort();
    });
  }
}
