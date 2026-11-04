import { spawnSync } from 'child_process';

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

if (process.env.E2E_BASE_URL !== undefined) {
  console.warn(
    `Ignoring E2E_BASE_URL=${process.env.E2E_BASE_URL} for a managed e2e run.`
  );
}

delete process.env.E2E_BASE_URL;

console.log('Stopping any leftover help desk stack...');
run('docker', ['compose', '--profile', 'full', 'down']);

console.log('Installing the Playwright Chromium browser if needed...');
run('yarn', ['playwright', 'install', 'chromium']);

console.log('Running the end-to-end suite on a fresh stack...');
run('yarn', ['nx', 'e2e', 'helpdesk-e2e']);
