import { readdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const repoRoot = join(__dirname, '..');
const skipDirs = new Set(['node_modules', '.git', 'dist', 'tmp']);

try {
  execSync('npx nx daemon --stop', { stdio: 'ignore' });
} catch {
  // daemon wasn't running — nothing to stop
}

function findLogFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        found.push(...findLogFiles(join(dir, entry.name)));
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.log') || entry.name === 'server-process.json') {
        found.push(join(dir, entry.name));
      }
    }
  }
  return found;
}

const logFiles = findLogFiles(repoRoot);

for (const filePath of logFiles) {
  rmSync(filePath, { force: true });
  console.log(`Removed ${filePath}`);
}

if (logFiles.length === 0) {
  console.log('No log files found.');
}
