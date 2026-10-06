import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../database/database-token';
import { tickets, users } from '../database/schema';
import type { LiveAudience } from './live-events';

/**
 * Who a change to a ticket concerns, read after the change: whoever holds
 * it now, `formerHolderId` when it held it before (a reassignment), their
 * teams, and whether it was or is unassigned work.
 */
export async function ticketAudience(
  database: Pick<Database, 'select'>,
  ticketId: string,
  {
    formerHolderId = null,
    wasUnassigned = false,
  }: { formerHolderId?: string | null; wasUnassigned?: boolean } = {}
): Promise<LiveAudience> {
  const [ticket] = await database
    .select({ assigneeId: tickets.assigneeId })
    .from(tickets)
    .where(eq(tickets.id, ticketId));
  const holderIds = [
    ...new Set(
      [ticket?.assigneeId ?? null, formerHolderId].filter(
        (id): id is string => id !== null
      )
    ),
  ];
  const teams =
    holderIds.length === 0
      ? []
      : await database
          .select({ teamId: users.teamId })
          .from(users)
          .where(inArray(users.id, holderIds));
  return {
    kind: 'ticket',
    holderIds,
    teamIds: [
      ...new Set(
        teams
          .map(({ teamId }) => teamId)
          .filter((id): id is string => id !== null)
      ),
    ],
    unassigned: wasUnassigned || (ticket?.assigneeId ?? null) === null,
  };
}
