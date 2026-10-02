import { ChildProcess, spawn, spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  browserArgs,
  browserCandidates,
  findBrowser,
  findFreePort,
  removeWhenFree,
  stopTreeCommand,
  waitForServer,
} from './app-launcher';

// Starts an app's dev server, opens the app in a window of its own, and stops
// the server (releasing its port) when that window is closed or on Ctrl+C.
// Usage: npx tsx scripts/start-app.ts <app>   (e.g. `yarn start:helpdesk`)

const app = process.argv[2] ?? '';
if (!/^[a-z0-9-]+$/.test(app)) {
  console.error('Usage: npx tsx scripts/start-app.ts <app>');
  process.exit(1);
}

const repoRoot = join(__dirname, '..');

async function isUp(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

function stopTree(child: ChildProcess | undefined): void {
  if (child?.pid === undefined || child.exitCode !== null) {
    return;
  }
  const { command, args } = stopTreeCommand(child.pid, process.platform);
  spawnSync(command, args, { stdio: 'ignore' });
}

async function main(): Promise<void> {
  const browserPath = findBrowser(
    browserCandidates(process.platform, process.env)
  );
  if (!browserPath) {
    throw new Error(
      `Neither Edge nor Chrome was found; run "yarn nx serve ${app}" instead.`
    );
  }

  const port = await findFreePort();
  const url = `http://localhost:${port}/`;
  const profileDir = mkdtempSync(join(tmpdir(), `${app}-window-`));
  // Set once the server answers; shutdown() can run before that.
  let browser: ChildProcess | undefined = undefined;
  let stopping = false;

  // The server runs in its own process group (detached outside Windows), so
  // the whole tree can be stopped at once.
  console.log(`Starting ${app} on ${url}`);
  const server = spawn(`yarn nx serve ${app} --port ${port}`, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
    detached: process.platform !== 'win32',
  });

  const shutdown = async (reason: string, code: number): Promise<void> => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log(`\n${reason}; stopping ${app}.`);
    stopTree(browser);
    const removed = await removeWhenFree(profileDir, (dir) =>
      rmSync(dir, { recursive: true, force: true })
    );
    stopTree(server);
    if (!removed) {
      console.warn(`Could not delete the window's profile: ${profileDir}`);
    }
    console.log(`Port ${port} is free.`);
    process.exit(code);
  };

  server.once('exit', () => void shutdown('The dev server stopped', 1));
  process.once('SIGINT', () => void shutdown('Interrupted', 130));
  process.once('SIGTERM', () => void shutdown('Terminated', 143));

  await waitForServer(url, isUp);
  if (stopping) {
    return;
  }
  console.log(`Opening ${url} in its own window; close it to stop ${app}.`);
  browser = spawn(browserPath, browserArgs(url, profileDir), {
    stdio: 'ignore',
  });
  browser.once('exit', () => void shutdown('The app window was closed', 0));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
