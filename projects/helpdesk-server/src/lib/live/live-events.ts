import type { CurrentUser, LiveEvent } from '@helpdesk/contract';
import { Injectable } from '@nestjs/common';
import { filter, map, type Observable, Subject } from 'rxjs';

/**
 * Who an event concerns. For a ticket or its conversation: who held it
 * before and after the change, their teams, and whether it was or became
 * unassigned (work anyone may take). For accounts: the people who manage
 * them. It stays on the server: the browser only gets the event.
 */
export type LiveAudience =
  | {
      kind: 'ticket';
      /** Its assignee before and after the change; none while unassigned. */
      holderIds: string[];
      /** Those holders' teams. */
      teamIds: string[];
      /** Whether it was unassigned before the change, or is after it. */
      unassigned: boolean;
    }
  | { kind: 'accounts' };

/** An event and who it concerns, as the services publish it. */
export interface LiveNotice {
  event: LiveEvent;
  audience: LiveAudience;
}

/**
 * Whether an event concerns this person, by the same rules the pages'
 * REST endpoints follow. Agents: unassigned work, and tickets they held
 * or now hold. Supervisors: unassigned work, and their team's tickets.
 * Admins and supervisors: account changes (a supervisor's team may have
 * changed). Admins see no tickets, so hear of none.
 */
export function concerns(audience: LiveAudience, user: CurrentUser): boolean {
  if (audience.kind === 'accounts') {
    return user.role === 'admin' || user.role === 'supervisor';
  }
  switch (user.role) {
    case 'agent':
      return audience.unassigned || audience.holderIds.includes(user.id);
    case 'supervisor':
      return (
        audience.unassigned ||
        (user.teamId !== null && audience.teamIds.includes(user.teamId))
      );
    default:
      return false;
  }
}

/**
 * The help desk's live events (#950): the services publish to it after a
 * write; GET /api/events gives each signed-in person the events that
 * concern them. It lives in this process's memory, which is enough for
 * one API process (how the help desk runs, locally and in Docker). With
 * several, the notices would have to go through the database instead
 * (PostgreSQL's LISTEN/NOTIFY), so every process hears every write.
 */
@Injectable()
export class LiveEvents {
  private readonly notices = new Subject<LiveNotice>();

  /** Tells everyone it concerns that something changed. */
  publish(notice: LiveNotice): void {
    this.notices.next(notice);
  }

  /** The events that concern this person, from now on. */
  for(user: CurrentUser): Observable<LiveEvent> {
    return this.notices.pipe(
      filter(({ audience }) => concerns(audience, user)),
      map(({ event }) => event)
    );
  }
}
