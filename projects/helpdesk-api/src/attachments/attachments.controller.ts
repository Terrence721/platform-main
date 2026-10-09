// Types only: decorated methods record their parameter and return types
// at run time (emitDecoratorMetadata), and an interface has no run-time
// value to record.
// Nest's own name for a response sent from bytes: cspell:ignore Streamable
import type {
  AttachmentMediaType,
  AttachmentSummary,
  CurrentUser,
} from '@helpdesk/contract';
import { AttachmentsService } from '@helpdesk/server';
import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { SignedInUser } from '../auth/auth.guard';
import { OnlyFor } from '../auth/role.guard';

/** Characters RFC 5987 lets stand in `filename*`; the rest are escaped. */
const escapeForFilenameStar = (name: string) =>
  encodeURIComponent(name).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

/**
 * How a file is named for saving: `filename` in plain ASCII for an old
 * browser (anything else, and quotes and backslashes, as `_`), and
 * `filename*` in full, as UTF-8, for every current one.
 */
function attachmentDisposition(fileName: string): string {
  const ascii = [...fileName]
    .map((character) =>
      /^[\x20-\x7e]$/.test(character) && character !== '"' && character !== '\\'
        ? character
        : '_'
    )
    .join('');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${escapeForFilenameStar(fileName)}`;
}

/** The Content-Type each file is sent with; text always as UTF-8. */
const contentType = (mediaType: AttachmentMediaType) =>
  mediaType === 'text/plain' ? 'text/plain; charset=utf-8' : mediaType;

/**
 * Customers' files (#1026), for staff who may see them: one file, and the
 * files of the request a ticket came from. Who may see which is
 * `AttachmentsService`'s; supervisors and agents get here, admins (who
 * work no tickets) get 403, signed out 401.
 */
@Controller()
@OnlyFor('supervisor', 'agent')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /**
   * A file, only ever as a download: saved under its safe name, never
   * shown in the page, guessed at as another type (nosniff), or allowed
   * to run anything (a policy that blocks everything, and a sandbox).
   * Never cached. 404 for anyone who may not see it, as for no file.
   */
  @Get('attachments/:id')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  @Header('Cache-Control', 'private, no-store')
  @Header('Cross-Origin-Resource-Policy', 'same-origin')
  async download(
    @SignedInUser() user: CurrentUser,
    @Param('id') id: string
  ): Promise<StreamableFile> {
    const file = await this.attachments.download(id, user);
    return new StreamableFile(file.content, {
      type: contentType(file.mediaType),
      disposition: attachmentDisposition(file.fileName),
      length: file.content.length,
    });
  }

  /**
   * The files of the request a ticket came from, oldest first, for its
   * popup; none for a ticket from no request. 404 for someone who may not
   * work on the ticket, as its details answer.
   */
  @Get('tickets/:ticketId/attachments')
  forTicket(
    @SignedInUser() user: CurrentUser,
    @Param('ticketId') ticketId: string
  ): Promise<AttachmentSummary[]> {
    return this.attachments.forTicket(ticketId, user);
  }
}
