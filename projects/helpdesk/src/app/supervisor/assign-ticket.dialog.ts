import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { formatTicketNumber, type TeamMember } from '@helpdesk/contract';

/** What the page opens the popup with. */
export interface AssignTicketData {
  ticketNumber: number;
  subject: string;
  /** Who holds the ticket now; `null` when nobody does. */
  currentAssigneeId: string | null;
  /** The team's agents, with their load. */
  members: TeamMember[];
}

/**
 * The "Assign to…" popup: the team's agents with their open and overdue
 * work, to choose one. It only chooses: it closes with the chosen agent's
 * user ID, and the page does the assigning. The agent who holds the ticket
 * now cannot be chosen again; when nobody else can be, it says so.
 */
@Component({
  selector: 'hd-assign-ticket-dialog',
  imports: [MatButtonModule, MatDialogModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>Assign {{ ticketNumber }}</h2>
    <mat-dialog-content>
      <p class="subject">{{ data.subject }}</p>
      <mat-radio-group
        class="agents"
        aria-label="Agent"
        [value]="chosen()"
        (change)="chosen.set($event.value)"
      >
        @for (member of data.members; track member.id) {
          <mat-radio-button
            [value]="member.id"
            [disabled]="member.id === data.currentAssigneeId"
          >
            {{ member.name }}
            <span class="load"
              >· {{ member.openTickets }} open ·
              {{ member.overdueTickets }} overdue</span
            >
            @if (member.id === data.currentAssigneeId) {
              <span class="load">&#32;(has it now)</span>
            }
          </mat-radio-button>
        }
      </mat-radio-group>
      @if (nobodyToChoose) {
        <p class="nobody">No other agent on your team can take it.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Cancel</button>
      <button
        matButton="filled"
        type="button"
        [disabled]="chosen() === null"
        (click)="assign()"
      >
        Assign
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .subject {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .agents {
      display: flex;
      flex-direction: column;
    }
    .load,
    .nobody {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignTicketDialog {
  protected readonly data = inject<AssignTicketData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AssignTicketDialog>);

  protected readonly ticketNumber = formatTicketNumber(this.data.ticketNumber);
  /**
   * No agent can be chosen: the team has no active agent, or only the one
   * who holds the ticket (deactivated agents are left out, #1027).
   */
  protected readonly nobodyToChoose = this.data.members.every(
    ({ id }) => id === this.data.currentAssigneeId
  );
  /** The agent chosen; nobody until the supervisor picks. */
  protected readonly chosen = signal<string | null>(null);

  protected assign(): void {
    const chosen = this.chosen();
    if (chosen !== null) {
      this.dialogRef.close(chosen);
    }
  }
}
