import { createServer, AddressInfo } from 'net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  browserArgs,
  browserCandidates,
  DEBUGGER_PORT,
  findBrowser,
  findFreePort,
  FIRST_API_PORT,
  FIRST_PORT,
  isPortFree,
  removeWhenFree,
  stackFor,
  stopTreeCommand,
  waitForPortsFree,
  waitForServer,
} from './app-launcher';

afterEach(() => {
  vi.useRealTimers();
});

describe('isPortFree', () => {
  it('reports a port in use as taken, and free again once released', async () => {
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, 'localhost', resolve)
    );
    const { port } = server.address() as AddressInfo;

    expect(await isPortFree(port)).toBe(false);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(await isPortFree(port)).toBe(true);
  });
});

describe('findFreePort', () => {
  it('starts at the dev server default', async () => {
    expect(FIRST_PORT).toBe(4200);
    expect(await findFreePort(undefined, async () => true)).toBe(4200);
  });

  it('skips ports in use', async () => {
    const busy = new Set([4200, 4201]);
    expect(await findFreePort(4200, async (port) => !busy.has(port))).toBe(
      4202
    );
  });

  it('fails clearly when every port it tries is in use', async () => {
    await expect(findFreePort(4200, async () => false, 3)).rejects.toThrow(
      'No free port between 4200 and 4202.'
    );
  });
});

describe('browserCandidates / findBrowser', () => {
  it('looks for Edge, then Chrome, in each Windows install location', () => {
    expect(
      browserCandidates('win32', {
        'ProgramFiles(x86)': 'C:\\PF86',
        ProgramFiles: 'C:\\PF',
        LOCALAPPDATA: 'C:\\Local',
      })
    ).toEqual([
      'C:\\PF86\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\PF\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\PF86\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\PF\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Local\\Google\\Chrome\\Application\\chrome.exe',
    ]);
  });

  it('skips Windows locations whose variable is not set', () => {
    expect(browserCandidates('win32', { ProgramFiles: 'C:\\PF' })).toEqual([
      'C:\\PF\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\PF\\Google\\Chrome\\Application\\chrome.exe',
    ]);
  });

  it('has Edge, then Chrome, on macOS and Linux', () => {
    expect(browserCandidates('darwin', {})[0]).toContain('Microsoft Edge');
    expect(browserCandidates('darwin', {})[1]).toContain('Google Chrome');
    expect(browserCandidates('linux', {})).toEqual([
      '/usr/bin/microsoft-edge',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
    ]);
  });

  it('picks the first candidate that exists', () => {
    const installed = new Set(['/b', '/c']);
    expect(findBrowser(['/a', '/b', '/c'], (path) => installed.has(path))).toBe(
      '/b'
    );
    expect(findBrowser(['/a'], () => false)).toBeUndefined();
  });
});

describe('browserArgs', () => {
  it('opens the app in its own window with a separate profile and no extensions', () => {
    expect(browserArgs('http://localhost:4201/', 'C:\\tmp\\profile')).toEqual([
      '--app=http://localhost:4201/',
      '--user-data-dir=C:\\tmp\\profile',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-mode',
      '--disable-extensions',
    ]);
  });
});

describe('stopTreeCommand', () => {
  it('stops the whole process tree on Windows', () => {
    expect(stopTreeCommand(1234, 'win32')).toEqual({
      command: 'taskkill',
      args: ['/PID', '1234', '/T', '/F'],
    });
  });

  it('stops the whole process group elsewhere', () => {
    expect(stopTreeCommand(1234, 'linux')).toEqual({
      command: 'kill',
      args: ['-TERM', '-1234'],
    });
  });
});

describe('removeWhenFree', () => {
  it('retries until the folder can be deleted', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const remove = vi.fn(() => {
      if (++calls < 3) throw new Error('EBUSY');
    });

    const result = removeWhenFree('dir', remove, 5, 1_000);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await result).toBe(true);
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it('gives up after its attempts', async () => {
    vi.useFakeTimers();
    const remove = vi.fn(() => {
      throw new Error('EBUSY');
    });

    const result = removeWhenFree('dir', remove, 3, 1_000);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(await result).toBe(false);
    expect(remove).toHaveBeenCalledTimes(3);
  });
});

describe('isPortFree, against a server on every address', () => {
  // The Helpdesk API listens on all addresses, not just localhost; its port
  // must still count as taken, or the launcher would report it free early.
  it('reports the port as taken while that server runs', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    expect(await isPortFree(port)).toBe(false);

    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(await isPortFree(port)).toBe(true);
  });
});

describe('stackFor', () => {
  it('runs the Helpdesk API first, then the app that forwards /api to it', () => {
    expect(stackFor('helpdesk', { app: 4200, api: 3000 })).toEqual([
      {
        name: 'helpdesk-api',
        command: 'yarn nx serve helpdesk-api',
        env: { PORT: '3000' },
        readyUrl: 'http://localhost:3000/api/health',
        ports: [3000, DEBUGGER_PORT],
      },
      {
        name: 'helpdesk',
        command: 'yarn nx serve helpdesk --port 4200',
        env: { HELPDESK_API_PORT: '3000' },
        readyUrl: 'http://localhost:4200/',
        ports: [4200],
      },
    ]);
  });

  it('passes on the ports it was given, not the defaults', () => {
    const [api, app] = stackFor('helpdesk', { app: 4201, api: 3002 });

    expect(api.env).toEqual({ PORT: '3002' });
    expect(api.ports).toEqual([3002, DEBUGGER_PORT]);
    expect(app.env).toEqual({ HELPDESK_API_PORT: '3002' });
    expect(app.command).toBe('yarn nx serve helpdesk --port 4201');
  });

  it('runs any other app on its own', () => {
    expect(stackFor('other-app', { app: 4200, api: 3000 })).toEqual([
      {
        name: 'other-app',
        command: 'yarn nx serve other-app --port 4200',
        env: {},
        readyUrl: 'http://localhost:4200/',
        ports: [4200],
      },
    ]);
  });

  it('starts the API port search at its default', () => {
    expect(FIRST_API_PORT).toBe(3000);
  });
});

describe('waitForPortsFree', () => {
  it('returns no ports once every one is free', async () => {
    vi.useFakeTimers();
    // 3000 is still held for the first two checks, then released.
    let apiChecks = 0;
    const result = waitForPortsFree([4200, 3000], async (port) =>
      port === 3000 ? ++apiChecks > 2 : true
    );
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toEqual([]);
    expect(apiChecks).toBe(3);
  });

  it('checks every port each round', async () => {
    const isFree = vi.fn(async () => true);

    await waitForPortsFree([4200, 3000, DEBUGGER_PORT], isFree);

    expect(isFree.mock.calls.map(([port]) => port)).toEqual([
      4200,
      3000,
      DEBUGGER_PORT,
    ]);
  });

  it('returns the ports still in use when time runs out', async () => {
    vi.useFakeTimers();
    const result = waitForPortsFree(
      [4200, 3000, DEBUGGER_PORT],
      async (port) => port === 4200,
      5_000,
      500
    );
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(result).resolves.toEqual([3000, DEBUGGER_PORT]);
  });
});

describe('waitForServer', () => {
  it('resolves once the server answers', async () => {
    vi.useFakeTimers();
    let checks = 0;
    const isUp = vi.fn(async () => ++checks >= 3);

    const result = waitForServer('http://localhost:4200/', isUp, 60_000, 1_000);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBeUndefined();
    expect(isUp).toHaveBeenCalledTimes(3);
  });

  it('fails after its timeout', async () => {
    vi.useFakeTimers();
    const result = waitForServer(
      'http://localhost:4200/',
      async () => false,
      5_000,
      1_000
    );
    const failure = expect(result).rejects.toThrow(
      'http://localhost:4200/ did not answer within 5s.'
    );
    await vi.advanceTimersByTimeAsync(6_000);

    await failure;
  });
});
