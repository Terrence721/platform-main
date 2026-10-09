// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_MAX_COUNT,
  type CreateRequestResponse,
  type CurrentUser,
  formatRequestReference,
  REQUEST_FIELDS_PART,
  REQUEST_FILES_PART,
  type PendingRequest,
  type RequestStatusResponse,
  type TicketDto,
} from '@helpdesk/contract';
import {
  AttachmentsService,
  CustomerRequestsService,
  NO_MATCHING_REQUEST,
  readCustomerRequest,
  readDismissal,
  readTurnIntoTicket,
} from '@helpdesk/server';
import {
  BadRequestException,
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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { randomInt } from 'crypto';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';
import {
  isLikelySpam,
  RequestLimits,
  TooManyRequestsException,
} from './request-limits';
import {
  FIELDS_PART,
  UploadErrorsInterceptor,
} from './upload-errors.interceptor';

/** The part of Express's request the send needs. */
interface VisitorRequest {
  /** The visitor's address; behind one proxy, as main.ts trusts it. */
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

/** A file as multer holds it in memory: what the send reads of it. */
interface ReceivedFile {
  originalname: string;
  buffer: Buffer;
}

/**
 * The most the fields part may hold: the longest description and subject
 * with room to spare, far below a file's limit.
 */
const FIELDS_MAX_BYTES = 64 * 1024;

/**
 * The request's fields: the JSON body as it is, or, sent as multipart,
 * the JSON in its `request` part; 400 if that is missing or not JSON.
 */
function fieldsOf(body: unknown, request: VisitorRequest): unknown {
  const type = request.headers['content-type'];
  if (typeof type !== 'string' || !type.startsWith('multipart/form-data')) {
    return body;
  }
  const part = (body as Record<string, unknown> | undefined)?.[
    REQUEST_FIELDS_PART
  ];
  if (typeof part === 'string') {
    try {
      return JSON.parse(part) as unknown;
    } catch {
      // As for no part at all.
    }
  }
  throw new BadRequestException(FIELDS_PART);
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
    private readonly limits: RequestLimits,
    private readonly attachments: AttachmentsService
  ) {}

  /**
   * Keeps a request from the public form: 201 with its reference only;
   * 400 for a field that is wrong. Sent as JSON, or, with files, as
   * multipart: the fields as JSON in the `request` part, up to
   * ATTACHMENTS_MAX_COUNT files in `files` parts, each held in memory
   * only up to ATTACHMENT_MAX_BYTES. A file that won't do is a 400 naming
   * it, and nothing is kept. One that looks sent by a program (the hidden
   * field filled in, or sent faster than a person could) gets a made-up
   * reference, and nothing is checked or kept, so a bot cannot tell. At
   * most MAX_SENDS an hour from one address, and MAX_FILE_BYTES of files
   * (counted as sent, before any is checked): then 429, with Retry-After.
   */
  @Post()
  @UseInterceptors(
    UploadErrorsInterceptor,
    FilesInterceptor(REQUEST_FILES_PART, ATTACHMENTS_MAX_COUNT, {
      limits: {
        fileSize: ATTACHMENT_MAX_BYTES,
        files: ATTACHMENTS_MAX_COUNT,
        fields: 1,
        fieldSize: FIELDS_MAX_BYTES,
        parts: ATTACHMENTS_MAX_COUNT + 1,
      },
      // Browsers send a file's name as UTF-8; multer's default is Latin-1.
      defParamCharset: 'utf8',
    })
  )
  async send(
    @Body() body: unknown,
    @UploadedFiles() files: ReceivedFile[] | undefined,
    @Req() request: VisitorRequest,
    @Res({ passthrough: true }) response: HeaderResponse
  ): Promise<CreateRequestResponse> {
    withRetryAfter(response, () => this.limits.send(addressOf(request)));
    const sent = readCustomerRequest(fieldsOf(body, request));
    if (isLikelySpam(sent)) {
      return { reference: formatRequestReference(randomInt(1001, 1_000_000)) };
    }
    const received = files ?? [];
    withRetryAfter(response, () =>
      this.limits.sendBytes(
        addressOf(request),
        received.reduce((total, { buffer }) => total + buffer.byteLength, 0)
      )
    );
    const prepared =
      received.length === 0
        ? []
        : await this.attachments.prepare(
            received.map(({ originalname, buffer }) => ({
              name: originalname,
              bytes: new Uint8Array(
                buffer.buffer,
                buffer.byteOffset,
                buffer.byteLength
              ),
            }))
          );
    return this.requests.send(sent, new Date(), prepared);
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
