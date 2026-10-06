/**
 * Live updates (#950): GET /api/events is a stream of server-sent events
 * telling an open page that something it may show has changed, so it
 * loads again through the normal API (which does its own checks). An
 * event names what changed and nothing more: no ticket data travels on
 * the stream. Each signed-in person hears only what concerns them.
 */
export const LIVE_EVENTS_API = '/api/events';

/** A ticket was taken, assigned, released or moved to another status. */
export interface TicketChangedEvent {
  type: 'ticket';
  ticketId: string;
}

/** A reply or an internal note was added to a ticket's conversation. */
export interface MessageAddedEvent {
  type: 'message';
  ticketId: string;
}

/** An account was created or changed (role, team, active). */
export interface AccountsChangedEvent {
  type: 'accounts';
}

export type LiveEvent =
  TicketChangedEvent | MessageAddedEvent | AccountsChangedEvent;

/** Whether a value read off the stream is a live event this app knows. */
export function isLiveEvent(value: unknown): value is LiveEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { type, ticketId } = value as Record<string, unknown>;
  if (type === 'accounts') {
    return true;
  }
  return (
    (type === 'ticket' || type === 'message') && typeof ticketId === 'string'
  );
}
