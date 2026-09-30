import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { traverseFolder } from '../../src/utils';

describe('traverseFolder', () => {
  let root: string;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'traverse-folder-'));
    fs.mkdirSync(path.join(root, 'store', 'nested'), { recursive: true });
    for (const file of [
      'index.ts',
      'notes.md',
      'store/rule-a.ts',
      'store/rule-b.js',
      'store/nested/rule-c.ts',
    ]) {
      fs.writeFileSync(path.join(root, file), '');
    }
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('yields the files with the given extensions in every subfolder', () => {
    const entries = [...traverseFolder(root, ['.ts'])].sort((a, b) =>
      a.path.localeCompare(b.path)
    );

    expect(entries).toEqual([
      { folder: root, file: 'index', path: path.join(root, 'index.ts') },
      {
        folder: path.join(root, 'store', 'nested'),
        file: 'rule-c',
        path: path.join(root, 'store', 'nested', 'rule-c.ts'),
      },
      {
        folder: path.join(root, 'store'),
        file: 'rule-a',
        path: path.join(root, 'store', 'rule-a.ts'),
      },
    ]);
  });

  it('matches any of several extensions', () => {
    const files = [...traverseFolder(root, ['.ts', '.js'])]
      .map(({ file }) => file)
      .sort();

    expect(files).toEqual(['index', 'rule-a', 'rule-b', 'rule-c']);
  });
});
