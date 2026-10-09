import type {
  AddTicketMessageRequest,
  CurrentUser,
  TicketMessage,
} from '@helpdesk/contract';
import {
  ConflictException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database-token';
import { ticketMessages, tickets, users } from '../database/schema';
import { LiveHub } from '../live/live-hub';
import { ticketAudience } from '../live/ticket-audience';
import { lockWorkable } from './ticket-access';

/** A message's columns, with its author's name. */
const MESSAGE_COLUMNS = {
  id: ticketMessages.id,
  kind: ticketMessages.kind,
  body: ticketMessages.body,
  createdAt: ticketMessages.createdAt,
  authorId: users.id,
  authorName: users.name,
};

/**
 * A ticket's conversation: replies to the customer and internal notes.
 * Only the agent who holds the ticket, or the supervisor who leads that
 * agent's team, may read or write it, as with changing its status. A new
 * message is told to the open pages it concerns (`live`, #950).
 */
@Injectable()
export class TicketMessagesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    // Named, as an optional parameter's recorded type is only `Object`.
    @Optional() @Inject(LiveHub) private readonly live?: LiveHub
  ) {}

  /**
   * A ticket's messages, oldest first. 404 for a ticket the user may not
   * work on: the same answer as for no ticket at all.
   */
  async conversation(
    ticketId: string,
    by: CurrentUser
  ): Promise<TicketMessage[]> {
    return this.database.transaction(async (tx) => {
      await lockWorkable(tx, ticketId, by, 'share');
      const rows = await tx
        .select(MESSAGE_COLUMNS)
        .from(ticketMessages)
        .innerJoin(users, eq(ticketMessages.authorId, users.id))
        .where(eq(ticketMessages.ticketId, ticketId))
        .orderBy(asc(ticketMessages.createdAt), asc(ticketMessages.id));
      return rows.map(toTicketMessage);
    });
  }

  /**
   * Adds a reply or an internal note, written by `by`, and marks the
   * ticket as just changed. 404 as for `conversation`; 409 for a closed
   * ticket, which is final. The request is already checked (the
   * controller's `readMessage`). Answers with the new message.
   */
  async add(
    ticketId: string,
    { kind, body }: AddTicketMessageRequest,
    by: CurrentUser
  ): Promise<TicketMessage> {
    const message = await this.database.transaction(async (tx) => {
      const status = await lockWorkable(tx, ticketId, by, 'update');
      if (status === 'closed') {
        throw new ConflictException("A closed ticket can't change.");
      }
      const [{ id }] = await tx
        .insert(ticketMessages)
        .values({ ticketId, authorId: by.id, kind, body })
        .returning({ id: ticketMessages.id });
      await tx
        .update(tickets)
        .set({ updatedAt: new Date() })
        .where(eq(tickets.id, ticketId));

      const [row] = await tx
        .select(MESSAGE_COLUMNS)
        .from(ticketMessages)
        .innerJoin(users, eq(ticketMessages.authorId, users.id))
        .where(eq(ticketMessages.id, id));
      return toTicketMessage(row);
    });
    if (this.live) {
      this.live.publish({
        event: { type: 'message', ticketId },
        audience: await ticketAudience(this.database, ticketId),
      });
    }
    return message;
  }
}

/** A row of `MESSAGE_COLUMNS`. */
interface MessageRow {
  id: string;
  kind: TicketMessage['kind'];
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
}

/** A message as the API returns it. */
function toTicketMessage(row: MessageRow): TicketMessage {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    author: { id: row.authorId, name: row.authorName },
    createdAt: row.createdAt.toISOString(),
  };
}
