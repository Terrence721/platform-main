import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import type { TicketDto, TicketMessage } from '@helpdesk/contract';
import { Subject } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { type LiveUpdate, LiveUpdates } from '../live/live-updates';
import { initialSessionState } from '../session/session.feature';
import { Sounds } from '../sound/sounds';
import { messagesApi, ticketApi } from './ticket-api-paths';
import {
  SEND_FAILED_MESSAGE,
  TicketConversationStore,
} from './ticket-conversation.store';

const sam = { id: 'sam.rivera', name: 'Sam Rivera' };

/** The ticket as the popup opened it: open, Sam's. */
const ticket = {
  id: 'ticket-1001',
  ticketNumber: 1001,
  status: 'open',
  assignee: sam,
} as TicketDto;
const API = messagesApi(ticket.id);
/** Where the ticket itself is read again. */
const TICKET_API = ticketApi(ticket.id);

const reply: TicketMessage = {
  id: 'message-1',
  kind: 'reply',
  body: 'Which browser are you using?',
  author: sam,
  createdAt: '2026-10-04T09:00:00.000Z',
};

const note: TicketMessage = {
  id: 'message-2',
  kind: 'note',
  body: 'Checked the logs.',
  author: sam,
  createdAt: '2026-10-04T10:00:00.000Z',
};

describe('TicketConversationStore', () => {
  let store: InstanceType<typeof TicketConversationStore>;
  let http: HttpTestingController;
  /** The live updates the store hears, sent by the test. */
  let live: Subject<LiveUpdate>;
  /** A stand-in for the sounds, to hear which play. */
  const sounds = { play: vi.fn() };

  beforeEach(() => {
    live = new Subject<LiveUpdate>();
    sounds.play.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { ticket } },
        { provide: LiveUpdates, useValue: { updates: live } },
        { provide: Sounds, useValue: sounds },
        // Sam has the popup open.
        provideMockStore({
          initialState: {
            session: {
              ...initialSessionState,
              user: { ...sam, role: 'agent', teamId: 'atlas' },
              checked: true,
            },
          },
        }),
        TicketConversationStore,
      ],
    });
    store = TestBed.inject(TicketConversationStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('loading', () => {
    it("loads the ticket's conversation as it starts", () => {
      expect(store.loadState()).toBe('loading');

      http.expectOne({ method: 'GET', url: API }).flush([reply, note]);

      expect(store.loadState()).toBe('loaded');
      expect(store.messages()).toEqual([reply, note]);
    });

    it('says when it fails, and loads again on request', () => {
      http
        .expectOne(API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.loadState()).toBe('failed');
      expect(store.messages()).toEqual([]);

      store.load();
      expect(store.loadState()).toBe('loading');
      http.expectOne(API).flush([reply]);

      expect(store.messages()).toEqual([reply]);
    });
  });

  describe('sending', () => {
    beforeEach(() => http.expectOne(API).flush([reply]));

    it('posts the message and adds it at the end', () => {
      store.send({ kind: 'note', body: 'Checked the logs.' });
      expect(store.sendState()).toBe('sending');

      const request = http.expectOne({ method: 'POST', url: API });
      expect(request.request.body).toEqual({
        kind: 'note',
        body: 'Checked the logs.',
      });
      request.flush(note);

      expect(store.sendState()).toBe('sent');
      expect(store.messages()).toEqual([reply, note]);
    });

    it("passes on the API's reason for refusing", () => {
      store.send({ kind: 'reply', body: 'One more thing.' });
      http
        .expectOne({ method: 'POST', url: API })
        .flush(
          { message: "A closed ticket can't change." },
          { status: 409, statusText: 'Conflict' }
        );

      expect(store.sendState()).toBe('failed');
      expect(store.sendError()).toBe("A closed ticket can't change.");
      expect(store.messages()).toEqual([reply]);
    });

    it('falls back to a general message when the API gives no reason', () => {
      store.send({ kind: 'reply', body: 'Hello.' });
      http
        .expectOne({ method: 'POST', url: API })
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.sendError()).toBe(SEND_FAILED_MESSAGE);
    });

    it('sends once on a double-click', () => {
      store.send({ kind: 'note', body: 'Checked the logs.' });
      store.send({ kind: 'note', body: 'Checked the logs.' });

      http.expectOne({ method: 'POST', url: API }).flush(note);

      expect(store.messages()).toEqual([reply, note]);
    });

    it('clears the last error when sending again', () => {
      store.send({ kind: 'reply', body: 'Hello.' });
      http
        .expectOne({ method: 'POST', url: API })
        .flush(null, { status: 500, statusText: 'Server Error' });

      store.send({ kind: 'reply', body: 'Hello.' });

      expect(store.sendState()).toBe('sending');
      expect(store.sendError()).toBeNull();
      http.expectOne({ method: 'POST', url: API }).flush(reply);
    });
  });

  describe('live updates', () => {
    /** The store with the conversation loaded, as the popup has it. */
    const loaded = () =>
      http.expectOne({ method: 'GET', url: API }).flush([reply]);

    const messageOn = (ticketId: string): LiveUpdate => ({
      kind: 'event',
      event: { type: 'message', ticketId },
    });

    it('fetches the conversation again, quietly, when someone writes on this ticket', () => {
      loaded();

      live.next(messageOn(ticket.id));

      expect(store.loadState()).toBe('loaded');
      http.expectOne({ method: 'GET', url: API }).flush([reply, note]);
      expect(store.messages()).toEqual([reply, note]);
    });

    it('never shows its own message twice when the event for it arrives', () => {
      loaded();
      store.send({ kind: 'note', body: note.body });
      http.expectOne({ method: 'POST', url: API }).flush(note);

      live.next(messageOn(ticket.id));
      http.expectOne({ method: 'GET', url: API }).flush([reply, note]);

      expect(store.messages()).toEqual([reply, note]);
    });

    it('fetches it again when the stream comes back after a break', () => {
      loaded();

      live.next({ kind: 'reconnected' });

      http.expectOne({ method: 'GET', url: API }).flush([reply]);
      // The ticket's details too (see "the ticket's details").
      http.expectOne(TICKET_API).flush(ticket);
    });

    it('leaves it alone for another ticket, or a ticket change', () => {
      loaded();

      live.next(messageOn('ticket-2002'));
      live.next({
        kind: 'event',
        event: { type: 'ticket', ticketId: ticket.id },
      });

      http.expectNone(API);
      // A ticket change reads the ticket, not its conversation.
      http.expectOne(TICKET_API).flush(ticket);
    });

    it('keeps what is shown when fetching it again fails', () => {
      loaded();

      live.next(messageOn(ticket.id));
      http
        .expectOne(API)
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(store.loadState()).toBe('loaded');
      expect(store.messages()).toEqual([reply]);
    });

    describe('the arrival sound', () => {
      /** A note from Chris, Sam's supervisor. */
      const fromChris: TicketMessage = {
        id: 'message-3',
        kind: 'note',
        body: 'Please call them back today.',
        author: { id: 'chris.taylor', name: 'Chris Taylor' },
        createdAt: '2026-10-04T11:00:00.000Z',
      };

      it('dings when someone else writes on the ticket', () => {
        loaded();

        live.next(messageOn(ticket.id));
        http.expectOne(API).flush([reply, fromChris]);

        expect(sounds.play).toHaveBeenCalledExactlyOnceWith('arrival');
      });

      it("is quiet for Sam's own message, even if its event comes first", () => {
        loaded();

        store.send({ kind: 'note', body: note.body });
        // The event for Sam's note arrives before his send finishes.
        live.next(messageOn(ticket.id));
        http.expectOne({ method: 'GET', url: API }).flush([reply, note]);
        http.expectOne({ method: 'POST', url: API }).flush(note);

        expect(sounds.play).not.toHaveBeenCalled();
      });

      it('is quiet when nothing new was written', () => {
        loaded();

        live.next({ kind: 'reconnected' });
        http.expectOne(API).flush([reply]);
        http.expectOne(TICKET_API).flush(ticket);

        expect(sounds.play).not.toHaveBeenCalled();
      });
    });

    describe("the ticket's details", () => {
      const changeOn = (ticketId: string): LiveUpdate => ({
        kind: 'event',
        event: { type: 'ticket', ticketId },
      });
      /** The ticket after Chris resolved it. */
      const resolved: TicketDto = { ...ticket, status: 'resolved' };

      it('starts as the ticket the popup opened, Sam working on it', () => {
        loaded();

        expect(store.ticket()).toBe(ticket);
        expect(store.access()).toBe('yours');
      });

      it('reads the ticket again when it changes, and swaps it in quietly', () => {
        loaded();

        live.next(changeOn(ticket.id));
        http.expectOne({ method: 'GET', url: TICKET_API }).flush(resolved);

        expect(store.ticket()).toEqual(resolved);
        expect(store.access()).toBe('yours');
        // The conversation is left as it is.
        http.expectNone(API);
        expect(store.loadState()).toBe('loaded');
        expect(store.messages()).toEqual([reply]);
      });

      it('reads it again when the stream comes back after a break', () => {
        loaded();

        live.next({ kind: 'reconnected' });
        http.expectOne(API).flush([reply]);
        http.expectOne(TICKET_API).flush(resolved);

        expect(store.ticket()).toEqual(resolved);
      });

      it('leaves it alone for a change to another ticket, or a message', () => {
        loaded();

        live.next(changeOn('ticket-2002'));
        live.next({
          kind: 'event',
          event: { type: 'message', ticketId: ticket.id },
        });
        http.expectOne(API).flush([reply]);

        http.expectNone(TICKET_API);
        expect(store.ticket()).toBe(ticket);
      });

      it("marks it no longer Sam's on a 404, keeping the details shown", () => {
        loaded();

        live.next(changeOn(ticket.id));
        http
          .expectOne(TICKET_API)
          .flush(
            { message: 'No such ticket among yours.' },
            { status: 404, statusText: 'Not Found' }
          );

        expect(store.access()).toBe('gone');
        expect(store.ticket()).toBe(ticket);
      });

      it('keeps everything as it was when reading it fails another way', () => {
        loaded();

        live.next(changeOn(ticket.id));
        http
          .expectOne(TICKET_API)
          .flush(null, { status: 500, statusText: 'Server Error' });

        expect(store.access()).toBe('yours');
        expect(store.ticket()).toBe(ticket);
      });

      it("is Sam's again when a later read finds it his (given back)", () => {
        loaded();
        live.next(changeOn(ticket.id));
        http
          .expectOne(TICKET_API)
          .flush(null, { status: 404, statusText: 'Not Found' });

        live.next(changeOn(ticket.id));
        http.expectOne(TICKET_API).flush(ticket);

        expect(store.access()).toBe('yours');
      });
    });
  });
});
