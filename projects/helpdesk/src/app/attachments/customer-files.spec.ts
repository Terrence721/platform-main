import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AttachmentSummary } from '@helpdesk/contract';
import { type Observable, of, throwError } from 'rxjs';
import { AttachmentFiles } from './attachment-files';
import { CustomerFiles } from './customer-files';

const SHOT: AttachmentSummary = {
  id: 'file-1',
  fileName: 'orders-export.png',
  mediaType: 'image/png',
  size: 9_000,
};
const STEPS: AttachmentSummary = {
  id: 'file-2',
  fileName: 'steps.txt',
  mediaType: 'text/plain',
  size: 214,
};

/** A request's or a ticket's files, as the card or popup shows them. */
@Component({
  imports: [CustomerFiles],
  template: `<hd-customer-files [files]="files()" />`,
})
class Host {
  readonly files = signal<readonly AttachmentSummary[]>([]);
}

// "Files from the customer" (#1026), as designed: a thumbnail for each
// picture, an icon for the rest, and a Download button each.
describe('CustomerFiles', () => {
  /** The bytes each file id is read as; an id missing here fails. */
  let bytes: Record<string, Blob>;
  const attachmentFiles = {
    bytes: vi.fn((id: string): Observable<Blob> =>
      id in bytes ? of(bytes[id]) : throwError(() => new Error('404'))
    ),
    save: vi.fn((_: AttachmentSummary): Observable<void> => of(undefined)),
  };
  /** Object URLs made and let go of (jsdom has none of its own). */
  let made: string[];
  let revoked: string[];

  beforeEach(() => {
    bytes = { 'file-1': new Blob(['png'], { type: 'image/png' }) };
    vi.clearAllMocks();
    made = [];
    revoked = [];
    URL.createObjectURL = () => {
      const url = `blob:thumb-${made.length + 1}`;
      made.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => revoked.push(url);
  });

  function render(files: readonly AttachmentSummary[]) {
    TestBed.configureTestingModule({
      providers: [{ provide: AttachmentFiles, useValue: attachmentFiles }],
    });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.files.set(files);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      element,
      rows: () =>
        [...element.querySelectorAll('li')].map((row) => ({
          name: row.querySelector('.name')?.textContent?.trim(),
          size: row.querySelector('.size')?.textContent?.trim(),
          thumbnail: row.querySelector('img')?.getAttribute('src') ?? null,
          alt: row.querySelector('img')?.getAttribute('alt') ?? null,
          download: row.querySelector('button')?.getAttribute('aria-label'),
        })),
    };
  }

  it('shows nothing for no files', () => {
    const { element } = render([]);

    expect(element.textContent?.trim()).toBe('');
    expect(attachmentFiles.bytes).not.toHaveBeenCalled();
  });

  it('lists each file under its heading: name, size, and a Download button named for it', () => {
    const { element, rows } = render([SHOT, STEPS]);

    expect(element.querySelector('.files-label')?.textContent?.trim()).toBe(
      'Files from the customer'
    );
    expect(element.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Files from the customer'
    );
    expect(rows()).toEqual([
      {
        name: 'orders-export.png',
        size: '9 KB',
        thumbnail: 'blob:thumb-1',
        alt: 'orders-export.png',
        download: 'Download orders-export.png',
      },
      {
        name: 'steps.txt',
        size: '214 bytes',
        thumbnail: null,
        alt: null,
        download: 'Download steps.txt',
      },
    ]);
  });

  it('reads only the pictures, once each, for their thumbnails', () => {
    const { fixture } = render([SHOT, STEPS]);

    // The list again, as a live update gives it, with the same picture.
    fixture.componentInstance.files.set([SHOT, STEPS]);
    fixture.detectChanges();

    expect(attachmentFiles.bytes).toHaveBeenCalledExactlyOnceWith('file-1');
  });

  it("says, quietly, when a picture's file can't be read", () => {
    const { element } = render([{ ...SHOT, id: 'gone' }]);

    const row = element.querySelector('li');
    expect(row?.querySelector('.failed')?.textContent?.trim()).toBe(
      "Couldn't load this file."
    );
    expect(row?.querySelector('[role=alert]')).toBeNull();
    expect(row?.querySelector('img')).toBeNull();
  });

  it('saves a file when its Download button is pressed', () => {
    const { element } = render([SHOT, STEPS]);

    element.querySelectorAll<HTMLButtonElement>('li button')[1].click();

    expect(attachmentFiles.save).toHaveBeenCalledExactlyOnceWith(STEPS);
  });

  it("says so when a file can't be downloaded", () => {
    attachmentFiles.save.mockReturnValueOnce(
      throwError(() => new Error('404'))
    );
    const { element, fixture } = render([STEPS]);

    element.querySelector<HTMLButtonElement>('li button')?.click();
    fixture.detectChanges();

    expect(element.querySelector('.failed')?.textContent?.trim()).toBe(
      "Couldn't load this file."
    );
  });

  it('lets go of its thumbnails when it goes away', () => {
    const { fixture } = render([SHOT]);

    fixture.destroy();

    expect(revoked).toEqual(['blob:thumb-1']);
  });
});
