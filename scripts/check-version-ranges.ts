import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  Deviation,
  Manifest,
  ModuleManifest,
  findRangeProblems,
} from './version-ranges';

const repoRoot = join(__dirname, '..');
const modulesDir = join(repoRoot, 'modules');

/**
 * Ranges that predate this check and differ from the other modules'. Each is
 * pinned to its exact current value, and the check fails when one goes stale,
 * so this list can only shrink. Aligning them changes what consumers may
 * install, so that is a separate, deliberate decision.
 */
const deviations: Deviation[] = [
  { module: 'operators', name: 'rxjs', range: '^6.5.3 || ^7.4.0' },
  { module: 'operators', name: 'tslib', range: '^2.3.0' },
  { module: 'signals', name: 'rxjs', range: '^6.5.3 || ^7.4.0' },
  { module: 'signals', name: 'tslib', range: '^2.3.0' },
];

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const modules: ModuleManifest[] = readdirSync(modulesDir, {
  withFileTypes: true,
})
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(join(modulesDir, entry.name, 'package.json'))
  )
  .map((entry) => ({
    module: entry.name,
    manifest: readManifest(join(modulesDir, entry.name, 'package.json')),
  }));

const problems = findRangeProblems(
  readManifest(join(repoRoot, 'package.json')),
  modules,
  deviations
);

if (problems.length > 0) {
  console.error(`Found ${problems.length} version range problem(s):\n`);
  for (const problem of problems) {
    console.error(`  - ${problem}\n`);
  }
  process.exitCode = 1;
} else {
  console.log(`Version ranges OK: checked ${modules.length} module manifests.`);
}
