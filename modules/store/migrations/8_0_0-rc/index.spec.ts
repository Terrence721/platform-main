import * as path from 'node:path';
import { normalize } from '@angular-devkit/core';
import { EmptyTree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';

describe('Migration to version 8.0.0 rc', () => {
  describe('removes the usage of the storeFreeze meta-reducer', () => {
    /* eslint-disable */
    const fixtures = [
      {
        description: 'removes the ngrx-store-freeze import',
        input: `import { storeFreeze } from 'ngrx-store-freeze';`,
        expected: ``,
      },
      {
        description: 'removes the usage of storeFeeze',
        input: `import { storeFreeze } from 'ngrx-store-freeze';
          const metaReducers = environment.production ? [] : [storeFreeze]`,
        expected: `
          const metaReducers = environment.production ? [] : []`,
      },
      {
        description:
          'removes the usage of storeFeeze with an appending meta-reducer',
        input: `import { storeFreeze } from 'ngrx-store-freeze';
          const metaReducers = environment.production ? [] : [storeFreeze, foo]`,
        expected: `
          const metaReducers = environment.production ? [] : [foo]`,
      },
      {
        description:
          'removes the usage of storeFeeze with an prepending meta-reducer',
        input: `import { storeFreeze } from 'ngrx-store-freeze';
          const metaReducers = environment.production ? [] : [foo, storeFreeze]`,
        expected: `
          const metaReducers = environment.production ? [] : [foo]`,
      },
      {
        description: 'removes the usage of storeFeeze in between meta-reducers',
        input: `import { storeFreeze } from 'ngrx-store-freeze';
          const metaReducers = environment.production ? [] : [foo, storeFreeze, bar]`,
        expected: `
          const metaReducers = environment.production ? [] : [foo, bar]`,
      },
    ];
    /* eslint-enable */

    const reducerPath = normalize('reducers/index.ts');

    for (const { description, input, expected } of fixtures) {
      it(description, async () => {
        const tree = new UnitTestTree(new EmptyTree());
        // we need a package.json, it will throw otherwise because we're trying to remove ngrx-store-freeze as a dep
        tree.create('/package.json', JSON.stringify({}));
        tree.create(reducerPath, input);

        const schematicRunner = createSchematicsRunner();
        await schematicRunner.runSchematic('ngrx-store-migration-03', {}, tree);
        await schematicRunner.engine.executePostTasks().toPromise();

        const actual = tree.readContent(reducerPath);
        expect(actual).toBe(expected);
      });
    }
  });

  describe('StoreModule.forRoot()', () => {
    /* eslint-disable */
    const fixtures = [
      {
        description:
          'enables strictStateImmutability and strictActionImmutability runtime checks with no store config',
        input: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
        isStoreFreezeUsed: true,
        expected: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, { runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true }}),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
      },
      {
        description:
          'enables strictStateImmutability and strictActionImmutability runtime checks with store config',
        input: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, { metaReducers }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
        isStoreFreezeUsed: true,
        expected: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, { metaReducers, runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true } }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
      },
      {
        description:
          'enables strictStateImmutability and strictActionImmutability runtime checks with store config ending with a comma',
        input: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, {
              metaReducers,
            }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
        isStoreFreezeUsed: true,
        expected: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, {
              metaReducers, runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true },
            }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
      },
      {
        description:
          'enables strictStateImmutability and strictActionImmutability runtime checks with an empty store config',
        input: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, { }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
        isStoreFreezeUsed: true,
        expected: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, { runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true } }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
      },
      {
        description:
          'does not add runtime checks when store-freeze was not used',
        input: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, { metaReducers }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
        isStoreFreezeUsed: false,
        expected: `
        @NgModule({
          imports: [
            StoreModule.forRoot(ROOT_REDUCERS, { metaReducers }),
          ],
          bootstrap: [AppComponent],
        })
        export class AppModule {}`,
      },
    ];
    /* eslint-enable */

    const appModulePath = normalize('app.module.ts');

    for (const {
      description,
      input,
      isStoreFreezeUsed,
      expected,
    } of fixtures) {
      it(description, async () => {
        const tree = new UnitTestTree(new EmptyTree());
        // we need a package.json, it will throw otherwise because we're trying to remove ngrx-store-freeze as a dep
        tree.create('/package.json', JSON.stringify({}));
        if (isStoreFreezeUsed) {
          // we need this file to "trigger" the runtime additions
          tree.create(
            'reducer.ts',
            'import { storeFreeze } from "ngrx-store-freeze";'
          );
        }
        tree.create(appModulePath, input);

        const schematicRunner = createSchematicsRunner();
        await schematicRunner.runSchematic('ngrx-store-migration-03', {}, tree);
        await schematicRunner.engine.executePostTasks().toPromise();

        const actual = tree.readContent(appModulePath);
        expect(actual).toBe(expected);
      });
    }
  });

  describe('package.json', () => {
    /* eslint-disable */
    const fixtures = [
      {
        description: 'removes ngrx-store-freeze as a dependency',
        input: JSON.stringify({
          dependencies: {
            'ngrx-store-freeze': '^1.0.0',
          },
        }),
      },
      {
        description: 'removes ngrx-store-freeze as a dev dependency',
        input: JSON.stringify({
          devDependencies: {
            'ngrx-store-freeze': '^1.0.0',
          },
        }),
      },
      {
        description: 'does not throw when ngrx-store-freeze is not installed',
        input: JSON.stringify({
          dependencies: {},
          devDependencies: {},
        }),
      },
    ];
    /* eslint-enable */

    const packageJsonPath = normalize('package.json');

    for (const { description, input } of fixtures) {
      it(description, async () => {
        const tree = new UnitTestTree(new EmptyTree());
        tree.create(packageJsonPath, input);

        const schematicRunner = createSchematicsRunner();
        await schematicRunner.runSchematic('ngrx-store-migration-03', {}, tree);
        await schematicRunner.engine.executePostTasks().toPromise();

        const actual = tree.readContent(packageJsonPath);
        expect(actual).not.toMatch(/ngrx-store-freeze/);
      });
    }

    const runMigration = async (content: string) => {
      const tree = new UnitTestTree(new EmptyTree());
      tree.create(packageJsonPath, content);
      await createSchematicsRunner().runSchematic(
        'ngrx-store-migration-03',
        {},
        tree
      );
      return tree.readContent(packageJsonPath);
    };

    it('leaves package.json untouched when ngrx-store-freeze is not listed', async () => {
      const content =
        '{\n    "dependencies": {\n        "@ngrx/store": "^7.0.0"\n    }\n}\n';
      expect(await runMigration(content)).toBe(content);
    });

    it('keeps the indentation, Windows line endings and final line break', async () => {
      expect(
        await runMigration(
          '{\r\n    "dependencies": {\r\n        "ngrx-store-freeze": "^0.2.4",\r\n        "@ngrx/store": "^7.0.0"\r\n    }\r\n}\r\n'
        )
      ).toBe(
        '{\r\n    "dependencies": {\r\n        "@ngrx/store": "^7.0.0"\r\n    }\r\n}\r\n'
      );
    });
  });

  describe('uses that need care', () => {
    const imp = `import { storeFreeze } from 'ngrx-store-freeze';\nimport { StoreModule } from '@ngrx/store';\n`;
    const forRoot = `@NgModule({ imports: [StoreModule.forRoot(reducers, { metaReducers })] })\nexport class M {}\n`;
    const forRootWithChecks = `@NgModule({ imports: [StoreModule.forRoot(reducers, { metaReducers, runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true } })] })\nexport class M {}\n`;

    const run = async (files: Record<string, string>) => {
      const tree = new UnitTestTree(new EmptyTree());
      tree.create('/package.json', JSON.stringify({}));
      for (const [file, content] of Object.entries(files)) {
        tree.create(file, content);
      }
      const schematicRunner = createSchematicsRunner();
      const logs: string[] = [];
      schematicRunner.logger.subscribe((entry) => logs.push(entry.message));
      await schematicRunner.runSchematic('ngrx-store-migration-03', {}, tree);
      return { tree, logs };
    };

    it('removes an aliased storeFreeze', async () => {
      const { tree } = await run({
        '/main.ts': `import { storeFreeze as freeze } from 'ngrx-store-freeze';\nimport { StoreModule } from '@ngrx/store';\nconst metaReducers = [logger, freeze];\n${forRoot}`,
      });
      expect(tree.readContent('/main.ts')).toBe(
        `\nimport { StoreModule } from '@ngrx/store';\nconst metaReducers = [logger];\n${forRootWithChecks}`
      );
    });

    it('keeps the formatting and comments of a multi-line array', async () => {
      const { tree } = await run({
        '/main.ts': `${imp}const metaReducers = [\n  logger, // logs\n  storeFreeze,\n  debug,\n];\n${forRoot}`,
      });
      expect(tree.readContent('/main.ts')).toBe(
        `\nimport { StoreModule } from '@ngrx/store';\nconst metaReducers = [\n  logger, // logs\n  debug,\n];\n${forRootWithChecks}`
      );
    });

    it('keeps an explicit runtimeChecks', async () => {
      const { tree } = await run({
        '/main.ts': `${imp}const metaReducers = [storeFreeze];\n@NgModule({ imports: [StoreModule.forRoot(reducers, { metaReducers, runtimeChecks: { strictStateSerializability: true } })] })\nexport class M {}\n`,
      });
      expect(tree.readContent('/main.ts')).toBe(
        `\nimport { StoreModule } from '@ngrx/store';\nconst metaReducers = [];\n@NgModule({ imports: [StoreModule.forRoot(reducers, { metaReducers, runtimeChecks: { strictStateSerializability: true } })] })\nexport class M {}\n`
      );
    });

    it('migrates spec files too', async () => {
      const { tree } = await run({
        '/main.spec.ts': `import { storeFreeze } from 'ngrx-store-freeze';\nTestBed.configureTestingModule({ imports: [StoreModule.forRoot(reducers, { metaReducers: [storeFreeze] })] });\n`,
      });
      expect(tree.readContent('/main.spec.ts')).toBe(
        `\nTestBed.configureTestingModule({ imports: [StoreModule.forRoot(reducers, { metaReducers: [], runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true } })] });\n`
      );
    });

    it('keeps the import and the package, and warns, for a use outside an array', async () => {
      const input = `${imp}const metaReducers = [logger];\nif (!environment.production) { metaReducers.push(storeFreeze); }\n${forRoot}`;
      const tree = new UnitTestTree(new EmptyTree());
      tree.create(
        '/package.json',
        JSON.stringify({ dependencies: { 'ngrx-store-freeze': '^0.2.4' } })
      );
      tree.create('/main.ts', input);
      const schematicRunner = createSchematicsRunner();
      const logs: string[] = [];
      schematicRunner.logger.subscribe((entry) => logs.push(entry.message));

      await schematicRunner.runSchematic('ngrx-store-migration-03', {}, tree);

      expect(tree.readContent('/main.ts')).toBe(input);
      expect(tree.readContent('/package.json')).toMatch(/ngrx-store-freeze/);
      expect(logs).toContainEqual(
        expect.stringContaining(
          "remove storeFreeze from 'metaReducers.push(storeFreeze)' by hand"
        )
      );
    });
  });
});

function createSchematicsRunner() {
  const schematicRunner = new SchematicTestRunner(
    'migrations',
    path.join(process.cwd(), 'dist/modules/store/migrations/migration.json')
  );

  return schematicRunner;
}
