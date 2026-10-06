/** Where one ticket is read, as it is now (#982). */
export function ticketApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}`;
}

/** Where a ticket's assignee is set (assigning, reassigning, taking). */
export function assigneeApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/assignee`;
}

/** Where a ticket's status is set. */
export function statusApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/status`;
}

/** Where a ticket's replies and internal notes are read and added. */
export function messagesApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/messages`;
}
