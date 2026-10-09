import {
  ATTACHMENT_FILE_NAME_MAX_LENGTH,
  type AttachmentMediaType,
} from '@helpdesk/contract';

/** Each type's extensions, the one a file gets first. */
const EXTENSIONS: Readonly<Record<AttachmentMediaType, readonly string[]>> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
};

/** Characters Windows refuses in a file name (folders are split off first). */
const RESERVED = new Set(['<', '>', ':', '"', '|', '?', '*']);

/**
 * Characters that change which way text runs, or join it unseen: an
 * override can show `shot.exe.png` as ending in `.png` when it doesn't.
 */
function isDirectionOrFormat(code: number): boolean {
  return (
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/** Names Windows keeps for devices, whatever the extension. */
const DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Spaces and dots at either end: a dot first hides a file, last is lost. */
const trimEnds = (text: string) => text.replace(/^[\s.]+|[\s.]+$/g, '');

/**
 * A customer's file name made safe to show in a page and to save on any
 * computer (#1026): only its last part (no folders), control characters
 * as spaces, reserved and direction-changing characters dropped, spaces
 * collapsed, and no space or dot at either end. It ends in an extension of
 * the type its contents have: kept if it already does (lowercased), added
 * otherwise, so `export.csv` sent as text is `export.csv.txt`. Within
 * `ATTACHMENT_FILE_NAME_MAX_LENGTH` characters, shortened before the
 * extension; `attachment.<ext>` if nothing is left.
 */
export function safeFileName(name: string, type: AttachmentMediaType): string {
  const lastPart = name.normalize('NFC').split(/[\\/]/).pop() ?? '';
  let cleaned = '';
  for (const character of lastPart) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20) {
      cleaned += ' ';
    } else if (
      code !== 0x7f &&
      !RESERVED.has(character) &&
      !isDirectionOrFormat(code)
    ) {
      cleaned += character;
    }
  }
  cleaned = cleaned.replace(/\s+/g, ' ');

  const extensions = EXTENSIONS[type];
  const dot = cleaned.lastIndexOf('.');
  const given = dot === -1 ? '' : cleaned.slice(dot + 1).toLowerCase();
  const [extension, rest] = extensions.includes(given)
    ? [given, cleaned.slice(0, dot)]
    : [extensions[0], cleaned];

  const room = ATTACHMENT_FILE_NAME_MAX_LENGTH - extension.length - 1;
  let base = trimEnds([...trimEnds(rest)].slice(0, room).join(''));
  if (base === '') {
    base = 'attachment';
  } else if (DEVICE_NAME.test(base)) {
    base = `_${base}`;
  }
  return `${base}.${extension}`;
}
