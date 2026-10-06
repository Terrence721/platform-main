import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import type {
  AddTicketMessageRequest,
  TicketDto,
  TicketMessage,
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
import { exhaustMap, filter, map, pipe, switchMap, tap } from 'rxjs';
import { Store } from '@ngrx/store';
import { LiveUpdates } from '../live/live-updates';
import { sessionFeature } from '../session/session.feature';
import { Sounds } from '../sound/sounds';
import { apiErrorMessage } from './api-error-message';
import { messagesApi } from './ticket-api-paths';

/** What the ticket popup is opened with. */
export interface TicketConversationData {
  ticket: TicketDto;
}

/** Said when a message could not be sent and the API gave no reason. */
export const SEND_FAILED_MESSAGE = "Your message couldn't be sent.";

/** Where sending is up to; `idle` until a message is sent. */
export type SendState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * The ticket popup's own data: the ticket's replies and internal notes,
 * loaded when the popup opens (so each opening starts fresh), and sending
 * a new one. A sent message is added at the end, as the newest. While the
 * popup is open, someone else's reply or note on the ticket appears too
 * (live updates, #950).
 */
export const TicketConversationStore = signalStore(
  withState({
    messages: [] as TicketMessage[],
    loadState: 'loading' as 'loading' | 'loaded' | 'failed',
    sendState: 'idle' as SendState,
    sendError: null as string | null,
  }),
  withMethods(
    (
      store,
      http = inject(HttpClient),
      { ticket } = inject<TicketConversationData>(MAT_DIALOG_DATA),
      sounds = inject(Sounds),
      user = inject(Store).selectSignal(sessionFeature.selectUser)
    ) => ({
      /** Loads the conversation again; a newer load replaces one running. */
      load: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loadState: 'loading' })),
          switchMap(() =>
            http.get<TicketMessage[]>(messagesApi(ticket.id)).pipe(
              tapResponse({
                next: (messages) =>
                  patchState(store, { messages, loadState: 'loaded' }),
                error: () =>
                  patchState(store, { messages: [], loadState: 'failed' }),
              })
            )
          )
        )
      ),

      /**
       * Sends a reply or an internal note. While one is on its way, more
       * sends are ignored, so a double-click sends it once.
       */
      send: rxMethod<AddTicketMessageRequest>(
        pipe(
          exhaustMap((request) => {
            patchState(store, { sendState: 'sending', sendError: null });
            return http
              .post<TicketMessage>(messagesApi(ticket.id), request)
              .pipe(
                tapResponse({
                  next: (message) =>
                    patchState(store, {
                      messages: [...store.messages(), message],
                      sendState: 'sent',
                    }),
                  error: (error) =>
                    patchState(store, {
                      sendState: 'failed',
                      sendError: apiErrorMessage(error, SEND_FAILED_MESSAGE),
                    }),
                })
              );
          })
        )
      ),

      /**
       * Fetches the conversation again and swaps it in quietly, with no
       * spinner: for a live update (#950), when someone else wrote on this
       * ticket. The whole list is replaced, so a message this popup sent
       * itself is never there twice. A failed refresh keeps what is shown.
       */
      refresh: rxMethod<void>(
        pipe(
          switchMap(() =>
            http.get<TicketMessage[]>(messagesApi(ticket.id)).pipe(
              tapResponse({
                next: (messages) => {
                  // Someone else wrote on the ticket: a message that wasn't
                  // shown and isn't this person's own (its event can come
                  // before their own send finishes).
                  const shown = new Set(store.messages().map(({ id }) => id));
                  const me = user()?.id;
                  const arrived = messages.some(
                    ({ id, author }) => !shown.has(id) && author.id !== me
                  );
                  if (arrived && store.loadState() === 'loaded') {
                    sounds.play('arrival');
                  }
                  patchState(store, { messages, loadState: 'loaded' });
                },
                error: () => undefined,
              })
            )
          )
        )
      ),
    })
  ),
  withHooks({
    onInit: (
      store,
      live = inject(LiveUpdates),
      { ticket } = inject<TicketConversationData>(MAT_DIALOG_DATA)
    ) => {
      store.load();
      // A reply or note on this ticket, or the stream back after a break.
      store.refresh(
        live.updates.pipe(
          filter(
            (update) =>
              update.kind === 'reconnected' ||
              (update.event.type === 'message' &&
                update.event.ticketId === ticket.id)
          ),
          map(() => undefined)
        )
      );
    },
  })
);
