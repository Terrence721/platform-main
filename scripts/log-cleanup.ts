import { readdirSync, rmSync, writeFileSync } from 'fs';
import { basename, join } from 'path';

/** Folders never searched: installed packages, git's own, and build output. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'tmp']);

/** The Nx daemon's log, which a running daemon keeps writing to. */
const DAEMON_LOG = 'daemon.log';

function findLogFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        found.push(...findLogFiles(join(dir, entry.name)));
      }
    } else if (entry.isFile() && entry.name.endsWith('.log')) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

/**
 * Clears the repo's stale logs, safely while the Nx daemon runs: it is
 * neither stopped nor hidden. Stopping it while Nx Console or another
 * client is mid-request breaks their connection (EPIPE), and Nx then
 * disables the daemon until `nx reset`; deleting its `server-process.json`
 * hides it, so a second daemon starts and the two fight. So the daemon's
 * own log is emptied, not deleted, `server-process.json` is left alone,
 * and every other `*.log` file is removed. Returns a line per file.
 */
export function cleanLogs(root: string): string[] {
  return findLogFiles(root).map((path) => {
    if (basename(path) === DAEMON_LOG) {
      writeFileSync(path, '');
      return `Emptied ${path}`;
    }
    rmSync(path, { force: true });
    return `Removed ${path}`;
  });
}
