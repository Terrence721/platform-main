// The optional virus scan (#1293): what scans files, apart from how. The
// API provides a ClamAV client when it is switched on; the demo has none.
// The attachments service only needs this interface and its token.
// The test file's own name: cspell:ignore EICAR

/** What a scan found: nothing, or the name of the threat. */
export type ScanResult = { clean: true } | { clean: false; threat: string };

/**
 * Scans a file's bytes, as the customer sent them. Rejects when it cannot
 * scan (the scanner down or not answering), so a file is never taken as
 * clean without being looked at.
 */
export interface FileScanner {
  scan(file: Uint8Array): Promise<ScanResult>;
}

/** The `FileScanner` the attachments service injects, when there is one. */
export const FILE_SCANNER = Symbol('FILE_SCANNER');

/**
 * The EICAR test file: 68 harmless characters that every virus scanner
 * reports as a virus, made to test them (eicar.org). Put together here
 * from pieces, so the whole text is never on disk, where an antivirus
 * would quarantine this source file. For specs and checks only.
 */
export function eicarTestFile(): Uint8Array {
  const pieces = [
    'X5O!P%@AP[4\\PZX54(P^)7CC)7}$',
    'EICAR-STANDARD-',
    'ANTIVIRUS-TEST-',
    'FILE!$H+H*',
  ];
  return new TextEncoder().encode(pieces.join(''));
}
