import * as fs from 'fs';
import * as path from 'path';

// The built package's manifest names its entry point and its declarations,
// which must both exist.
describe('published package', () => {
  const dist = path.join(process.cwd(), 'dist/modules/schematics');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, 'package.json'), 'utf8')
  ) as { main: string; types: string };

  it('should ship the file its main field names', () => {
    expect(fs.existsSync(path.join(dist, manifest.main))).toBe(true);
  });

  it('should ship the declarations its types field names', () => {
    expect(fs.existsSync(path.join(dist, manifest.types))).toBe(true);
  });
});

// The build compiles only this package: schematics-core is a project
// reference, built by its own target, so no compiled file lands next to its
// sources (#478).
describe('schematics-core sources', () => {
  it('should hold no compiled output', () => {
    const root = path.join(process.cwd(), 'modules/schematics-core');
    const compiled = (fs.readdirSync(root, { recursive: true }) as string[])
      .filter((file) => !file.split(/[\\/]/).includes('node_modules'))
      .filter((file) => /\.(js|js\.map|d\.ts)$/.test(file));
    expect(compiled).toEqual([]);
  });
});
