import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  formatTicketNumber,
  isFinished,
  TICKET_PRIORITIES,
  TICKET_STATUS_TRANSITIONS,
  TICKET_STATUSES,
  type TicketDto,
  type TicketStatus,
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
  /** The ticket itself, for the row's action. */
  ticket: TicketDto;
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
 * when the tickets arrive; a resolved or closed ticket reads "Finished"
 * instead, as its due time no longer matters. Given an `actionLabel`
 * (such as "Assign"), each
 * row that `canAct` allows ends with a button that emits its ticket
 * through `action`. With `statusMenu`, each row also gets a Change status
 * menu listing only the moves the workflow allows (none once closed); the
 * choice comes out through `statusChange`. With `subjectLinks`, each
 * subject is a link whose ticket comes out through `open`.
 */
@Component({
  selector: 'hd-ticket-table',
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatMenuModule,
    MatSortModule,
    MatTableModule,
  ],
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
        <td mat-cell *matCellDef="let row">
          @if (subjectLinks()) {
            <button
              class="subject-link"
              type="button"
              [attr.aria-label]="
                'Open ' + row.ticketNumber + ', ' + row.subject
              "
              (click)="open.emit(row.ticket)"
            >
              {{ row.subject }}
            </button>
          } @else {
            {{ row.subject }}
          }
        </td>
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
      <ng-container matColumnDef="action">
        <th mat-header-cell *matHeaderCellDef>
          <span class="cdk-visually-hidden">Actions</span>
        </th>
        <td mat-cell *matCellDef="let row">
          @if (canAct()(row.ticket)) {
            <button
              matButton
              type="button"
              [attr.aria-label]="actionLabel() + ' ' + row.ticketNumber"
              (click)="action.emit(row.ticket)"
            >
              {{ actionLabel() }}
            </button>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="statusMenu">
        <th mat-header-cell *matHeaderCellDef>
          <span class="cdk-visually-hidden">Change status</span>
        </th>
        <td mat-cell *matCellDef="let row">
          @if (nextStatuses(row.ticket).length > 0) {
            <button
              matButton
              type="button"
              [attr.aria-label]="'Change status of ' + row.ticketNumber"
              [matMenuTriggerFor]="statusChoices"
              [matMenuTriggerData]="{ ticket: row.ticket }"
            >
              Change status
            </button>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns()"></tr>
      <tr mat-row *matRowDef="let row; columns: columns()"></tr>
    </table>
    <!-- One menu for every row; it lists the moves the workflow allows. -->
    <mat-menu #statusChoices="matMenu">
      <ng-template matMenuContent let-ticket="ticket">
        @for (status of nextStatuses(ticket); track status) {
          <button
            mat-menu-item
            type="button"
            (click)="statusChange.emit({ ticket, status })"
          >
            {{ statusLabel(status) }}
          </button>
        }
      </ng-template>
    </mat-menu>
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
    /* A button that reads as a link: it opens the ticket. */
    .subject-link {
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      text-align: start;
      color: var(--mat-sys-primary);
      text-decoration: underline;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketTable {
  /** The tickets to show, in this order. */
  readonly tickets = input.required<TicketDto[]>();
  /** The text of each row's action button; no button without one. */
  readonly actionLabel = input<string | null>(null);
  /** Which rows get the action button; every row unless given. */
  readonly canAct = input<(ticket: TicketDto) => boolean>(() => true);
  /** The ticket whose action button was clicked. */
  readonly action = output<TicketDto>();
  /** Whether each row gets a Change status menu. */
  readonly statusMenu = input(false);
  /** A ticket, and the status chosen for it from its menu. */
  readonly statusChange = output<{ ticket: TicketDto; status: TicketStatus }>();
  /** Whether each subject is a link that opens its ticket. */
  readonly subjectLinks = input(false);
  /** The ticket whose subject was clicked. */
  readonly open = output<TicketDto>();

  protected readonly columns = computed(() => [
    ...COLUMNS,
    ...(this.actionLabel() === null ? [] : ['action']),
    ...(this.statusMenu() ? ['statusMenu'] : []),
  ]);

  /** The statuses a ticket may move to next; none once closed. */
  protected nextStatuses(ticket: TicketDto): readonly TicketStatus[] {
    return TICKET_STATUS_TRANSITIONS[ticket.status];
  }

  /** How a status reads, such as "Pending". */
  protected statusLabel(status: TicketStatus): string {
    return STATUS_GUIDE[status].label;
  }
  private readonly rows = computed(() => {
    const now = new Date();
    return this.tickets().map((ticket): TicketRow => ({
      ticket,
      ticketNumber: formatTicketNumber(ticket.ticketNumber),
      subject: ticket.subject,
      customer: ticket.requester.name,
      priority: ticket.priority,
      status: STATUS_GUIDE[ticket.status].label,
      // A finished ticket's due time no longer matters.
      sla: isFinished(ticket.status)
        ? { text: 'Finished', tone: 'none' }
        : slaLabel(ticket.slaDueAt, now),
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
