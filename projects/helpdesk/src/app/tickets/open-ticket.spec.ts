import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import type { TicketDto } from '@helpdesk/contract';
import { openTicket } from './open-ticket';
import { TicketConversationDialog } from './ticket-conversation.dialog';

/** A ticket with the parts these tests look at. */
const ticket = (id: string) => ({ id }) as TicketDto;

describe('openTicket', () => {
  /** The popups open now, by their dialog ID. */
  let opened: string[];
  const dialog = {
    open: vi.fn((_: unknown, config: MatDialogConfig) => {
      opened.push(String(config.id));
    }),
    getDialogById: (id: string) => (opened.includes(id) ? {} : undefined),
  };
  let injector: Injector;

  beforeEach(() => {
    opened = [];
    dialog.open.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialog, useValue: dialog }],
    });
    injector = TestBed.inject(Injector);
  });

  it('opens the popup with the ticket, sized for the screen', async () => {
    await openTicket(injector, ticket('ticket-1'));

    expect(dialog.open).toHaveBeenCalledExactlyOnceWith(
      TicketConversationDialog,
      expect.objectContaining({
        data: { ticket: ticket('ticket-1') },
        width: '44rem',
        maxWidth: 'calc(100vw - 2rem)',
      })
    );
  });

  // The first time, the popup's code is still on its way when a second
  // click (or Enter) comes, with no backdrop yet to stop it.
  it('opens one popup when a ticket is opened twice at once', async () => {
    await Promise.all([
      openTicket(injector, ticket('ticket-1')),
      openTicket(injector, ticket('ticket-1')),
    ]);

    expect(dialog.open).toHaveBeenCalledOnce();
  });

  it("opens another ticket's popup", async () => {
    await openTicket(injector, ticket('ticket-1'));
    await openTicket(injector, ticket('ticket-2'));

    expect(dialog.open).toHaveBeenCalledTimes(2);
  });
});
