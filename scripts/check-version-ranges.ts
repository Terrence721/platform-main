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
 * Ranges that are allowed to differ from the other modules', each pinned to its
 * exact current value; the check fails when one goes stale, so the list can
 * only shrink. None today. Adding one changes what consumers may install, so
 * it should be a deliberate decision.
 */
const deviations: Deviation[] = [];

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
