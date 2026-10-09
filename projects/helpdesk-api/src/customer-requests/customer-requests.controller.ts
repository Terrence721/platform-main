// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import {
  type CreateRequestResponse,
  type CurrentUser,
  formatRequestReference,
  type PendingRequest,
  type RequestStatusResponse,
  type TicketDto,
} from '@helpdesk/contract';
import {
  CustomerRequestsService,
  NO_MATCHING_REQUEST,
  readCustomerRequest,
  readDismissal,
  readTurnIntoTicket,
} from '@helpdesk/server';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';
import {
  isLikelySpam,
  RequestLimits,
  TooManyRequestsException,
} from './request-limits';

/** The part of Express's request the limits need. */
interface VisitorRequest {
  /** The visitor's address; behind one proxy, as main.ts trusts it. */
  ip?: string;
}

/** The part of Express's response a 429 needs. */
interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

/**
 * Customer requests (/api/requests, #1026). Anyone may send one and check
 * on it, within limits per address; supervisors list the pending ones
 * and decide them.
 */
@Controller('requests')
export class CustomerRequestsController {
  constructor(
    private readonly requests: CustomerRequestsService,
    private readonly limits: RequestLimits
  ) {}

  /**
   * Keeps a request from the public form: 201 with its reference only;
   * 400 for a field that is wrong. One that looks sent by a program (the
   * hidden field filled in, or sent faster than a person could) gets a
   * made-up reference and is not kept, so a bot cannot tell. At most
   * MAX_SENDS an hour from one address: then 429, with Retry-After.
   */
  @Post()
  async send(
    @Body() body: unknown,
    @Req() request: VisitorRequest,
    @Res({ passthrough: true }) response: HeaderResponse
  ): Promise<CreateRequestResponse> {
    withRetryAfter(response, () => this.limits.send(addressOf(request)));
    const sent = readCustomerRequest(body);
    if (isLikelySpam(sent)) {
      return { reference: formatRequestReference(randomInt(1001, 1_000_000)) };
    }
    return this.requests.send(sent);
  }

  /**
   * Where a request is up to, for whoever has its reference and the email
   * it was sent with: 404 when they do not belong together, as for no
   * such request. At most MAX_STATUS_CHECKS per 10 minutes from one
   * address: then 429, with Retry-After.
   */
  @Get('status')
  async status(
    @Query('reference') reference: string | undefined,
    @Query('email') email: string | undefined,
    @Req() request: VisitorRequest,
    @Res({ passthrough: true }) response: HeaderResponse
  ): Promise<RequestStatusResponse> {
    withRetryAfter(response, () => this.limits.statusCheck(addressOf(request)));
    const answer =
      typeof reference === 'string' && typeof email === 'string'
        ? await this.requests.statusOf(reference, email)
        : null;
    if (answer === null) {
      throw new NotFoundException(NO_MATCHING_REQUEST);
    }
    return answer;
  }

  /**
   * The pending requests, oldest first, with possible duplicates: New
   * requests. Only supervisors, who decide them: other roles get 403,
   * signed out 401.
   */
  @Get()
  @OnlyFor('supervisor')
  pending(): Promise<PendingRequest[]> {
    return this.requests.pending();
  }

  /**
   * Turns a pending request into a ticket: 201 with the new ticket; 400
   * for a wrong body or a queue that does not exist; 404 for no such
   * request; 409 if someone decided it first. Only supervisors.
   */
  @Post(':requestId/ticket')
  @OnlyFor('supervisor')
  turnIntoTicket(
    @SignedInUser() supervisor: CurrentUser,
    @Param('requestId') requestId: string,
    @Body() body: unknown
  ): Promise<TicketDto> {
    return this.requests.turnIntoTicket(
      requestId,
      readTurnIntoTicket(body),
      supervisor
    );
  }

  /**
   * Dismisses a pending request, with why: 204; 400 for a wrong body or a
   * duplicate of no ticket; 404 for no such request; 409 if someone
   * decided it first. Only supervisors.
   */
  @Post(':requestId/dismiss')
  @HttpCode(204)
  @OnlyFor('supervisor')
  dismiss(
    @SignedInUser() supervisor: CurrentUser,
    @Param('requestId') requestId: string,
    @Body() body: unknown
  ): Promise<void> {
    return this.requests.dismiss(requestId, readDismissal(body), supervisor);
  }
}

/** The visitor's address, or one shared count when it is unknown. */
function addressOf(request: VisitorRequest): string {
  return request.ip ?? 'unknown';
}

/** Runs a limit; a refusal also says when to try again, as Retry-After. */
function withRetryAfter(response: HeaderResponse, take: () => void): void {
  try {
    take();
  } catch (error) {
    if (error instanceof TooManyRequestsException) {
      response.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    throw error;
  }
}
