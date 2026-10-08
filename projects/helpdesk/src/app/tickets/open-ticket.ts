import type { Injector } from '@angular/core';
import type { TicketDto } from '@helpdesk/contract';
import type { TicketConversationData } from './ticket-conversation.store';

/**
 * Opens a ticket's popup: its details and conversation. The popup's code
 * is loaded on the first click (dynamic `import()`), not with the page.
 * One popup per ticket: a second click while its code is still on its way
 * (no backdrop yet to stop it) finds the first open and leaves it.
 */
export async function openTicket(
  injector: Injector,
  ticket: TicketDto
): Promise<void> {
  const [{ MatDialog }, { TicketConversationDialog }] = await Promise.all([
    import('@angular/material/dialog'),
    import('./ticket-conversation.dialog'),
  ]);
  const dialog = injector.get(MatDialog);
  const id = `ticket-${ticket.id}`;
  if (dialog.getDialogById(id)) {
    return;
  }
  const data: TicketConversationData = { ticket };
  dialog.open(TicketConversationDialog, {
    id,
    data,
    width: '44rem',
    maxWidth: 'calc(100vw - 2rem)',
  });
}
