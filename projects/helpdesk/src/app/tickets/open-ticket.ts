import type { Injector } from '@angular/core';
import type { TicketDto } from '@helpdesk/contract';
import type { TicketConversationData } from './ticket-conversation.store';

/**
 * Opens a ticket's popup: its details and conversation. The popup's code
 * is loaded on the first click (dynamic `import()`), not with the page.
 */
export async function openTicket(
  injector: Injector,
  ticket: TicketDto
): Promise<void> {
  const [{ MatDialog }, { TicketConversationDialog }] = await Promise.all([
    import('@angular/material/dialog'),
    import('./ticket-conversation.dialog'),
  ]);
  const data: TicketConversationData = { ticket };
  injector.get(MatDialog).open(TicketConversationDialog, {
    data,
    width: '44rem',
    maxWidth: 'calc(100vw - 2rem)',
  });
}
