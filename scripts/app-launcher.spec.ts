import { createServer, AddressInfo } from 'net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  browserArgs,
  browserCandidates,
  findBrowser,
  findFreePort,
  FIRST_PORT,
  isPortFree,
  removeWhenFree,
  stopTreeCommand,
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
  it('opens the app in its own window with a separate profile', () => {
    expect(browserArgs('http://localhost:4201/', 'C:\\tmp\\profile')).toEqual([
      '--app=http://localhost:4201/',
      '--user-data-dir=C:\\tmp\\profile',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-mode',
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
