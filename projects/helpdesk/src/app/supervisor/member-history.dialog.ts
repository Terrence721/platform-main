import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type {
  HistorySummary,
  MemberHistory,
  PersonSummary,
} from '@helpdesk/contract';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { TicketTable } from '../tickets/ticket-table';
import { MY_TEAM_API } from './my-team.store';

/** Where one team member's history comes from. */
export function memberHistoryApi(userId: string): string {
  return `${MY_TEAM_API}/members/${encodeURIComponent(userId)}/history`;
}

/** The counts the popup shows, in order, with their labels. */
const COUNTS: readonly { key: keyof HistorySummary; label: string }[] = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'finished', label: 'Finished' },
  { key: 'open', label: 'Open' },
  { key: 'onTime', label: 'On time' },
  { key: 'late', label: 'Late' },
];

/**
 * The popup's own data: the member's history, loaded when the popup opens,
 * so each opening starts fresh.
 */
const MemberHistoryStore = signalStore(
  withState({
    history: null as MemberHistory | null,
    loadState: 'loading' as 'loading' | 'loaded' | 'failed',
  }),
  withMethods(
    (
      store,
      http = inject(HttpClient),
      member = inject<PersonSummary>(MAT_DIALOG_DATA)
    ) => ({
      /** Loads the history again; a newer load replaces one still running. */
      load: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loadState: 'loading' })),
          switchMap(() =>
            http.get<MemberHistory>(memberHistoryApi(member.id)).pipe(
              tapResponse({
                next: (history) =>
                  patchState(store, { history, loadState: 'loaded' }),
                error: () =>
                  patchState(store, { history: null, loadState: 'failed' }),
              })
            )
          )
        )
      ),
    })
  ),
  withHooks({
    onInit: (store) => store.load(),
  })
);

/**
 * A team member's last three months, for their supervisor: how their
 * tickets add up, and the tickets themselves (sortable). Opened with the
 * member's id and name as its data; closes with the button or Esc.
 */
@Component({
  selector: 'hd-member-history-dialog',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TicketTable,
  ],
  providers: [MemberHistoryStore],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ member.name }}</h2>
      <button matIconButton mat-dialog-close aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      @switch (store.loadState()) {
        @case ('loading') {
          <mat-spinner
            diameter="40"
            [attr.aria-label]="'Loading the history of ' + member.name"
          />
        }
        @case ('failed') {
          <p class="message" role="alert">
            This history couldn't be loaded.
            <button matButton type="button" (click)="store.load()">
              Try again
            </button>
          </p>
        }
        @default {
          @if (store.history(); as history) {
            <p class="period">
              Last 3 months · since {{ history.since | date: 'd MMM y' }}
            </p>
            <dl class="counts">
              @for (count of counts; track count.key) {
                <div [class]="count.key">
                  <dt>{{ count.label }}</dt>
                  <dd>{{ history.summary[count.key] }}</dd>
                </div>
              }
            </dl>
            <p class="note">
              On time and late compare when each ticket was finished with its
              due time.
            </p>
            @if (history.tickets.length === 0) {
              <p class="message">No tickets in the last 3 months.</p>
            } @else {
              <hd-ticket-table [tickets]="history.tickets" />
            }
          }
        }
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
    .period,
    .note,
    .message {
      color: var(--mat-sys-on-surface-variant);
    }
    .period {
      margin: 0 0 1rem;
    }
    .counts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
      gap: 0.75rem;
      margin: 0;
    }
    .counts div {
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);
    }
    dt {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-headline-small);
    }
    .late dd {
      color: var(--mat-sys-error);
    }
    .note {
      font: var(--mat-sys-body-small);
      margin: 0.5rem 0 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberHistoryDialog {
  protected readonly member = inject<PersonSummary>(MAT_DIALOG_DATA);
  protected readonly store = inject(MemberHistoryStore);
  protected readonly counts = COUNTS;
}
