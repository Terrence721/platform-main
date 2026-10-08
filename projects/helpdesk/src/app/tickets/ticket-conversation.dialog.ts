import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  formatTicketNumber,
  isFinished,
  TICKET_MESSAGE_MAX_LENGTH,
  type TicketMessageKind,
} from '@helpdesk/contract';
import { slaLabel } from '../landing/ticket-preview.store';
import { STATUS_GUIDE } from '../landing/ticket-workflow.store';
import { minuteClock } from './minute-clock';
import { TicketConversationStore } from './ticket-conversation.store';

/**
 * One ticket, opened from its subject: its details, then its conversation
 * (the customer's description first, then each reply and internal note,
 * oldest first; notes tinted, as only staff see them), then a box to write
 * a Reply or an Internal note. A closed ticket is final, so it shows the
 * conversation without the box. While open, the details follow the
 * ticket's changes (#982): closed elsewhere, the box goes; reassigned
 * away from the person, it says so instead. Opened with the ticket as its
 * data; closes with the button or Esc.
 */
@Component({
  selector: 'hd-ticket-conversation-dialog',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  providers: [TicketConversationStore],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ ticketNumber() }} {{ ticket().subject }}</h2>
      <button matIconButton mat-dialog-close aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <dl class="details">
        <div>
          <dt>Customer</dt>
          <dd>
            {{ ticket().requester.name }} · {{ ticket().requester.email }}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ status() }}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd class="priority">{{ ticket().priority }}</dd>
        </div>
        <div>
          <dt>Assigned to</dt>
          <!-- No longer theirs: who has it now isn't theirs to see. -->
          <dd>
            {{
              store.access() === 'gone'
                ? 'Someone else'
                : (ticket().assignee?.name ?? 'Nobody')
            }}
          </dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd [class]="due().tone">{{ due().text }}</dd>
        </div>
      </dl>

      <h3>Conversation</h3>
      <!-- A message someone else writes is read out as it appears. -->
      <ol class="conversation" aria-live="polite">
        <li class="customer">
          <p class="meta">
            <strong>{{ ticket().requester.name }}</strong> · customer ·
            {{ ticket().createdAt | date: 'd MMM, HH:mm' }}
          </p>
          <p class="body">{{ ticket().description }}</p>
        </li>
        @for (message of store.messages(); track message.id) {
          <li [class]="message.kind">
            <p class="meta">
              <strong>{{ message.author.name }}</strong> ·
              {{
                message.kind === 'note'
                  ? 'Internal note'
                  : 'Reply to ' + ticket().requester.name
              }}
              · {{ message.createdAt | date: 'd MMM, HH:mm' }}
            </p>
            <p class="body">{{ message.body }}</p>
          </li>
        }
      </ol>
      @switch (store.loadState()) {
        @case ('loading') {
          <mat-spinner diameter="32" aria-label="Loading the conversation" />
        }
        @case ('failed') {
          <p class="message" role="alert">
            The conversation couldn't be loaded.
            <button matButton type="button" (click)="store.load()">
              Try again
            </button>
          </p>
        }
      }

      @if (store.access() === 'gone') {
        <p class="message" role="status">
          This ticket is no longer assigned to you.
        </p>
      } @else if (ticket().status === 'closed') {
        <p class="message" role="status">
          This ticket is closed, so nothing more can be added.
        </p>
      } @else {
        <mat-form-field class="draft" appearance="outline">
          <mat-label>Message</mat-label>
          <textarea
            matInput
            rows="4"
            [formControl]="draft"
            [maxlength]="maxLength"
          ></textarea>
          <mat-hint align="end">{{ length() }} / {{ maxLength }}</mat-hint>
        </mat-form-field>
        @if (store.sendState() === 'failed') {
          <p class="error" role="alert">{{ store.sendError() }}</p>
        }
        <div class="actions">
          <button
            matButton="outlined"
            type="button"
            [disabled]="!canSend()"
            (click)="send('note')"
          >
            Internal note
          </button>
          <button
            matButton="filled"
            type="button"
            [disabled]="!canSend()"
            (click)="send('reply')"
          >
            Reply
          </button>
        </div>
      }
    </mat-dialog-content>
  `,
  styles: `
    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-right: 0.75rem;
    }
    .details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: 0.75rem;
      margin: 0;
    }
    dt {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0.25rem 0 0;
    }
    .priority {
      text-transform: capitalize;
    }
    .overdue,
    .error {
      color: var(--mat-sys-error);
    }
    h3 {
      margin: 1.5rem 0 0.75rem;
      font: var(--mat-sys-title-medium);
    }
    .conversation {
      display: grid;
      gap: 0.75rem;
      margin: 0 0 1rem;
      padding: 0;
      list-style: none;
    }
    .conversation li {
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);
    }
    /* Notes are for staff only, so they stand apart. */
    .conversation .note {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .meta {
      margin: 0 0 0.25rem;
      font: var(--mat-sys-label-medium);
    }
    .body {
      margin: 0;
      white-space: pre-wrap;
    }
    .message {
      color: var(--mat-sys-on-surface-variant);
    }
    .draft {
      width: 100%;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketConversationDialog {
  protected readonly store = inject(TicketConversationStore);
  /** The ticket as last read: it follows changes while open (#982). */
  protected readonly ticket = this.store.ticket;
  protected readonly maxLength = TICKET_MESSAGE_MAX_LENGTH;
  protected readonly ticketNumber = computed(() =>
    formatTicketNumber(this.ticket().ticketNumber)
  );
  protected readonly status = computed(
    () => STATUS_GUIDE[this.ticket().status].label
  );
  /** Now, to the minute, so time left keeps up while the popup is open. */
  private readonly now = minuteClock();
  /** Time left, or "Finished": a finished ticket's due time is past. */
  protected readonly due = computed(() =>
    isFinished(this.ticket().status)
      ? { text: 'Finished', tone: 'none' }
      : slaLabel(this.ticket().slaDueAt, this.now())
  );

  /** What is being written. */
  protected readonly draft = new FormControl('', { nonNullable: true });
  private readonly text = toSignal(this.draft.valueChanges, {
    initialValue: '',
  });
  protected readonly length = computed(() => this.text().length);
  /** Something to send, and nothing on its way already. */
  protected readonly canSend = computed(
    () => this.text().trim() !== '' && this.store.sendState() !== 'sending'
  );

  /** Sends the text, trimmed, as a reply to the customer or a note. */
  protected send(kind: TicketMessageKind): void {
    this.store.send({ kind, body: this.draft.value.trim() });
  }

  constructor() {
    // Once a message is sent, the box is ready for the next one.
    effect(() => {
      if (this.store.sendState() === 'sent') {
        untracked(() => this.draft.reset());
      }
    });
  }
}
