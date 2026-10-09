import type { AttachmentMediaType } from '@helpdesk/contract';

/** Each binary type's signature: the bytes it starts with. */
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const RIFF = [0x52, 0x49, 0x46, 0x46]; // RIFF, then a size,
const WEBP = [0x57, 0x45, 0x42, 0x50]; // then WEBP.

/** Whether `file` holds `signature` from byte `offset`. */
function startsWith(file: Uint8Array, signature: number[], offset = 0) {
  return (
    file.length >= offset + signature.length &&
    signature.every((byte, index) => file[offset + index] === byte)
  );
}

/** Tab, line feed and carriage return: the only control characters text has. */
const TEXT_CONTROLS = new Set([0x09, 0x0a, 0x0d]);

/**
 * Whether `file` is plain text: valid UTF-8 with no control characters but
 * tabs and line breaks, so a binary file can't pass as text.
 */
function isPlainText(file: Uint8Array): boolean {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file);
  } catch {
    return false;
  }
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if ((code < 0x20 && !TEXT_CONTROLS.has(code)) || code === 0x7f) {
      return false;
    }
  }
  return true;
}

/**
 * A file's type, decided from its contents (#1026): never from its name or
 * what the browser says, so a renamed file can't pass as an image. `null`
 * for an empty file, or any type that is not allowed. Markup, such as an
 * SVG or a web page, is only text: kept as `text/plain`, and only ever
 * served as a download, it is never drawn or run.
 */
export function detectMediaType(file: Uint8Array): AttachmentMediaType | null {
  if (file.length === 0) {
    return null;
  }
  if (startsWith(file, PNG)) {
    return 'image/png';
  }
  if (startsWith(file, JPEG)) {
    return 'image/jpeg';
  }
  if (startsWith(file, RIFF) && startsWith(file, WEBP, 8)) {
    return 'image/webp';
  }
  if (startsWith(file, PDF)) {
    return 'application/pdf';
  }
  return isPlainText(file) ? 'text/plain' : null;
}
