import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ATTACHMENT_MAX_BYTES } from '@helpdesk/contract';
import { AttachmentPicker, formatFileSize } from './attachment-picker';

/** A file as the browser gives it: a name, contents and its type. */
const file = (name: string, type = '', size = 12) =>
  new File([new Uint8Array(size)], name, { type });

const photo = () => file('Zoë photo.jpg', 'image/jpeg', 2_400_000);
const spreadsheet = () => file('orders-2026-10.csv', 'text/csv', 12_000);

/** The page's side: the files it would send. */
@Component({
  imports: [AttachmentPicker],
  template: `<hd-attachment-picker [(files)]="files" />`,
})
class Host {
  readonly files = signal<readonly File[]>([]);
}

describe('formatFileSize', () => {
  it.each([
    [0, '0 bytes'],
    [1, '1 byte'],
    [900, '900 bytes'],
    [1_024, '1 KB'],
    [12_000, '12 KB'],
    [1_048_576, '1 MB'],
    [2_400_000, '2.3 MB'],
    [ATTACHMENT_MAX_BYTES, '5 MB'],
  ])('says %d bytes as %j', (bytes, words) => {
    expect(formatFileSize(bytes)).toBe(words);
  });
});

// Attachments on the Report an issue page (#1026), as designed: a drop
// zone that is also the button to choose files, the files listed with a
// Remove button each, and a file that won't do refused in the API's words.
describe('AttachmentPicker', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const drop = element.querySelector<HTMLElement>('.drop');
    const input = element.querySelector<HTMLInputElement>('input[type=file]');
    if (drop === null || input === null) {
      throw new Error('No drop zone or file input');
    }
    const text = (selector: string) =>
      element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    return {
      host: fixture.componentInstance,
      element,
      drop,
      input,
      text,
      /** Chooses `files` with the picker, as the browser would. */
      choose: (...files: File[]) => {
        Object.defineProperty(input, 'files', {
          value: files,
          configurable: true,
        });
        input.dispatchEvent(new Event('change'));
        fixture.detectChanges();
      },
      /** Drops `files` on the zone. */
      dropFiles: (...files: File[]) => {
        const event = new Event('drop', { cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: { files } });
        drop.dispatchEvent(event);
        fixture.detectChanges();
        return event;
      },
      rows: () =>
        [...element.querySelectorAll('li')].map((row) => ({
          name: row.querySelector('.name')?.textContent?.trim(),
          size: row.querySelector('.size')?.textContent?.trim(),
          remove: row.querySelector('button')?.getAttribute('aria-label'),
        })),
      detectChanges: () => fixture.detectChanges(),
    };
  }

  it('is headed Attachments, optional, and says what it takes', () => {
    const { text, drop, element } = render();

    expect(text('.label')).toBe('Attachments (optional)');
    expect(drop.getAttribute('role')).toBe('button');
    expect(drop.getAttribute('tabindex')).toBe('0');
    expect(text('.drop strong')).toBe('Drop files here or choose files');
    expect(text('#attach-hint')).toBe(
      'PNG, JPEG, WebP, PDF or text · up to 3 files, 5 MB each'
    );
    expect(element.querySelector('ul')).toBeNull();
  });

  it.each([
    ['a click', (drop: HTMLElement) => drop.click()],
    [
      'Enter',
      (drop: HTMLElement) =>
        drop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })),
    ],
    [
      'Space',
      (drop: HTMLElement) =>
        drop.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })),
    ],
  ])('opens the file picker on %s', (_, press) => {
    const { drop, input } = render();
    const opened = vi.spyOn(input, 'click');

    press(drop);

    expect(opened).toHaveBeenCalledOnce();
  });

  it('lists the files chosen, each with its size and a Remove button named for it', () => {
    const { choose, rows, host } = render();

    choose(photo(), spreadsheet());

    expect(rows()).toEqual([
      { name: 'Zoë photo.jpg', size: '2.3 MB', remove: 'Remove Zoë photo.jpg' },
      {
        name: 'orders-2026-10.csv',
        size: '12 KB',
        remove: 'Remove orders-2026-10.csv',
      },
    ]);
    expect(host.files().map(({ name }) => name)).toEqual([
      'Zoë photo.jpg',
      'orders-2026-10.csv',
    ]);
  });

  it('adds each pick to the files already chosen', () => {
    const { choose, host } = render();

    choose(photo());
    choose(spreadsheet());

    expect(host.files()).toHaveLength(2);
  });

  it('takes files dropped on it, and shows when files are over it', () => {
    const { drop, dropFiles, host, detectChanges } = render();

    drop.dispatchEvent(new Event('dragover', { cancelable: true }));
    detectChanges();
    expect(drop.classList).toContain('over');
    drop.dispatchEvent(new Event('dragleave'));
    detectChanges();
    expect(drop.classList).not.toContain('over');

    const dropped = dropFiles(photo());

    expect(dropped.defaultPrevented).toBe(true);
    expect(drop.classList).not.toContain('over');
    expect(host.files().map(({ name }) => name)).toEqual(['Zoë photo.jpg']);
  });

  it.each([
    [
      'a file over 5 MB',
      file('huge.png', 'image/png', ATTACHMENT_MAX_BYTES + 1),
      '"huge.png" is larger than 5 MB.',
    ],
    [
      'a type not allowed',
      file('setup.exe', 'application/octet-stream'),
      '"setup.exe" isn\'t a PNG, JPEG, WebP, PDF or text file.',
    ],
  ])(
    "refuses %s in the API's words, keeping the rest",
    (_, refused, message) => {
      const { choose, host, element, text } = render();

      choose(photo(), refused);

      expect(host.files().map(({ name }) => name)).toEqual(['Zoë photo.jpg']);
      expect(text('.field-error')).toBe(message);
      expect(element.querySelector('.field-error')?.getAttribute('role')).toBe(
        'alert'
      );
    }
  );

  it.each([
    ['a screenshot whose type the browser left out', file('shot.png')],
    ['a log the browser calls text', file('app.log', 'text/x-log')],
    ['notes with no type at all', file('notes.txt')],
  ])('takes %s', (_, taken) => {
    const { choose, host, text } = render();

    choose(taken);

    expect(host.files()).toEqual([taken]);
    expect(text('.field-error')).toBeUndefined();
  });

  it('clears an error once a pick goes well', () => {
    const { choose, text } = render();
    choose(file('setup.exe', 'application/octet-stream'));

    choose(photo());

    expect(text('.field-error')).toBeUndefined();
  });

  it('takes 3 at most, then asks for one to be removed, opening nothing', () => {
    const { choose, host, text, drop, input } = render();
    const opened = vi.spyOn(input, 'click');

    choose(photo(), spreadsheet(), file('notes.txt'), file('more.txt'));

    expect(host.files()).toHaveLength(3);
    expect(text('.field-error')).toBe('Attach at most 3 files.');
    expect(text('.drop strong')).toBe('Remove a file to attach another.');
    expect(drop.getAttribute('aria-disabled')).toBe('true');
    drop.click();
    expect(opened).not.toHaveBeenCalled();
  });

  it('removes a file, moving focus to the drop zone', () => {
    const { choose, element, host, drop, detectChanges } = render();
    choose(photo(), spreadsheet());

    element.querySelector<HTMLButtonElement>('li button')?.click();
    detectChanges();

    expect(host.files().map(({ name }) => name)).toEqual([
      'orders-2026-10.csv',
    ]);
    expect(document.activeElement).toBe(drop);
  });

  it('lets the same file be chosen again after it was removed', () => {
    const { choose, input } = render();

    choose(photo());

    expect(input.value).toBe('');
  });

  it('offers the allowed types in the picker, any number at once', () => {
    const { input } = render();

    expect(input.multiple).toBe(true);
    expect(input.accept).toBe(
      'image/png,image/jpeg,image/webp,application/pdf,text/plain,.txt,.csv,.log'
    );
    expect(input.getAttribute('aria-hidden')).toBe('true');
    expect(input.tabIndex).toBe(-1);
  });
});
