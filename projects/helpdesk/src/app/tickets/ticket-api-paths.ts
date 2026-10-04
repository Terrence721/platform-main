/** Where a ticket's assignee is set (assigning, reassigning, taking). */
export function assigneeApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/assignee`;
}

/** Where a ticket's status is set. */
export function statusApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/status`;
}
