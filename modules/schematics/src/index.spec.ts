import * as fs from 'fs';
import * as path from 'path';

// The built package's manifest names its entry point, which must exist.
// Its `types` field (`./src/index.d.ts`) points at nothing for now: the build
// emits no declarations, and turning them on currently makes the
// `build-package` step write schematics-core's compiled files into its
// source folder too. A `types` check belongs here once that is fixed.
describe('published package', () => {
  const dist = path.join(process.cwd(), 'dist/modules/schematics');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, 'package.json'), 'utf8')
  ) as { main: string };

  it('should ship the file its main field names', () => {
    expect(fs.existsSync(path.join(dist, manifest.main))).toBe(true);
  });
});
