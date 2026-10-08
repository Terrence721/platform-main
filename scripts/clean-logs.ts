import { join } from 'path';
import { cleanLogs } from './log-cleanup';

// Runs when VS Code opens the folder (a local folder-open task), while the
// Nx daemon and its clients may be busy, so it leaves the daemon running:
// see `cleanLogs`.
const lines = cleanLogs(join(__dirname, '..'));

for (const line of lines) {
  console.log(line);
}

if (lines.length === 0) {
  console.log('No log files found.');
}
