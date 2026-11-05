import { setTimeout as delay } from 'node:timers/promises';

const base = process.env['DEPLOY_URL'] || process.argv[2];
if (!base) {
  console.error(
    'Usage: DEPLOY_URL=https://example.com yarn deploy:verify, or pass the URL as an argument.'
  );
  process.exit(1);
}

const url = (path: string) => new URL(path, base).toString();

async function fetchOk(path: string): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const response = await fetch(url(path));
      if (response.ok) return;
      console.error(`${path}: HTTP ${response.status} (attempt ${attempt}/30)`);
    } catch (error) {
      console.error(
        `${path}: ${error instanceof Error ? error.message : String(error)} (attempt ${attempt}/30)`
      );
    }
    await delay(5000);
  }
  throw new Error(`${path} did not become healthy`);
}

await fetchOk('/api/health');
await fetchOk('/');
console.log(`Deployment smoke checks passed for ${base}.`);
