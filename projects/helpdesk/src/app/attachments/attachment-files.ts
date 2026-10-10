import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { AttachmentSummary } from '@helpdesk/contract';
import { map, type Observable } from 'rxjs';

/** Where one file is read: always as a download (#1026). */
export function attachmentApi(id: string): string {
  return `/api/attachments/${encodeURIComponent(id)}`;
}

/** Where the files of the request a ticket came from are listed. */
export function ticketAttachmentsApi(ticketId: string): string {
  return `/api/tickets/${encodeURIComponent(ticketId)}/attachments`;
}

/**
 * Customers' files for staff (#1026). They are fetched with the signed-in
 * session through the API's download route, and shown or saved from the
 * bytes in memory: the page never links to a file, which the API only
 * ever sends as a download anyway.
 */
@Injectable({ providedIn: 'root' })
export class AttachmentFiles {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  /** A file's bytes. */
  bytes(id: string): Observable<Blob> {
    return this.http.get(attachmentApi(id), { responseType: 'blob' });
  }

  /** The files of the request a ticket came from, oldest first. */
  forTicket(ticketId: string): Observable<AttachmentSummary[]> {
    return this.http.get<AttachmentSummary[]>(ticketAttachmentsApi(ticketId));
  }

  /**
   * Saves a file under its name: its bytes, handed to the browser as a
   * download, then let go of. A refusal (the file gone, or no longer the
   * user's to see) passes on, and nothing is saved.
   */
  save({ id, fileName }: AttachmentSummary): Observable<void> {
    return this.bytes(id).pipe(
      map((blob) => {
        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = fileName;
        this.document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
    );
  }
}
