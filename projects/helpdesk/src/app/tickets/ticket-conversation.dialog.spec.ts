import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { TicketDto, TicketMessage } from '@helpdesk/contract';
import { NEVER, Subject } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { type LiveUpdate, LiveUpdates } from '../live/live-updates';
import { initialSessionState } from '../session/session.feature';
import { messagesApi, ticketApi } from './ticket-api-paths';
import { TicketConversationDialog } from './ticket-conversation.dialog';

const sam = { id: 'sam.rivera', name: 'Sam Rivera' };

const ticket: TicketDto = {
  id: 'ticket-1001',
  ticketNumber: 1001,
  subject: 'Cannot sign in after password reset',
  description: 'The reset link worked, but the new password is refused.',
  status: 'open',
  priority: 'urgent',
  requester: {
    id: 'customer-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  },
  assignee: sam,
  queue: { id: 'accounts', name: 'Accounts' },
  tags: [],
  // Far enough ahead that it is never overdue while the tests run.
  slaDueAt: '2099-01-01T00:00:00.000Z',
  createdAt: '2026-10-04T07:00:00.000Z',
  updatedAt: '2026-10-04T08:00:00.000Z',
};

const API = messagesApi(ticket.id);

const reply: TicketMessage = {
  id: 'message-1',
  kind: 'reply',
  body: 'Which browser are you using?',
  author: sam,
  createdAt: '2026-10-04T08:00:00.000Z',
};

const note: TicketMessage = {
  id: 'message-2',
  kind: 'note',
  body: 'Checked the auth logs.',
  author: sam,
  createdAt: '2026-10-04T09:00:00.000Z',
};

describe('TicketConversationDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /** Opens the popup for `shown`, answering its load with `messages`. */
  function render(shown: TicketDto = ticket, messages = [reply, note]) {
    /** The live updates the popup hears, sent by the test. */
    const live = new Subject<LiveUpdate>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { ticket: shown } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        // The store's spec covers what each update does; here, only what
        // the popup shows for one.
        { provide: LiveUpdates, useValue: { updates: live } },
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
      ],
    });
    const fixture = TestBed.createComponent(TicketConversationDialog);
    fixture.detectChanges();
    const dialog = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne({ method: 'GET', url: messagesApi(shown.id) })
      .flush(messages);
    fixture.detectChanges();

    const text = (selector: string) =>
      dialog.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    /** A button by its text. */
    const button = (label: string) =>
      [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
        (candidate) => candidate.textContent?.trim() === label
      );
    return {
      dialog,
      http,
      live,
      text,
      button,
      /** Types into the message box, as a person would. */
      type: (value: string) => {
        const box = dialog.querySelector('textarea');
        if (!box) {
          throw new Error('No message box');
        }
        box.value = value;
        box.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      },
      box: () => dialog.querySelector('textarea'),
      detectChanges: () => fixture.detectChanges(),
    };
  }

  it("is titled with the ticket's number and subject", () => {
    const { text } = render();

    expect(text('h2')).toBe('#1001 Cannot sign in after password reset');
  });

  it("shows the ticket's details", () => {
    const { dialog } = render();

    expect(
      [...dialog.querySelectorAll('.details > div')].map((detail) => [
        detail.querySelector('dt')?.textContent?.trim(),
        detail.querySelector('dd')?.textContent?.trim(),
      ])
    ).toEqual([
      ['Customer', 'Ada Lovelace · ada@example.com'],
      ['Status', 'Open'],
      ['Priority', 'urgent'],
      ['Assigned to', 'Sam Rivera'],
      ['Due', expect.stringMatching(/^Due in /)],
    ]);
  });

  it("starts the conversation with the customer's description, then each message in order", () => {
    const { dialog } = render();
    const items = [...dialog.querySelectorAll('.conversation li')];

    expect(items.map((item) => item.className)).toEqual([
      'customer',
      'reply',
      'note',
    ]);
    expect(
      items.map((item) => item.querySelector('.body')?.textContent?.trim())
    ).toEqual([ticket.description, reply.body, note.body]);
  });

  it('says who wrote each message, and who a reply went to', () => {
    const { dialog } = render();
    const meta = [...dialog.querySelectorAll('.conversation .meta')].map(
      (line) => line.textContent?.replace(/\s+/g, ' ').trim()
    );

    expect(meta[0]).toMatch(/^Ada Lovelace · customer · /);
    expect(meta[1]).toMatch(/^Sam Rivera · Reply to Ada Lovelace · /);
    expect(meta[2]).toMatch(/^Sam Rivera · Internal note · /);
  });

  it('keeps both buttons off until something is written', () => {
    const { button, type, text } = render();

    expect(button('Reply')?.disabled).toBe(true);
    expect(button('Internal note')?.disabled).toBe(true);

    type('   ');
    expect(button('Reply')?.disabled).toBe(true);

    type('Fixed now.');
    expect(button('Reply')?.disabled).toBe(false);
    expect(button('Internal note')?.disabled).toBe(false);
    expect(text('mat-hint')).toBe('10 / 5000');
  });

  it.each([
    ['Reply', 'reply'],
    ['Internal note', 'note'],
  ] as const)(
    'sends the trimmed text as a %s, adds it, and empties the box',
    (label, kind) => {
      const { button, type, http, dialog, box, detectChanges } = render();
      type('  Fixed now.\n');

      button(label)?.click();
      detectChanges();
      const request = http.expectOne({ method: 'POST', url: API });
      expect(request.request.body).toEqual({ kind, body: 'Fixed now.' });
      request.flush({ ...reply, id: 'message-3', kind, body: 'Fixed now.' });
      detectChanges();

      expect(dialog.querySelectorAll('.conversation li')).toHaveLength(4);
      expect(box()?.value).toBe('');
    }
  );

  it('shows why a message was refused, keeping what was written', () => {
    const { button, type, http, text, box, detectChanges } = render();
    type('One more thing.');

    button('Reply')?.click();
    http
      .expectOne({ method: 'POST', url: API })
      .flush(
        { message: "A closed ticket can't change." },
        { status: 409, statusText: 'Conflict' }
      );
    detectChanges();

    expect(text('.error')).toBe("A closed ticket can't change.");
    expect(box()?.value).toBe('One more thing.');
  });

  it('shows a closed ticket without a box to write in', () => {
    const { text, box, button } = render({ ...ticket, status: 'closed' });

    expect(text('.message')).toBe(
      'This ticket is closed, so nothing more can be added.'
    );
    expect(box()).toBeNull();
    expect(button('Reply')).toBeUndefined();
  });

  describe('while open, as the ticket changes elsewhere (#982)', () => {
    /** Someone changes the ticket; the popup reads it again. */
    function changed(
      { live, http, detectChanges }: ReturnType<typeof render>,
      answer: (request: ReturnType<typeof http.expectOne>) => void
    ) {
      live.next({
        kind: 'event',
        event: { type: 'ticket', ticketId: ticket.id },
      });
      answer(http.expectOne({ method: 'GET', url: ticketApi(ticket.id) }));
      detectChanges();
    }
    const detail = (dialog: HTMLElement, term: string) =>
      [...dialog.querySelectorAll('.details > div')]
        .find((item) => item.querySelector('dt')?.textContent?.trim() === term)
        ?.querySelector('dd')
        ?.textContent?.trim();

    it('updates the details in place', () => {
      const popup = render();

      changed(popup, (request) =>
        request.flush({
          ...ticket,
          status: 'resolved',
          assignee: { id: 'benny.lind', name: 'Benny Lind' },
        })
      );

      expect(detail(popup.dialog, 'Status')).toBe('Resolved');
      expect(detail(popup.dialog, 'Assigned to')).toBe('Benny Lind');
      expect(detail(popup.dialog, 'Due')).toBe('Finished');
      // Still Sam's to work on: the box stays.
      expect(popup.box()).not.toBeNull();
    });

    it('takes the box away once the ticket is closed', () => {
      const popup = render();

      changed(popup, (request) =>
        request.flush({ ...ticket, status: 'closed' })
      );

      expect(detail(popup.dialog, 'Status')).toBe('Closed');
      expect(popup.box()).toBeNull();
      expect(popup.text('.message')).toBe(
        'This ticket is closed, so nothing more can be added.'
      );
    });

    it('says so, in place of the box, once the ticket is no longer theirs', () => {
      const popup = render();

      changed(popup, (request) =>
        request.flush(
          { message: 'No such ticket among yours.' },
          { status: 404, statusText: 'Not Found' }
        )
      );

      expect(popup.box()).toBeNull();
      expect(popup.button('Reply')).toBeUndefined();
      expect(popup.text('.message')).toBe(
        'This ticket is no longer assigned to you.'
      );
      // What was shown stays, to read.
      expect(detail(popup.dialog, 'Assigned to')).toBe('Sam Rivera');
      expect(popup.dialog.querySelectorAll('.conversation li')).toHaveLength(3);
    });
  });

  it('says when the conversation could not be loaded, and tries again', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { ticket } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        // Live updates are the store's spec's concern: none here.
        { provide: LiveUpdates, useValue: { updates: NEVER } },
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
      ],
    });
    const fixture = TestBed.createComponent(TicketConversationDialog);
    fixture.detectChanges();
    const dialog = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);

    http.expectOne(API).flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    const alert = dialog.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      "The conversation couldn't be loaded."
    );

    alert?.querySelector('button')?.click();
    http.expectOne(API).flush([reply]);
    fixture.detectChanges();

    expect(dialog.querySelectorAll('.conversation li')).toHaveLength(2);
  });
});
