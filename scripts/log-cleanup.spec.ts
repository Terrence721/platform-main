import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanLogs } from './log-cleanup';

describe('cleanLogs', () => {
  let root: string;
  /** The Nx daemon's own folder, as `.nx/workspace-data/d` in the repo. */
  let daemonDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'clean-logs-'));
    daemonDir = join(root, '.nx', 'workspace-data', 'd');
    mkdirSync(daemonDir, { recursive: true });
    mkdirSync(join(root, 'projects', 'app'), { recursive: true });
    mkdirSync(join(root, 'node_modules', 'some-package'), { recursive: true });
    writeFileSync(join(daemonDir, 'daemon.log'), 'old daemon lines');
    writeFileSync(join(daemonDir, 'server-process.json'), '{"processId":1}');
    writeFileSync(join(root, 'projects', 'app', 'debug.log'), 'old');
    writeFileSync(join(root, 'node_modules', 'some-package', 'keep.log'), 'x');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('deletes the logs outside the daemon, but not in node_modules', () => {
    cleanLogs(root);

    expect(existsSync(join(root, 'projects', 'app', 'debug.log'))).toBe(false);
    expect(
      existsSync(join(root, 'node_modules', 'some-package', 'keep.log'))
    ).toBe(true);
  });

  // A running daemon keeps writing to its log, and clients find it through
  // server-process.json: deleting that hides it, so a second daemon
  // starts, and a client cut off mid-request makes Nx disable the daemon
  // until `nx reset`.
  it("empties the daemon's log rather than deleting it", () => {
    cleanLogs(root);

    expect(readFileSync(join(daemonDir, 'daemon.log'), 'utf8')).toBe('');
  });

  it('leaves server-process.json alone', () => {
    cleanLogs(root);

    expect(readFileSync(join(daemonDir, 'server-process.json'), 'utf8')).toBe(
      '{"processId":1}'
    );
  });

  it('says what it did with each log', () => {
    expect(cleanLogs(root)).toEqual([
      `Emptied ${join(daemonDir, 'daemon.log')}`,
      `Removed ${join(root, 'projects', 'app', 'debug.log')}`,
    ]);
  });
});
