import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_MAX_COUNT,
  type AttachmentMediaType,
  type AttachmentSummary,
  type CurrentUser,
  isImageMediaType,
} from '@helpdesk/contract';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database-token';
import { attachments, requests } from '../database/schema';
import { lockWorkable, type Transaction, UUID } from '../tickets/ticket-access';
import { safeFileName } from './file-name';
import { detectMediaType } from './file-type';
import { IMAGE_RE_ENCODER, type ImageReEncoder } from './image-re-encoder';

/** The same answer for no file and for one the user may not open. */
export const NO_SUCH_FILE = 'No such file.';

/** A file as it arrives: the name the customer gave it, and its bytes. */
export interface UploadedFile {
  name: string;
  bytes: Uint8Array;
}

/** A file checked and ready to keep, or one being downloaded. */
export interface PreparedFile {
  fileName: string;
  mediaType: AttachmentMediaType;
  content: Uint8Array;
}

/** A file's name in a message: its last part, never a folder. */
function shownName(name: string): string {
  return `"${name.split(/[\\/]/).pop()?.trim().slice(0, 80) || 'A file'}"`;
}

const TOO_LARGE = (name: string) =>
  `${shownName(name)} is larger than ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB.`;

/** What lists show of a file: never its bytes. */
const SUMMARY = {
  id: attachments.id,
  fileName: attachments.fileName,
  mediaType: attachments.mediaType,
  size: attachments.size,
};

/**
 * The files customers add to their requests (#1026). Each is checked by
 * its contents, never its name: an allowed type, within the limits, its
 * name made safe, and an image drawn anew so only the picture is kept.
 * Kept with the request; a ticket made from it reaches them through it.
 * Opened only by staff who may see the request or its ticket.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    // Without one, images are refused, never kept as they were sent.
    @Optional()
    @Inject(IMAGE_RE_ENCODER)
    private readonly reEncoder?: ImageReEncoder
  ) {}

  /**
   * Checks the files a customer sent, all before any image is drawn, and
   * answers with them ready to keep; 400, naming the file, for the first
   * one that won't do. An image is drawn anew, then checked for size
   * again, as drawing can make it larger.
   */
  async prepare(files: readonly UploadedFile[]): Promise<PreparedFile[]> {
    if (files.length > ATTACHMENTS_MAX_COUNT) {
      throw new BadRequestException(
        `Attach at most ${ATTACHMENTS_MAX_COUNT} files.`
      );
    }
    const checked = files.map(({ name, bytes }) => {
      if (bytes.length > ATTACHMENT_MAX_BYTES) {
        throw new BadRequestException(TOO_LARGE(name));
      }
      const mediaType = detectMediaType(bytes);
      if (mediaType === null) {
        throw new BadRequestException(
          `${shownName(name)} isn't a PNG, JPEG, WebP, PDF or text file.`
        );
      }
      return { name, bytes, mediaType };
    });
    const prepared: PreparedFile[] = [];
    for (const { name, bytes, mediaType } of checked) {
      let content = bytes;
      if (isImageMediaType(mediaType)) {
        try {
          if (this.reEncoder === undefined) {
            throw new Error('Nothing here redraws images.');
          }
          content = await this.reEncoder.reEncode(bytes, mediaType);
        } catch {
          throw new BadRequestException(
            `${shownName(name)} couldn't be read as an image.`
          );
        }
        if (content.length > ATTACHMENT_MAX_BYTES) {
          throw new BadRequestException(TOO_LARGE(name));
        }
      }
      prepared.push({
        fileName: safeFileName(name, mediaType),
        mediaType,
        content,
      });
    }
    return prepared;
  }

  /**
   * Keeps prepared files with a request, in the transaction that keeps the
   * request, so neither is kept without the other. A millisecond apart, so
   * they list in the order sent.
   */
  async store(
    tx: Transaction,
    requestId: string,
    files: readonly PreparedFile[],
    at = new Date()
  ): Promise<void> {
    if (files.length === 0) {
      return;
    }
    await tx.insert(attachments).values(
      files.map((file, index) => ({
        requestId,
        ...file,
        size: file.content.length,
        createdAt: new Date(at.getTime() + index),
      }))
    );
  }

  /** Each request's files, oldest first; none for a request without. */
  async listFor(
    requestIds: readonly string[]
  ): Promise<Map<string, AttachmentSummary[]>> {
    const listed = new Map(
      requestIds.map((id) => [id, [] as AttachmentSummary[]])
    );
    if (requestIds.length === 0) {
      return listed;
    }
    const rows = await this.database
      .select({ ...SUMMARY, requestId: attachments.requestId })
      .from(attachments)
      .where(inArray(attachments.requestId, [...requestIds]))
      .orderBy(asc(attachments.createdAt));
    for (const { requestId, ...summary } of rows) {
      listed.get(requestId)?.push(summary);
    }
    return listed;
  }

  /**
   * The files of the request a ticket came from, oldest first; none if it
   * came from none. For whoever may work on the ticket: anyone else gets
   * the ticket's own 404.
   */
  async forTicket(
    ticketId: string,
    by: CurrentUser
  ): Promise<AttachmentSummary[]> {
    return this.database.transaction(async (tx) => {
      await lockWorkable(tx, ticketId, by, 'share');
      return tx
        .select(SUMMARY)
        .from(attachments)
        .innerJoin(requests, eq(attachments.requestId, requests.id))
        .where(eq(requests.ticketId, ticketId))
        .orderBy(asc(attachments.createdAt));
    });
  }

  /**
   * A file to download, for staff who may see it: any supervisor while its
   * request is pending (New requests is theirs), then whoever may work on
   * the ticket it became. Anyone else, a dismissed request's file, and no
   * file at all get the same 404.
   */
  async download(id: string, by: CurrentUser): Promise<PreparedFile> {
    if (!UUID.test(id)) {
      throw new NotFoundException(NO_SUCH_FILE);
    }
    return this.database.transaction(async (tx) => {
      const [file] = await tx
        .select({
          fileName: attachments.fileName,
          mediaType: attachments.mediaType,
          content: attachments.content,
          status: requests.status,
          ticketId: requests.ticketId,
        })
        .from(attachments)
        .innerJoin(requests, eq(attachments.requestId, requests.id))
        .where(eq(attachments.id, id));
      if (file === undefined) {
        throw new NotFoundException(NO_SUCH_FILE);
      }
      const { status, ticketId, ...download } = file;
      if (status === 'pending' && by.role === 'supervisor') {
        return download;
      }
      if (status === 'ticket' && ticketId !== null) {
        try {
          await lockWorkable(tx, ticketId, by, 'share');
          return download;
        } catch (error) {
          if (!(error instanceof NotFoundException)) {
            throw error;
          }
        }
      }
      throw new NotFoundException(NO_SUCH_FILE);
    });
  }
}
