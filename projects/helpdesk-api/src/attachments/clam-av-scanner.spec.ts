import { eicarTestFile } from '@helpdesk/server';
import { createServer, type Server, type Socket } from 'net';
import {
  CHUNK_BYTES,
  CLAM_AV_DEFAULT_PORT,
  ClamAvScanner,
  scannerFromEnvironment,
} from './clam-av-scanner';

// The test file's own name, and ClamAV's for its signature:
// cspell:ignore EICAR eicar Eicar INSTREAM clamd clamav CLAMAV

/** How the stand-in answers what it was sent, as ClamAV would. */
type Answer = (file: Buffer) => string | null;

/**
 * A stand-in for ClamAV's daemon on a free local port: it reads
 * `zINSTREAM\0`, then chunks (a 4-byte length, then that many bytes)
 * until a zero length, and answers with `answer(file)` and a NUL, then
 * hangs up. `null` answers nothing, and keeps the line open.
 */
async function standInClamd(answer: Answer): Promise<{
  port: number;
  server: Server;
  received: Buffer[];
  chunkSizes: number[];
}> {
  const received: Buffer[] = [];
  const chunkSizes: number[] = [];
  const server = createServer((socket: Socket) => {
    let buffered = Buffer.alloc(0);
    let commandRead = false;
    const parts: Buffer[] = [];
    socket.on('data', (data) => {
      buffered = Buffer.concat([buffered, data]);
      if (!commandRead) {
        const end = buffered.indexOf(0);
        if (end === -1) {
          return;
        }
        expect(buffered.subarray(0, end).toString()).toBe('zINSTREAM');
        buffered = buffered.subarray(end + 1);
        commandRead = true;
      }
      while (buffered.length >= 4) {
        const size = buffered.readUInt32BE(0);
        if (size === 0) {
          const file = Buffer.concat(parts);
          received.push(file);
          const reply = answer(file);
          if (reply !== null) {
            socket.end(`${reply}\0`);
          }
          return;
        }
        if (buffered.length < 4 + size) {
          return;
        }
        chunkSizes.push(size);
        parts.push(buffered.subarray(4, 4 + size));
        buffered = buffered.subarray(4 + size);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { port, server, received, chunkSizes };
}

/** ClamAV's own answers. */
const asClamAv: Answer = (file) =>
  file.equals(Buffer.from(eicarTestFile()))
    ? 'stream: Eicar-Test-Signature FOUND'
    : 'stream: OK';

// The API's virus scanner (#1293): ClamAV's daemon over TCP.
describe('ClamAvScanner', () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise((resolve) => server.close(resolve)))
    );
  });

  async function scannerFor(answer: Answer, timeoutMs?: number) {
    const clamd = await standInClamd(answer);
    servers.push(clamd.server);
    return {
      ...clamd,
      scanner: new ClamAvScanner('127.0.0.1', clamd.port, timeoutMs),
    };
  }

  it('sends the file as it is, and calls it clean when ClamAV says OK', async () => {
    const { scanner, received } = await scannerFor(asClamAv);
    const file = new TextEncoder().encode('Rows: 1,000\n');

    await expect(scanner.scan(file)).resolves.toEqual({ clean: true });
    expect(received).toEqual([Buffer.from(file)]);
  });

  it('names what ClamAV found', async () => {
    const { scanner } = await scannerFor(asClamAv);

    await expect(scanner.scan(eicarTestFile())).resolves.toEqual({
      clean: false,
      threat: 'Eicar-Test-Signature',
    });
  });

  it('sends a large file in chunks, whole', async () => {
    const { scanner, received, chunkSizes } = await scannerFor(asClamAv);
    const file = new Uint8Array(CHUNK_BYTES * 2 + 10).map(
      (_, index) => index % 251
    );

    await expect(scanner.scan(file)).resolves.toEqual({ clean: true });
    expect(chunkSizes).toEqual([CHUNK_BYTES, CHUNK_BYTES, 10]);
    expect(received[0].equals(Buffer.from(file))).toBe(true);
  });

  // Fail closed (#1293): the attachments service refuses the upload.
  it('rejects an answer that is neither OK nor FOUND', async () => {
    const { scanner } = await scannerFor(
      () => 'INSTREAM size limit exceeded. ERROR'
    );

    await expect(scanner.scan(new Uint8Array([1]))).rejects.toThrow(
      'ClamAV could not scan the file: INSTREAM size limit exceeded. ERROR'
    );
  });

  it('rejects when nothing is listening', async () => {
    const { port, server } = await standInClamd(asClamAv);
    await new Promise((resolve) => server.close(resolve));

    await expect(
      new ClamAvScanner('127.0.0.1', port).scan(new Uint8Array([1]))
    ).rejects.toThrow();
  });

  it('rejects when ClamAV does not answer in time', async () => {
    const { scanner } = await scannerFor(() => null, 200);

    await expect(scanner.scan(new Uint8Array([1]))).rejects.toThrow(
      'ClamAV did not answer in time.'
    );
  });
});

// Switched on by the environment (#1293): off unless CLAMAV_HOST is set.
describe('scannerFromEnvironment', () => {
  it('gives no scanner without CLAMAV_HOST', () => {
    expect(scannerFromEnvironment({})).toBeUndefined();
    expect(scannerFromEnvironment({ CLAMAV_HOST: '' })).toBeUndefined();
  });

  it("gives a scanner for the host, on ClamAV's port unless told otherwise", () => {
    expect(scannerFromEnvironment({ CLAMAV_HOST: 'clamav' })).toEqual(
      new ClamAvScanner('clamav', CLAM_AV_DEFAULT_PORT)
    );
    expect(
      scannerFromEnvironment({ CLAMAV_HOST: 'clamav', CLAMAV_PORT: '3311' })
    ).toEqual(new ClamAvScanner('clamav', 3311));
  });

  it.each(['0', '70000', 'clamd', '3310.5'])(
    'refuses CLAMAV_PORT %j, so a wrong setting is seen at start',
    (port) => {
      expect(() =>
        scannerFromEnvironment({ CLAMAV_HOST: 'clamav', CLAMAV_PORT: port })
      ).toThrow('CLAMAV_PORT must be a port number, from 1 to 65535.');
    }
  );
});
