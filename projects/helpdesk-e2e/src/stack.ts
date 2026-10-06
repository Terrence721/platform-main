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

/** Runs `docker compose --profile full ...` here; false if it failed. */
function compose(...args: string[]): boolean {
  const result = spawnSync(
    'docker',
    ['compose', '--profile', 'full', ...args],
    { cwd: repoRoot, stdio: 'inherit' }
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
        '(docker compose --profile full down) or set E2E_BASE_URL to ' +
        'test it as it is.'
    );
  }

  const down = () => {
    compose('down', '--volumes');
  };
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
