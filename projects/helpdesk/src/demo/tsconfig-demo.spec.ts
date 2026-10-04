// @vitest-environment node
// Reads the two tsconfig files from disk, which needs Node.
import { readConfigFile, sys } from 'typescript';
import { fileURLToPath } from 'url';

/** A tsconfig's `paths`, read as TypeScript reads them (comments allowed). */
function pathsOf(file: string): Record<string, string[]> {
  const { config, error } = readConfigFile(
    fileURLToPath(new URL(file, import.meta.url)),
    sys.readFile
  );
  if (error) {
    throw new Error(`Cannot read ${file}`);
  }
  return config.compilerOptions.paths;
}

const root = pathsOf('../../../../tsconfig.json');
const demo = pathsOf('../../tsconfig.demo.json');

describe('tsconfig.demo.json', () => {
  it("repeats every path of the root tsconfig.json, unchanged (its own paths replace the root's)", () => {
    expect(demo).toMatchObject(root);
  });

  it('points Nest and the two Node modules the services use at the browser stand-ins', () => {
    expect(demo).toMatchObject({
      '@nestjs/common': ['./projects/helpdesk/src/demo/nest-shim.ts'],
      crypto: ['./projects/helpdesk/src/demo/crypto-shim.ts'],
      util: ['./projects/helpdesk/src/demo/util-shim.ts'],
    });
  });

  it('adds nothing else', () => {
    expect(Object.keys(demo).sort()).toEqual(
      [...Object.keys(root), '@nestjs/common', 'crypto', 'util'].sort()
    );
  });
});
