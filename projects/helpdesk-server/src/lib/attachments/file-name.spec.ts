import { ATTACHMENT_FILE_NAME_MAX_LENGTH } from '@helpdesk/contract';
import { safeFileName } from './file-name';

// A customer's file name, made safe to show in a page and to save on any
// computer (#1026), with the extension of the type its contents have.
describe('safeFileName', () => {
  it.each([
    ['orders-export.png', 'image/png', 'orders-export.png'],
    ['Photo.JPG', 'image/jpeg', 'Photo.jpg'],
    ['scan.jpeg', 'image/jpeg', 'scan.jpeg'],
    ['notes.txt', 'text/plain', 'notes.txt'],
    ['Invoice October.pdf', 'application/pdf', 'Invoice October.pdf'],
    ['Zoë’s café receipt.pdf', 'application/pdf', 'Zoë’s café receipt.pdf'],
  ] as const)('keeps a fine name: %s', (name, type, safe) => {
    expect(safeFileName(name, type)).toBe(safe);
  });

  it.each([
    // The contents decide: a renamed file gets its real extension.
    ['report', 'text/plain', 'report.txt'],
    ['export.csv', 'text/plain', 'export.csv.txt'],
    ['picture.png', 'image/jpeg', 'picture.png.jpg'],
    ['page.svg', 'text/plain', 'page.svg.txt'],
  ] as const)('gives %s the extension of its type', (name, type, safe) => {
    expect(safeFileName(name, type)).toBe(safe);
  });

  it.each([
    ['C:\\Users\\dana\\Desktop\\shot.png', 'shot.png'],
    ['../../etc/passwd.png', 'passwd.png'],
    ['a<b>c:d"e|f?g*h.png', 'abcdefgh.png'],
    ['tab\there\nnew line.png', 'tab here new line.png'],
    // After a right-to-left override, "photo-\u202Egnp.exe" reads as
    // "photo-exe.png": without it, the name says what it is.
    ['photo-\u202Egnp.exe', 'photo-gnp.exe.png'],
    ['  .hidden. .png', 'hidden.png'],
    ['   lots    of   space .png', 'lots of space.png'],
    ['CON.png', '_CON.png'],
    ['lpt1.png', '_lpt1.png'],
  ])('cleans %j', (name, safe) => {
    expect(safeFileName(name, 'image/png')).toBe(safe);
  });

  it.each(['', '   ', '...', '<>|', 'folder/'])(
    'names %j attachment, with its extension',
    (name) => {
      expect(safeFileName(name, 'application/pdf')).toBe('attachment.pdf');
    }
  );

  it('shortens a long name, keeping its extension', () => {
    const safe = safeFileName(`${'a'.repeat(300)}.png`, 'image/png');

    expect(safe).toHaveLength(ATTACHMENT_FILE_NAME_MAX_LENGTH);
    expect(safe.endsWith('a.png')).toBe(true);
  });

  it('shortens by characters, never splitting one', () => {
    const safe = safeFileName(`${'東'.repeat(250)}.txt`, 'text/plain');

    expect([...safe]).toHaveLength(ATTACHMENT_FILE_NAME_MAX_LENGTH);
    expect(safe.endsWith('東.txt')).toBe(true);
  });
});
