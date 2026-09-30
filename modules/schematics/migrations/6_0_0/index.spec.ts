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

const collectionPath = path.join(
  process.cwd(),
  'dist/modules/schematics/migrations/migration.json'
);

describe('Schematics Migration 6_0_0', () => {
  let appTree;
  const pkgName = 'schematics';

  versionPrefixes.forEach((prefix) => {
    it(`should install version ${prefix}6.0.0`, async () => {
      appTree = new UnitTestTree(Tree.empty());
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

  // @ngrx/schematics is usually a devDependency.
  it('should update a devDependency', async () => {
    appTree = new UnitTestTree(Tree.empty());
    appTree.create(
      packagePath,
      '{\n  "devDependencies": {\n    "@ngrx/schematics": "^5.2.0"\n  }\n}\n'
    );
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-01`,
      {},
      appTree
    );

    expect(newTree.readContent(packagePath)).toBe(
      '{\n  "devDependencies": {\n    "@ngrx/schematics": "^6.0.0"\n  }\n}\n'
    );
  });

  it('should leave package.json untouched when the package is not listed', async () => {
    const content =
      '{\n    "devDependencies": {\n        "rxjs": "^6.0.0"\n    }\n}\n';
    appTree = new UnitTestTree(Tree.empty());
    appTree.create(packagePath, content);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-01`,
      {},
      appTree
    );

    expect(newTree.readContent(packagePath)).toBe(content);
  });
});
