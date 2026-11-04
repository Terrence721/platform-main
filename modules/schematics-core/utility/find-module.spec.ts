import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import {
  findModule,
  findModuleFromOptions,
  buildRelativePath,
} from './find-module';

describe('find-module utilities', () => {
  describe('findModule', () => {
    it('returns the single module in the target directory', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/app.module.ts', 'export class AppModule {}');

      expect(findModule(tree, 'src/app')).toBe('/src/app/app.module.ts');
    });

    it('throws when more than one module matches', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/a.module.ts', 'export class AModule {}');
      tree.create('/src/app/b.module.ts', 'export class BModule {}');

      expect(() => findModule(tree, 'src/app')).toThrow(
        'More than one module matches'
      );
    });

    it('throws when no module can be found', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/readme.md', 'no module here');

      expect(() => findModule(tree, 'src/app')).toThrow(
        'Could not find an NgModule'
      );
    });
  });

  describe('findModuleFromOptions', () => {
    it('returns undefined when skipImport is set', () => {
      const tree = new UnitTestTree(Tree.empty());

      expect(
        findModuleFromOptions(tree, {
          name: 'foo',
          skipImport: true,
        })
      ).toBeUndefined();
    });

    it('finds the closest module when no explicit module is provided', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/app.module.ts', 'export class AppModule {}');

      expect(
        findModuleFromOptions(tree, {
          name: 'foo',
          path: 'src/app',
          flat: true,
        })
      ).toBe('/src/app/app.module.ts');
    });

    it('returns an explicit module path that exists', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/src/app/shared.module.ts', 'export class SharedModule {}');

      expect(
        findModuleFromOptions(tree, {
          name: 'foo',
          path: 'src/app',
          module: 'shared',
        })
      ).toBe('/src/app/shared.module.ts');
    });

    it('throws when an explicit module path does not exist', () => {
      const tree = new UnitTestTree(Tree.empty());

      expect(() =>
        findModuleFromOptions(tree, {
          name: 'foo',
          path: 'src/app',
          module: 'missing',
        })
      ).toThrow('Specified module path /src/app/missing does not exist');
    });
  });

  describe('buildRelativePath', () => {
    it('builds a relative path between two files', () => {
      expect(buildRelativePath('/src/app/foo.ts', '/src/app/bar.ts')).toBe(
        './bar'
      );
    });
  });
});
