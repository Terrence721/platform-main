import type { FileScanner, ScanResult } from '@helpdesk/server';
import { connect } from 'net';

// ClamAV's command for scanning bytes sent over the line: cspell:ignore INSTREAM clamd CLAMAV

/** How much of a file goes in one chunk, well under clamd's limits. */
export const CHUNK_BYTES = 64 * 1024;

/** ClamAV's daemon's port, unless told otherwise. */
export const CLAM_AV_DEFAULT_PORT = 3310;

/** How long to wait for an answer: a large file takes a few seconds. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The API's virus scanner (#1293): ClamAV's daemon (`clamd`), over TCP,
 * with its INSTREAM command. The file goes as chunks (each a 4-byte
 * length, then its bytes), ended by a zero length; clamd answers
 * `stream: OK`, or `stream: <threat> FOUND`, and hangs up. Anything else,
 * nobody listening, or no answer in time rejects: the attachments service
 * then refuses the upload rather than keep a file nobody scanned.
 */
export class ClamAvScanner implements FileScanner {
  constructor(
    private readonly host: string,
    private readonly port = CLAM_AV_DEFAULT_PORT,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  scan(file: Uint8Array): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const replies: Buffer[] = [];
      let settled = false;
      const settle = (outcome: () => void) => {
        if (!settled) {
          settled = true;
          outcome();
        }
      };
      const socket = connect({ host: this.host, port: this.port });
      socket.setTimeout(this.timeoutMs, () =>
        socket.destroy(new Error('ClamAV did not answer in time.'))
      );
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        for (let start = 0; start < file.length; start += CHUNK_BYTES) {
          const chunk = file.subarray(start, start + CHUNK_BYTES);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        // A zero length: the file is all sent.
        socket.write(Buffer.alloc(4));
      });
      socket.on('data', (data) => replies.push(data));
      socket.on('error', (error) => settle(() => reject(error)));
      socket.on('close', () =>
        settle(() => {
          try {
            resolve(readAnswer(Buffer.concat(replies).toString('utf8')));
          } catch (error) {
            reject(error);
          }
        })
      );
    });
  }
}

/** What clamd's answer means; throws for one that is neither. */
function readAnswer(text: string): ScanResult {
  // clamd ends its answer with a NUL.
  const answer = text.replace(/\0/g, '').trim();
  if (answer === 'stream: OK') {
    return { clean: true };
  }
  const found = /^stream: (.+) FOUND$/.exec(answer);
  if (found) {
    return { clean: false, threat: found[1] };
  }
  throw new Error(
    answer === ''
      ? 'ClamAV hung up without answering.'
      : `ClamAV could not scan the file: ${answer}`
  );
}

/**
 * The scanner the environment asks for (#1293): none unless CLAMAV_HOST
 * is set, so the virus scan is off by default; CLAMAV_PORT, if set, must
 * be a port number, or the API refuses to start, so a wrong setting is
 * seen at once rather than as every upload refused.
 */
export function scannerFromEnvironment(
  environment: Partial<Record<string, string>> = process.env
): ClamAvScanner | undefined {
  const host = environment['CLAMAV_HOST'];
  if (!host) {
    return undefined;
  }
  const port = Number(environment['CLAMAV_PORT'] ?? CLAM_AV_DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('CLAMAV_PORT must be a port number, from 1 to 65535.');
  }
  return new ClamAvScanner(host, port);
}
