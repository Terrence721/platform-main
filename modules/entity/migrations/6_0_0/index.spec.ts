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

describe('Entity Migration 6_0_0', () => {
  let appTree;
  const pkgName = 'entity';

  versionPrefixes.forEach((prefix) => {
    it(`should install version ${prefix}6.0.0`, async () => {
      appTree = new UnitTestTree(Tree.empty());
      const collectionPath = path.join(
        process.cwd(),
        'dist/modules/entity/migrations/migration.json'
      );
      const schematicRunner = new SchematicTestRunner(
        'schematics',
        collectionPath
      );
      const tree = createPackageJson(prefix, pkgName, appTree);

      const newTree = await schematicRunner.runSchematic(
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

  describe('package.json formatting', () => {
    const runMigration = async (content: string) => {
      const collectionPath = path.join(
        process.cwd(),
        'dist/modules/entity/migrations/migration.json'
      );
      const schematicRunner = new SchematicTestRunner(
        'schematics',
        collectionPath
      );
      appTree = new UnitTestTree(Tree.empty());
      appTree.create(packagePath, content);
      const newTree = await schematicRunner.runSchematic(
        `ngrx-${pkgName}-migration-01`,
        {},
        appTree
      );
      return newTree.readContent(packagePath);
    };

    it('should update a devDependency', async () => {
      expect(
        await runMigration(
          '{\n  "devDependencies": {\n    "@ngrx/entity": "^5.2.0"\n  }\n}\n'
        )
      ).toBe(
        '{\n  "devDependencies": {\n    "@ngrx/entity": "^6.0.0"\n  }\n}\n'
      );
    });

    it('should leave package.json untouched when the package is not listed', async () => {
      const content =
        '{\n    "name": "app",\n    "dependencies": {\n        "rxjs": "^7.8.0"\n    }\n}\n';
      expect(await runMigration(content)).toBe(content);
    });

    it('should leave package.json untouched when already on 6.0.0', async () => {
      const content =
        '{\n  "dependencies": {\n    "@ngrx/entity": "^6.0.0"\n  }\n}';
      expect(await runMigration(content)).toBe(content);
    });

    it('should keep the indentation and final line break', async () => {
      expect(
        await runMigration(
          '{\n    "dependencies": {\n        "@ngrx/entity": "~5.2.0"\n    }\n}\n'
        )
      ).toBe(
        '{\n    "dependencies": {\n        "@ngrx/entity": "~6.0.0"\n    }\n}\n'
      );
    });

    it('should keep tabs and Windows line endings', async () => {
      expect(
        await runMigration(
          '{\r\n\t"dependencies": {\r\n\t\t"@ngrx/entity": "5.0.0"\r\n\t}\r\n}\r\n'
        )
      ).toBe(
        '{\r\n\t"dependencies": {\r\n\t\t"@ngrx/entity": "6.0.0"\r\n\t}\r\n}\r\n'
      );
    });
  });
});
