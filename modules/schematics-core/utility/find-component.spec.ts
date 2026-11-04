import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { findComponent, findComponentFromOptions } from './find-component';

describe('find-component utilities', () => {
  describe('findComponent', () => {
    it('returns the single component in the target directory', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/foo.component.ts', 'export class FooComponent {}');

      expect(findComponent(tree, 'src/app')).toBe('/src/app/foo.component.ts');
    });

    it('throws when more than one component matches', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/foo.component.ts', 'export class FooComponent {}');
      tree.create('/src/app/bar.component.ts', 'export class BarComponent {}');

      expect(() => findComponent(tree, 'src/app')).toThrow(
        'More than one component matches'
      );
    });

    it('throws when no component can be found', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/readme.md', 'no component here');

      expect(() => findComponent(tree, 'src/app')).toThrow(
        'Could not find an Component'
      );
    });
  });

  describe('findComponentFromOptions', () => {
    it('returns undefined when skipImport is set', () => {
      const tree = new UnitTestTree(Tree.empty());

      expect(
        findComponentFromOptions(tree, {
          name: 'foo',
          skipImport: true,
        })
      ).toBeUndefined();
    });

    it('finds the closest component when no explicit component is provided', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/foo.component.ts', 'export class FooComponent {}');

      expect(
        findComponentFromOptions(tree, {
          name: 'foo',
          path: 'src/app',
          flat: true,
        })
      ).toBe('/src/app/foo.component.ts');
    });

    it('returns an explicit component path that exists', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/bar.ts', 'export class BarComponent {}');

      expect(
        findComponentFromOptions(tree, {
          name: 'foo',
          path: 'src/app',
          component: 'bar',
        })
      ).toBe('/src/app/bar.ts');
    });

    it('appends .ts when the explicit component path exists without an extension', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/bar.ts', 'export class BarComponent {}');

      // Already covered above through the .ts fallback is implicit; this
      // exercises the explicit component branch with a bare path.
      expect(
        findComponentFromOptions(tree, {
          name: 'foo',
          path: 'src/app',
          component: 'bar',
        })
      ).toBe('/src/app/bar.ts');
    });

    it('throws when an explicit component path does not exist', () => {
      const tree = new UnitTestTree(Tree.empty());

      expect(() =>
        findComponentFromOptions(tree, {
          name: 'foo',
          path: 'src/app',
          component: 'missing',
        })
      ).toThrow('Specified component path /src/app/missing does not exist');
    });
  });
});
