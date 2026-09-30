import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import {
  createPackageJson,
  packagePath,
} from '@ngrx/schematics-core/testing/create-package';
import {
  upgradeVersion,
  versionPrefixes,
} from '@ngrx/schematics-core/testing/update';

describe('Effects Migration 6_0_0', () => {
  let appTree;
  const pkgName = 'effects';

  versionPrefixes.forEach((prefix) => {
    it(`should install version ${prefix}6.0.0`, async () => {
      appTree = new UnitTestTree(Tree.empty());
      const collectionPath = path.join(
        process.cwd(),
        'dist/modules/effects/migrations/migration.json'
      );
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const tree = createPackageJson(prefix, pkgName, appTree);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-01`,
        {},
        tree
      );
      const pkg = JSON.parse(newTree.readContent(packagePath));
      expect(pkg.dependencies[`@ngrx/${pkgName}`]).toBe(
        `${prefix}${upgradeVersion}`
      );
    });
  });

  const runMigration = async (content: string) => {
    appTree = new UnitTestTree(Tree.empty());
    appTree.create(packagePath, content);
    const collectionPath = path.join(
      process.cwd(),
      'dist/modules/effects/migrations/migration.json'
    );
    const runner = new SchematicTestRunner('schematics', collectionPath);
    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-01`,
      {},
      appTree
    );
    return newTree.readContent(packagePath);
  };

  it('should update a devDependency', async () => {
    expect(
      await runMigration(
        '{\n  "devDependencies": {\n    "@ngrx/effects": "^5.2.0"\n  }\n}\n'
      )
    ).toBe(
      '{\n  "devDependencies": {\n    "@ngrx/effects": "^6.0.0"\n  }\n}\n'
    );
  });

  it('should leave package.json untouched when the package is not listed', async () => {
    const content =
      '{\n    "dependencies": {\n        "@ngrx/store": "^5.2.0"\n    }\n}\n';
    expect(await runMigration(content)).toBe(content);
  });
});
