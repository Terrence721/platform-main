import { detectMediaType } from './file-type';

/** Bytes from numbers and text, in order. */
const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...new TextEncoder().encode(part)] : part
    )
  );

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// A file's type from its contents (#1026), never its name or the browser's
// word: a renamed file can't pass as an image.
describe('detectMediaType', () => {
  it.each([
    ['a PNG', bytes(PNG_SIGNATURE, [0, 0, 0, 13]), 'image/png'],
    ['a JPEG', bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16]), 'image/jpeg'],
    ['a WebP', bytes('RIFF', [36, 0, 0, 0], 'WEBP', 'VP8 '), 'image/webp'],
    ['a PDF', bytes('%PDF-1.7\n%', [0xe2, 0xe3]), 'application/pdf'],
    ['plain text', bytes('Rows: 1,000\r\nExpected:\t4,312\n'), 'text/plain'],
    [
      'text with a byte order mark',
      bytes([0xef, 0xbb, 0xbf], 'Hi'),
      'text/plain',
    ],
    ['text in any language', bytes('Name: Zoë, 東京 ✓'), 'text/plain'],
  ])('knows %s', (_, file, type) => {
    expect(detectMediaType(file)).toBe(type);
  });

  it.each([
    ['an empty file', bytes()],
    ['a PNG cut short', bytes(PNG_SIGNATURE.slice(0, 4))],
    ['a WAV, which is RIFF too', bytes('RIFF', [36, 0, 0, 0], 'WAVE', 'fmt ')],
    ['a GIF', bytes('GIF89a', [1, 0, 1, 0, 0x80, 0, 0])],
    ['a program', bytes('MZ', [0x90, 0, 3, 0])],
    ['a zip', bytes('PK', [3, 4, 20, 0])],
    ['text that is not valid UTF-8', bytes('caf', [0xc3, 0x28])],
    ['text with a NUL', bytes('a', [0], 'b')],
    ['text with a control character', bytes('bell', [7])],
  ])('refuses %s', (_, file) => {
    expect(detectMediaType(file)).toBeNull();
  });

  // Served only as a download with nosniff, and named .txt: never drawn,
  // never run.
  it('keeps markup only as text', () => {
    expect(detectMediaType(bytes('<svg onload="alert(1)"></svg>'))).toBe(
      'text/plain'
    );
    expect(detectMediaType(bytes('<!doctype html><script></script>'))).toBe(
      'text/plain'
    );
  });
});
