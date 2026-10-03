import { ChildProcess, spawn, spawnSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  browserArgs,
  browserCandidates,
  DEFAULT_DB_PORT,
  findBrowser,
  findFreePort,
  FIRST_API_PORT,
  FIRST_PORT,
  isPortFree,
  removeWhenFree,
  stackFor,
  StackServer,
  stopTreeCommand,
  waitForPortsFree,
  waitForServer,
} from './app-launcher';

// Starts an app and everything it needs (for the Helpdesk: its API, then the
// app), opens the app in a window of its own, and stops EVERYTHING together
// when that window is closed, on Ctrl+C, or when any of its servers stops,
// then checks that every port they held is free again.
// Usage: npx tsx scripts/start-app.ts <app>   (e.g. `yarn start:helpdesk`)

const app = process.argv[2] ?? '';
if (!/^[a-z0-9-]+$/.test(app)) {
  console.error('Usage: npx tsx scripts/start-app.ts <app>');
  process.exit(1);
}

const repoRoot = join(__dirname, '..');

// .env (copied from .env.example) can change the database's port; Docker
// Compose reads the same file, so both agree.
const envFile = join(repoRoot, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

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

/** "4200", "4200 and 3000", "4200, 3000 and 9229". */
function listPorts(ports: number[]): string {
  return ports.length < 2
    ? ports.join('')
    : `${ports.slice(0, -1).join(', ')} and ${ports[ports.length - 1]}`;
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

  const appPort = await findFreePort(FIRST_PORT);
  const apiPort = await findFreePort(FIRST_API_PORT);
  const dbPort = Number(process.env['HELPDESK_DB_PORT'] ?? DEFAULT_DB_PORT);
  const stack = stackFor(app, { app: appPort, api: apiPort, db: dbPort });

  // The database's port must be free, unless this project's own database
  // was left running (the start wipes and recreates it anyway). Otherwise
  // Docker fails with "port is already allocated", which says nothing
  // about what to do.
  const hasDatabase = stack.some((server) => server.stopCommand !== undefined);
  const ownDatabaseRunning =
    hasDatabase &&
    (
      spawnSync('docker compose ps --status running --services', {
        cwd: repoRoot,
        shell: true,
        encoding: 'utf8',
      }).stdout ?? ''
    )
      .split(/\r?\n/)
      .includes('db');
  if (hasDatabase && !ownDatabaseRunning && !(await isPortFree(dbPort))) {
    throw new Error(
      `Port ${dbPort} is in use, so the Helpdesk database cannot start. ` +
        'Stop what uses it, or set HELPDESK_DB_PORT in .env (see .env.example).'
    );
  }

  // Only ports free now (or held by our own database) are checked
  // afterwards: one held by something else (e.g. a debugger from another
  // project on 9229) is not ours to wait for.
  const ours: number[] = [];
  for (const port of stack.flatMap((server) => server.ports)) {
    if ((ownDatabaseRunning && port === dbPort) || (await isPortFree(port))) {
      ours.push(port);
    }
  }

  // The window opens on the last server's page: the app.
  const url = stack[stack.length - 1].readyUrl;
  if (url === undefined) {
    throw new Error(`${app} has no page to open.`);
  }
  const profileDir = mkdtempSync(join(tmpdir(), `${app}-window-`));
  const running: ChildProcess[] = [];
  // Services (the database) started so far, stopped by their stopCommand.
  const services: StackServer[] = [];
  // Set once every server answers; shutdown() can run before that.
  let browser: ChildProcess | undefined = undefined;
  let stopping = false;

  const shutdown = async (reason: string, code: number): Promise<void> => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log(`\n${reason}; stopping everything.`);
    stopTree(browser);
    const removed = await removeWhenFree(profileDir, (dir) =>
      rmSync(dir, { recursive: true, force: true })
    );
    // The app first, then what it depends on; the database last.
    for (const child of [...running].reverse()) {
      stopTree(child);
    }
    for (const service of [...services].reverse()) {
      if (service.stopCommand !== undefined) {
        console.log(`Stopping ${service.name}.`);
        spawnSync(service.stopCommand, {
          cwd: repoRoot,
          stdio: 'inherit',
          shell: true,
        });
      }
    }
    if (!removed) {
      console.warn(`Could not delete the window's profile: ${profileDir}`);
    }
    const busy = await waitForPortsFree(ours);
    if (busy.length === 0) {
      console.log(`Everything stopped. Ports ${listPorts(ours)} are free.`);
    } else {
      console.warn(
        `Still in use after stopping: port ${listPorts(busy)}. ` +
          'Something is still running; check Task Manager for node.exe.'
      );
      code = code || 1;
    }
    process.exit(code);
  };

  process.once('SIGINT', () => void shutdown('Interrupted', 130));
  process.once('SIGTERM', () => void shutdown('Terminated', 143));

  // Each server runs in its own process group (detached outside Windows),
  // so its whole tree can be stopped at once.
  const start = (server: StackServer): ChildProcess => {
    const child = spawn(server.command, {
      cwd: repoRoot,
      env: { ...process.env, ...server.env },
      stdio: 'inherit',
      shell: true,
      detached: process.platform !== 'win32',
    });
    running.push(child);
    child.once(
      'exit',
      () => void shutdown(`${server.name} stopped`, stopping ? 0 : 1)
    );
    return child;
  };

  // A service's command starts it and finishes once it is ready (for the
  // database, `docker compose up --wait` waits for its health check).
  const runToEnd = (server: StackServer): Promise<number> =>
    new Promise((resolve) => {
      const child = spawn(server.command, {
        cwd: repoRoot,
        env: { ...process.env, ...server.env },
        stdio: 'inherit',
        shell: true,
      });
      child.once('error', () => resolve(1));
      child.once('exit', (code) => resolve(code ?? 1));
    });

  for (const server of stack) {
    if (server.readyUrl === undefined) {
      console.log(`Starting ${server.name}.`);
      // Listed before it starts, so a half-started service is stopped too.
      services.push(server);
      const code = await runToEnd(server);
      if (stopping) {
        return;
      }
      if (code !== 0) {
        await shutdown(
          `${server.name} did not start (exit code ${code}; is Docker Desktop running?)`,
          1
        );
        return;
      }
      continue;
    }

    console.log(`Starting ${server.name}: ${server.readyUrl}`);
    start(server);
    try {
      await waitForServer(server.readyUrl, isUp);
    } catch (error) {
      // Never leave the servers already started running.
      const why = error instanceof Error ? error.message : String(error);
      await shutdown(`${server.name} did not start (${why})`, 1);
      return;
    }
    if (stopping) {
      return;
    }
  }

  console.log(`Opening ${url} in its own window; close it to stop everything.`);
  browser = spawn(browserPath, browserArgs(url, profileDir), {
    stdio: 'ignore',
  });
  browser.once('exit', () => void shutdown('The app window was closed', 0));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
