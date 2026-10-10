import type { FullConfig } from '@playwright/test';
import { spawnSync } from 'child_process';
import { join } from 'path';

// Playwright's global setup (#986): starts the whole help desk in Docker
// Compose (database, then the API, which migrates and seeds it, then the
// app's nginx) and answers with the teardown, which removes it again,
// database included, so every run starts from a fresh seed. With
// E2E_BASE_URL set, the tests use that stack as it is and this does
// nothing.

const repoRoot = join(__dirname, '..', '..', '..');

/**
 * Whether this run has the virus scan on (#1293): E2E_SCAN=1 starts the
 * stack with ClamAV (compose.yaml's `scan` profile) and the API pointed at
 * it, and runs virus-scan.spec.ts, which is skipped otherwise. Slower to
 * start, as ClamAV loads its signatures, so off unless asked for.
 */
export function scanOn(): boolean {
  return process.env['E2E_SCAN'] === '1';
}

/** Runs `docker compose --profile full ...` here; false if it failed. */
export function compose(...args: string[]): boolean {
  return composeWith({}, ...args);
}

/**
 * Runs `docker compose --profile full ...` here with `env` added to the
 * environment, which Compose reads (such as HELPDESK_JWT_SECRET); false if
 * it failed.
 */
export function composeWith(
  env: Record<string, string>,
  ...args: string[]
): boolean {
  // With the scan, ClamAV too, and the API told where it is.
  // Its service's name: cspell:ignore CLAMAV clamav
  const scan = scanOn();
  const result = spawnSync(
    'docker',
    [
      'compose',
      '--profile',
      'full',
      ...(scan ? ['--profile', 'scan'] : []),
      ...args,
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(scan && { HELPDESK_CLAMAV_HOST: 'clamav' }),
        ...env,
      },
    }
  );
  return result.status === 0;
}

/** Whether the app answers, through to the API (`/api/health`). */
async function answers(baseUrl: string): Promise<boolean> {
  try {
    return (await fetch(new URL('/api/health', baseUrl))).ok;
  } catch {
    return false;
  }
}

export default async function stack(
  config: FullConfig
): Promise<(() => void) | undefined> {
  if (process.env['E2E_BASE_URL'] !== undefined) {
    return undefined;
  }
  const baseUrl = String(config.projects[0].use.baseURL);
  // Something there already would be tested instead, with its old data.
  if (await answers(baseUrl)) {
    throw new Error(
      `A help desk already answers at ${baseUrl}. Stop it ` +
        '(docker compose --profile full down --volumes) or set ' +
        'E2E_BASE_URL to test it as it is.'
    );
  }

  const down = () => {
    compose('down', '--volumes');
  };
  // A run cut short (a crash, a reboot) can leave stopped containers and its
  // database behind. The API seeds only a database with no users, so the
  // tests would run on what that run changed: clear it first (#1286).
  down();
  if (!compose('up', '--build', '--detach', '--wait')) {
    compose('logs', 'api', 'app');
    down();
    throw new Error('The help desk did not start (logs above).');
  }
  if (!(await answers(baseUrl))) {
    down();
    throw new Error(`The help desk started but ${baseUrl} doesn't answer.`);
  }
  return down;
}
