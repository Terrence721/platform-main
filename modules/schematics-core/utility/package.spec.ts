import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { addPackageToPackageJson } from './package';

function createTree(content: Record<string, unknown>) {
  const tree = new UnitTestTree(Tree.empty());
  tree.create('/package.json', JSON.stringify(content));
  return tree;
}

describe('addPackageToPackageJson', () => {
  it('adds a new package under an existing section', () => {
    const tree = createTree({ dependencies: {} });

    addPackageToPackageJson(tree, 'dependencies', '@ngrx/store', '^18.0.0');

    const pkg = JSON.parse(tree.readContent('/package.json'));
    expect(pkg.dependencies['@ngrx/store']).toBe('^18.0.0');
  });

  it('creates the section when it does not exist yet', () => {
    const tree = createTree({});

    addPackageToPackageJson(tree, 'dependencies', '@ngrx/store', '^18.0.0');

    const pkg = JSON.parse(tree.readContent('/package.json'));
    expect(pkg.dependencies['@ngrx/store']).toBe('^18.0.0');
  });

  it('does not overwrite an already-present package version', () => {
    const tree = createTree({ dependencies: { '@ngrx/store': '^17.0.0' } });

    addPackageToPackageJson(tree, 'dependencies', '@ngrx/store', '^18.0.0');

    const pkg = JSON.parse(tree.readContent('/package.json'));
    expect(pkg.dependencies['@ngrx/store']).toBe('^17.0.0');
  });

  it('is a no-op when package.json does not exist', () => {
    const tree = new UnitTestTree(Tree.empty());

    const result = addPackageToPackageJson(
      tree,
      'dependencies',
      '@ngrx/store',
      '^18.0.0'
    );

    expect(result.exists('/package.json')).toBe(false);
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'refuses to write an unsafe "type" key: %s',
    (unsafeKey) => {
      const tree = createTree({});

      expect(() =>
        addPackageToPackageJson(tree, unsafeKey, '@ngrx/store', '^18.0.0')
      ).toThrow(/unsafe package\.json key/);
    }
  );

  it.each(['__proto__', 'constructor', 'prototype'])(
    'refuses to write an unsafe "pkg" key: %s',
    (unsafeKey) => {
      const tree = createTree({ dependencies: {} });

      expect(() =>
        addPackageToPackageJson(tree, 'dependencies', unsafeKey, '^18.0.0')
      ).toThrow(/unsafe package\.json key/);
    }
  );
});
