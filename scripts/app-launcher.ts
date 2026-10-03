import { existsSync } from 'fs';
import { createServer } from 'net';

/** The port the Angular dev server uses by default; the search starts here. */
export const FIRST_PORT = 4200;

/** The Helpdesk API's default port (main.ts); its search starts here. */
export const FIRST_API_PORT = 3000;

/** Node's debugger port, which `nx serve helpdesk-api` opens as well. */
export const DEBUGGER_PORT = 9229;

/** One process `yarn start:<app>` runs, and how to tell it is ready. */
export interface StackServer {
  name: string;
  command: string;
  /** Added to the environment the command runs in. */
  env: Record<string, string>;
  /** Answers once the server is ready. */
  readyUrl: string;
  /** Every port the server holds, all free again once it has stopped. */
  ports: number[];
}

/**
 * The servers `yarn start:<app>` runs, in start order. The Helpdesk runs its
 * API first, then the app, whose dev server forwards /api to it (see
 * projects/helpdesk/proxy.conf.mjs); any other app runs on its own.
 */
export function stackFor(
  app: string,
  ports: { app: number; api: number }
): StackServer[] {
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
 * Whether nothing is listening on a port of this machine. Both checks are
 * needed: a server on all addresses (like the Helpdesk API) does not stop a
 * new listener on localhost on Windows, and the reverse also happens.
 */
export async function isPortFree(port: number): Promise<boolean> {
  return (await canListen(port, 'localhost')) && (await canListen(port));
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
