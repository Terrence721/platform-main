import { spawnSync } from 'child_process';

function commandAvailable(command: string, args: string[] = []): boolean {
  return (
    spawnSync(command, args, { stdio: 'ignore', shell: true }).status === 0
  );
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

if (!commandAvailable('docker', ['version'])) {
  console.error(
    'Docker is not available. Start Docker Desktop before running e2e tests.'
  );
  process.exit(1);
}

if (!commandAvailable('docker', ['compose', 'version'])) {
  console.error('Docker Compose is not available.');
  process.exit(1);
}

if (process.env.E2E_BASE_URL !== undefined) {
  console.warn(
    `E2E_BASE_URL is set to ${process.env.E2E_BASE_URL}; ` +
      'unset it when you want Playwright to manage the stack itself.'
  );
}

console.log('Installing the Playwright Chromium browser if needed...');
run('yarn', ['playwright', 'install', 'chromium']);

let health = '';
try {
  const response = spawnSync(
    'curl',
    ['-s', 'http://localhost:8088/api/health'],
    {
      encoding: 'utf8',
    }
  );
  health = response.stdout ?? '';
} catch {
  health = '';
}

if (health.includes('"status":"ok"')) {
  console.warn(
    'A help desk stack is already running on localhost:8088. ' +
      'Run `docker compose --profile full down --volumes` before a fresh e2e run.'
  );
} else {
  console.log('localhost:8088 is free for a fresh e2e stack.');
}

console.log('E2E environment is ready.');
