import {
  type CreateRequestRequest,
  type CreateRequestResponse,
  type CurrentUser,
  type DismissRequestRequest,
  type EarlierRequest,
  formatRequestReference,
  OPEN_WORK_STATUSES,
  parseRequestReference,
  type PendingRequest,
  type QueueSummary,
  type RequestCategory,
  type RequestStatusResponse,
  type TicketDto,
  type TurnIntoTicketRequest,
} from '@helpdesk/contract';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import {
  AttachmentsService,
  type PreparedFile,
} from '../attachments/attachments.service';
import { DATABASE, type Database } from '../database/database-token';
import { customers, queues, requests, tickets } from '../database/schema';
import { SLA_MINUTES } from '../database/seed/generate';
import { LiveHub } from '../live/live-hub';
import { ticketAudience } from '../live/ticket-audience';
import { type Transaction, UUID } from '../tickets/ticket-access';
import {
  MOST_URGENT_FIRST,
  selectTickets,
  toTicketDto,
} from '../tickets/ticket-dto';

/**
 * The queue each category goes to, by the seed's queue ids; `null` for
 * Other, which suggests none. Queues are data, so this lives here rather
 * than in the contract, and a suggestion is kept only if its queue exists.
 */
export const SUGGESTED_QUEUE: Readonly<Record<RequestCategory, string | null>> =
  {
    account: 'accounts',
    billing: 'billing',
    bug: 'technical',
    feature: 'product',
    other: null,
  };

/** The answer for a request that is not there, or not one. */
export const NO_SUCH_REQUEST = 'No such request.';

/**
 * The answer when a reference and an email do not belong together, the
 * same as for no such reference (the API's and the demo's).
 */
export const NO_MATCHING_REQUEST =
  'No request matches that reference and email.';

/** The answer for deciding a request someone has decided already. */
export const ALREADY_DECIDED = 'Someone has decided this request already.';

/**
 * Customer requests (#1026): what customers send through the public form,
 * what they can check on with its reference and their email, and what a
 * supervisor decides: a ticket, or a dismissal with why. A request is
 * never deleted. A new ticket is told to the pages of unassigned work
 * (`live`, #950; none in the in-browser demo).
 */
@Injectable()
export class CustomerRequestsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(AttachmentsService)
    private readonly attachments: AttachmentsService,
    // Named, as an optional parameter's recorded type is only `Object`.
    @Optional() @Inject(LiveHub) private readonly live?: LiveHub
  ) {}

  /** Tells every supervisor's New requests to load again. */
  private requestsChanged(): void {
    this.live?.publish({
      event: { type: 'requests' },
      audience: { kind: 'requests' },
    });
  }

  /**
   * Keeps a request, pending, with the files sent with it, and answers with
   * its reference: the request and its files together, or neither. The
   * customer agreed to what is kept as they sent it, at `now`. Its fields
   * are already read and checked (`readCustomerRequest`), and its files
   * (`AttachmentsService.prepare`); spam checks are the API's.
   */
  async send(
    request: CreateRequestRequest,
    now = new Date(),
    files: readonly PreparedFile[] = []
  ): Promise<CreateRequestResponse> {
    const row = await this.database.transaction(async (tx) => {
      const [kept] = await tx
        .insert(requests)
        .values({
          name: request.name,
          email: request.email,
          category: request.category,
          impact: request.impact,
          subject: request.subject,
          description: request.description,
          where: request.where,
          consentedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: requests.id, requestNumber: requests.requestNumber });
      await this.attachments.store(tx, kept.id, files, now);
      return kept;
    });
    this.requestsChanged();
    return { reference: formatRequestReference(row.requestNumber) };
  }

  /**
   * Where a request is up to, for the customer who sent it: its reference
   * as they type it, and the email they sent it with (any case). `null`
   * for a wrong email, as for no such reference, so references can't be
   * tried one by one to learn who sent what.
   */
  async statusOf(
    reference: string,
    email: string
  ): Promise<RequestStatusResponse | null> {
    const requestNumber = parseRequestReference(reference);
    if (requestNumber === null) {
      return null;
    }
    const [row] = await this.database
      .select({
        email: requests.email,
        status: requests.status,
        dismissReason: requests.dismissReason,
        ticketNumber: tickets.ticketNumber,
        ticketStatus: tickets.status,
      })
      .from(requests)
      .leftJoin(tickets, eq(requests.ticketId, tickets.id))
      .where(eq(requests.requestNumber, requestNumber));
    if (row === undefined || row.email !== email.trim().toLowerCase()) {
      return null;
    }
    const answer = { reference: formatRequestReference(requestNumber) };
    if (
      row.status === 'ticket' &&
      row.ticketNumber !== null &&
      row.ticketStatus !== null
    ) {
      return {
        ...answer,
        status: 'ticket',
        ticketNumber: row.ticketNumber,
        ticketStatus: row.ticketStatus,
      };
    }
    if (row.status === 'dismissed' && row.dismissReason !== null) {
      return { ...answer, status: 'dismissed', reason: row.dismissReason };
    }
    return { ...answer, status: 'pending' };
  }

  /**
   * Every request still waiting, oldest first, each with its files, the
   * queue its category suggests (if that queue exists) and what might make it a
   * duplicate: the same customer's open tickets (most urgent first) and
   * their other requests (newest first), matched by email.
   */
  async pending(): Promise<PendingRequest[]> {
    const [waiting, queueRows] = await Promise.all([
      this.database
        .select()
        .from(requests)
        .where(eq(requests.status, 'pending'))
        .orderBy(asc(requests.createdAt), asc(requests.requestNumber)),
      this.database.select({ id: queues.id }).from(queues),
    ]);
    const queueIds = new Set(queueRows.map(({ id }) => id));
    const files = await this.attachments.listFor(waiting.map(({ id }) => id));
    const suggestedQueueFor = (category: RequestCategory) => {
      const queueId = SUGGESTED_QUEUE[category];
      return queueId !== null && queueIds.has(queueId) ? queueId : null;
    };
    return Promise.all(
      waiting.map(async (request) => {
        const [openTickets, earlierRequests] = await Promise.all([
          this.openTicketsOf(request.email),
          this.otherRequestsOf(request.email, request.id),
        ]);
        return {
          id: request.id,
          reference: formatRequestReference(request.requestNumber),
          name: request.name,
          email: request.email,
          category: request.category,
          impact: request.impact,
          subject: request.subject,
          description: request.description,
          where: request.where,
          createdAt: request.createdAt.toISOString(),
          suggestedQueueId: suggestedQueueFor(request.category),
          attachments: files.get(request.id) ?? [],
          possibleDuplicates: { openTickets, earlierRequests },
        };
      })
    );
  }

  /**
   * Makes a ticket of a pending request, as a supervisor confirms it: in
   * the queue and at the priority given, `new` and Unassigned, its subject
   * and description the request's, due as its priority's SLA says from
   * `now`, for the customer with the request's email (made one, with the
   * name they gave, if new). The request records the ticket, who decided
   * and when. All in one transaction with the request locked, so two
   * supervisors cannot both decide it: the second gets 409. 404 for no
   * such request; 400 for a queue that does not exist.
   */
  async turnIntoTicket(
    requestId: string,
    { queueId, priority }: TurnIntoTicketRequest,
    by: CurrentUser,
    now = new Date()
  ): Promise<TicketDto> {
    const ticketId = await this.database.transaction(async (tx) => {
      const request = await lockPending(tx, requestId);
      const [queue] = await tx
        .select({ id: queues.id })
        .from(queues)
        .where(eq(queues.id, queueId));
      if (queue === undefined) {
        throw new BadRequestException('Choose a queue that exists.');
      }
      const requesterId = await customerFor(tx, request.name, request.email);
      const [ticket] = await tx
        .insert(tickets)
        .values({
          subject: request.subject,
          description: request.description,
          priority,
          requesterId,
          queueId,
          slaDueAt: new Date(now.getTime() + SLA_MINUTES[priority] * 60_000),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: tickets.id });
      await tx
        .update(requests)
        .set({
          status: 'ticket',
          ticketId: ticket.id,
          decidedById: by.id,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(requests.id, requestId));
      return ticket.id;
    });
    if (this.live) {
      this.live.publish({
        event: { type: 'ticket', ticketId },
        audience: await ticketAudience(this.database, ticketId),
      });
    }
    this.requestsChanged();
    const [row] = await selectTickets(this.database).where(
      eq(tickets.id, ticketId)
    );
    return toTicketDto(row);
  }

  /**
   * Dismisses a pending request with why, as a supervisor decides; for a
   * duplicate, linked to the ticket it repeats (400 if there is no such
   * ticket). Kept, with who decided and when. 409 if someone decided it
   * first; 404 for no such request.
   */
  async dismiss(
    requestId: string,
    { reason, duplicateOfTicketNumber }: DismissRequestRequest,
    by: CurrentUser,
    now = new Date()
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      await lockPending(tx, requestId);
      let duplicateOfTicketId: string | null = null;
      if (duplicateOfTicketNumber !== null) {
        const [ticket] = await tx
          .select({ id: tickets.id })
          .from(tickets)
          .where(eq(tickets.ticketNumber, duplicateOfTicketNumber));
        if (ticket === undefined) {
          throw new BadRequestException(
            `There is no ticket #${duplicateOfTicketNumber}.`
          );
        }
        duplicateOfTicketId = ticket.id;
      }
      await tx
        .update(requests)
        .set({
          status: 'dismissed',
          dismissReason: reason,
          duplicateOfTicketId,
          decidedById: by.id,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(requests.id, requestId));
    });
    this.requestsChanged();
  }

  /** Every queue, by name: Turn into ticket's choices. */
  queues(): Promise<QueueSummary[]> {
    return this.database
      .select({ id: queues.id, name: queues.name })
      .from(queues)
      .orderBy(asc(queues.name));
  }

  /** The open tickets of the customer with this email, most urgent first. */
  private async openTicketsOf(email: string): Promise<TicketDto[]> {
    const rows = await selectTickets(this.database)
      .where(
        and(
          eq(customers.email, email),
          inArray(tickets.status, [...OPEN_WORK_STATUSES])
        )
      )
      .orderBy(...MOST_URGENT_FIRST);
    return rows.map(toTicketDto);
  }

  /** The other requests sent with this email, newest first. */
  private async otherRequestsOf(
    email: string,
    exceptId: string
  ): Promise<EarlierRequest[]> {
    const rows = await this.database
      .select({
        id: requests.id,
        requestNumber: requests.requestNumber,
        subject: requests.subject,
        status: requests.status,
        createdAt: requests.createdAt,
      })
      .from(requests)
      .where(and(eq(requests.email, email), ne(requests.id, exceptId)))
      .orderBy(desc(requests.createdAt));
    return rows.map(({ requestNumber, createdAt, ...rest }) => ({
      ...rest,
      reference: formatRequestReference(requestNumber),
      createdAt: createdAt.toISOString(),
    }));
  }
}

/**
 * Locks a request for the rest of the transaction and answers with what a
 * decision needs from it, if it is still pending: 404 for no such request
 * (an id that is not a UUID included), 409 for one already decided.
 */
async function lockPending(tx: Transaction, requestId: string) {
  if (!UUID.test(requestId)) {
    throw new NotFoundException(NO_SUCH_REQUEST);
  }
  const [request] = await tx
    .select({
      status: requests.status,
      name: requests.name,
      email: requests.email,
      subject: requests.subject,
      description: requests.description,
    })
    .from(requests)
    .where(eq(requests.id, requestId))
    .for('update');
  if (request === undefined) {
    throw new NotFoundException(NO_SUCH_REQUEST);
  }
  if (request.status !== 'pending') {
    throw new ConflictException(ALREADY_DECIDED);
  }
  return request;
}

/**
 * The customer with this email, made one with this name if there is none.
 * An existing customer keeps the name they had.
 */
async function customerFor(
  tx: Transaction,
  name: string,
  email: string
): Promise<string> {
  const [created] = await tx
    .insert(customers)
    .values({ name, email })
    .onConflictDoNothing({ target: customers.email })
    .returning({ id: customers.id });
  if (created !== undefined) {
    return created.id;
  }
  const [existing] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, email));
  return existing.id;
}
