import { existsSync } from 'fs';
import { createServer } from 'net';

/** The port the Angular dev server uses by default; the search starts here. */
export const FIRST_PORT = 4200;

/** The Helpdesk API's default port (main.ts); its search starts here. */
export const FIRST_API_PORT = 3000;

/** Node's debugger port, which `nx serve helpdesk-api` opens as well. */
export const DEBUGGER_PORT = 9229;

/**
 * The database's default port (compose.yaml, HELPDESK_DB_PORT): 5435, not
 * PostgreSQL's usual 5432, so it runs beside other local databases.
 */
export const DEFAULT_DB_PORT = 5435;

/**
 * Where `yarn start:helpdesk:docker` publishes the app (compose.yaml,
 * HELPDESK_APP_PORT); its search starts here. 8088, not 8080, which other
 * local tools often hold.
 */
export const FIRST_DOCKER_APP_PORT = 8088;

/**
 * One thing `yarn start:<app>` runs, and how to tell it is ready. Either a
 * long-running process (a dev server), ready once `readyUrl` answers and
 * stopped by ending its process tree; or a service (the database in
 * Docker), whose `command` finishes once it is ready and which is stopped
 * by `stopCommand`.
 */
export interface StackServer {
  name: string;
  command: string;
  /** Added to the environment the command runs in. */
  env: Record<string, string>;
  /** A process: answers once it is ready. */
  readyUrl?: string;
  /** A service: stops it (its `command` only starts it, then finishes). */
  stopCommand?: string;
  /**
   * The page the app window opens, when it is not `readyUrl`: a service
   * that serves the app itself (the Helpdesk in Docker) has no `readyUrl`.
   */
  pageUrl?: string;
  /** Every port it holds, all free again once it has stopped. */
  ports: number[];
}

/**
 * The servers `yarn start:<app>` runs, in start order. The Helpdesk runs its
 * database (Docker Compose), then its API, then the app, whose dev server
 * forwards /api to the API (see projects/helpdesk/proxy.conf.mjs);
 * `helpdesk-docker` runs all three as containers instead (compose.yaml's
 * `full` profile), from images built from the source, on `ports.app`; any
 * other app runs on its own.
 */
export function stackFor(
  app: string,
  ports: { app: number; api: number; db: number }
): StackServer[] {
  if (app === 'helpdesk-docker') {
    return [
      {
        name: 'helpdesk (Docker)',
        // Builds both images (quick when only code changed) and starts the
        // database, the API and the app; ready once all three are healthy.
        // Every run starts from fresh seed data, as with `yarn
        // start:helpdesk`: whatever an earlier run left is removed first.
        command:
          'docker compose --profile full down --volumes' +
          ' && docker compose --profile full up --build --detach --wait',
        env: { HELPDESK_APP_PORT: String(ports.app) },
        // Closing the app deletes the containers and their data.
        stopCommand: 'docker compose --profile full down --volumes',
        pageUrl: `http://localhost:${ports.app}/`,
        // compose.yaml publishes the API on 3000 and the database on db.
        ports: [ports.app, FIRST_API_PORT, ports.db],
      },
    ];
  }
  const appServer: StackServer = {
    name: app,
    command: `yarn nx serve ${app} --port ${ports.app}`,
    env: app === 'helpdesk' ? { HELPDESK_API_PORT: String(ports.api) } : {},
    readyUrl: `http://localhost:${ports.app}/`,
    ports: [ports.app],
  };
  if (app !== 'helpdesk') {
    return [appServer];
  }
  return [
    {
      name: 'database',
      // Every run starts from fresh seed data: wipe whatever an earlier run
      // left, start, migrate, seed. Ready only once all of that is done.
      command:
        'docker compose down --volumes db && docker compose up -d --wait db' +
        ' && yarn db:migrate && yarn db:seed',
      env: {},
      // Closing the app deletes the data with the container.
      stopCommand: 'docker compose down --volumes db',
      ports: [ports.db],
    },
    {
      name: 'helpdesk-api',
      command: 'yarn nx serve helpdesk-api',
      env: { PORT: String(ports.api) },
      readyUrl: `http://localhost:${ports.api}/api/health`,
      ports: [ports.api, DEBUGGER_PORT],
    },
    appServer,
  ];
}

/** Whether a server could listen on a port, on one host or on all of them. */
function canListen(port: number, host?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

/**
 * Whether nothing is listening on a port of this machine. All three checks
 * are needed on Windows, where a listener on one address does not stop a
 * new one on another: localhost (which Node resolves to ::1 first),
 * 127.0.0.1 (how Docker publishes a database to this machine only), and all
 * addresses (like the Helpdesk API).
 */
export async function isPortFree(port: number): Promise<boolean> {
  return (
    (await canListen(port, 'localhost')) &&
    (await canListen(port, '127.0.0.1')) &&
    (await canListen(port))
  );
}

/**
 * The first free port from `start` on, so a dev server left running from an
 * earlier session never blocks a new one.
 */
export async function findFreePort(
  start = FIRST_PORT,
  isFree: (port: number) => Promise<boolean> = isPortFree,
  attempts = 20
): Promise<number> {
  for (let port = start; port < start + attempts; port++) {
    if (await isFree(port)) {
      return port;
    }
  }
  throw new Error(`No free port between ${start} and ${start + attempts - 1}.`);
}

/** Where Edge, then Chrome, is usually installed on each platform. */
export function browserCandidates(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv
): string[] {
  if (platform === 'win32') {
    const roots = [
      env['ProgramFiles(x86)'],
      env['ProgramFiles'],
      env['LOCALAPPDATA'],
    ].filter((root): root is string => !!root);
    return [
      ...roots.map(
        (root) => `${root}\\Microsoft\\Edge\\Application\\msedge.exe`
      ),
      ...roots.map(
        (root) => `${root}\\Google\\Chrome\\Application\\chrome.exe`
      ),
    ];
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
  }
  return [
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
}

/** The first candidate browser that exists on this machine. */
export function findBrowser(
  candidates: string[],
  exists: (path: string) => boolean = existsSync
): string | undefined {
  return candidates.find((path) => exists(path));
}

/**
 * Opens the app in a window of its own. The separate profile makes the
 * browser start a new process instead of handing the URL to one already
 * running, so that process exits exactly when the window is closed.
 */
export function browserArgs(url: string, profileDir: string): string[] {
  return [
    `--app=${url}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-mode',
    // The new profile would otherwise install any extension registered for
    // every profile on the machine, and some open a sign-in page on install.
    '--disable-extensions',
    // Edge would otherwise sign the new profile in with the Windows account
    // and show a "We are now syncing your browsing data" popup every time.
    '--disable-features=msImplicitSignin',
  ];
}

/**
 * The command that stops a process and everything it started. The dev
 * server runs as nx -> executor -> build workers, and stopping only the top
 * process would leave a child holding the port.
 */
export function stopTreeCommand(
  pid: number,
  platform: NodeJS.Platform
): { command: string; args: string[] } {
  return platform === 'win32'
    ? { command: 'taskkill', args: ['/PID', String(pid), '/T', '/F'] }
    : { command: 'kill', args: ['-TERM', `-${pid}`] };
}

/**
 * Deletes the browser's temporary profile once nothing uses it, retrying
 * every `intervalMs` for up to `attempts` tries. Windows refuses to delete a
 * folder a process still has open, so success also proves the browser has
 * fully exited, which can be a few seconds after its window closed. Returns
 * whether it was deleted.
 */
export async function removeWhenFree(
  dir: string,
  remove: (dir: string) => void,
  attempts = 30,
  intervalMs = 1_000
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      remove(dir);
      return true;
    } catch {
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
  }
  return false;
}

/**
 * Waits until every port is free again, checking every `intervalMs` for up
 * to `timeoutMs`. Returns the ports still in use then (none, normally), so
 * the caller can say exactly what is left running.
 */
export async function waitForPortsFree(
  ports: number[],
  isFree: (port: number) => Promise<boolean> = isPortFree,
  timeoutMs = 15_000,
  intervalMs = 500
): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const busy: number[] = [];
    for (const port of ports) {
      if (!(await isFree(port))) {
        busy.push(port);
      }
    }
    if (busy.length === 0 || Date.now() >= deadline) {
      return busy;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Resolves once the dev server answers, checking every `intervalMs`; rejects
 * after `timeoutMs` (the first build can take a while).
 */
export async function waitForServer(
  url: string,
  isUp: (url: string) => Promise<boolean>,
  timeoutMs = 180_000,
  intervalMs = 1_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await isUp(url))) {
    if (Date.now() >= deadline) {
      throw new Error(`${url} did not answer within ${timeoutMs / 1000}s.`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
