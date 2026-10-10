import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AttachmentSummary } from '@helpdesk/contract';
import { firstValueFrom } from 'rxjs';
import {
  AttachmentFiles,
  attachmentApi,
  ticketAttachmentsApi,
} from './attachment-files';

const SHOT: AttachmentSummary = {
  id: 'file-1',
  fileName: 'orders-export.png',
  mediaType: 'image/png',
  size: 9_000,
};

// Customers' files for staff (#1026): fetched with the session through
// the API's download route, never linked to directly.
describe('AttachmentFiles', () => {
  let http: HttpTestingController;
  let files: AttachmentFiles;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    files = TestBed.inject(AttachmentFiles);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it("names where a file and a ticket's files are, escaping ids", () => {
    expect(attachmentApi('file 1')).toBe('/api/attachments/file%201');
    expect(ticketAttachmentsApi('ticket/1')).toBe(
      '/api/tickets/ticket%2F1/attachments'
    );
  });

  it("reads a file's bytes", async () => {
    const bytes = firstValueFrom(files.bytes('file-1'));

    const call = http.expectOne(attachmentApi('file-1'));
    expect(call.request.responseType).toBe('blob');
    const blob = new Blob(['png'], { type: 'image/png' });
    call.flush(blob);

    expect(await bytes).toBe(blob);
  });

  it("lists a ticket's files", async () => {
    const listed = firstValueFrom(files.forTicket('ticket-1'));

    http.expectOne(ticketAttachmentsApi('ticket-1')).flush([SHOT]);

    expect(await listed).toEqual([SHOT]);
  });

  describe('save', () => {
    // jsdom has no object URLs: they are stood in for.
    let made: Blob[];
    let revoked: string[];

    beforeEach(() => {
      made = [];
      revoked = [];
      URL.createObjectURL = (blob: Blob) => {
        made.push(blob);
        return 'blob:file-1';
      };
      URL.revokeObjectURL = (url: string) => revoked.push(url);
    });

    it('saves the file under its name, then lets go of it', async () => {
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      const saved = firstValueFrom(files.save(SHOT));

      const blob = new Blob(['png'], { type: 'image/png' });
      http.expectOne(attachmentApi('file-1')).flush(blob);
      await saved;

      // The link that was clicked: the `this` of the click.
      const clicked = click.mock.contexts[0] as HTMLAnchorElement | undefined;
      expect(made).toEqual([blob]);
      expect(clicked?.download).toBe('orders-export.png');
      expect(clicked?.getAttribute('href')).toBe('blob:file-1');
      expect(clicked?.isConnected).toBe(false);
      expect(revoked).toEqual(['blob:file-1']);
    });

    it('passes on a refusal, saving nothing', async () => {
      const saved = firstValueFrom(files.save(SHOT));

      http
        .expectOne(attachmentApi('file-1'))
        .flush(null, { status: 404, statusText: 'Not Found' });

      await expect(saved).rejects.toMatchObject({ status: 404 });
      expect(made).toEqual([]);
    });
  });
});
