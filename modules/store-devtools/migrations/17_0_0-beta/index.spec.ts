import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { logging } from '@angular-devkit/core';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';
import { waitForAsync } from '@angular/core/testing';

describe('DevTools Migration 17_0_0-beta', () => {
  let appTree: UnitTestTree;
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/store-devtools/migrations/migration.json'
  );
  const pkgName = 'store-devtools';
  const migrationname = `ngrx-${pkgName}-migration-17-0-0-beta`;

  beforeEach(() => {
    appTree = new UnitTestTree(Tree.empty());
    appTree.create(
      '/tsconfig.json',
      `
        {
          "include": [**./*.ts"]
        }
       `
    );
    createPackageJson('', pkgName, appTree);
  });

  describe('StoreDevtoolsModule.instrument', () => {
    it(`should add connectInZone to config properties (previous property ends with a comma)`, waitForAsync(async () => {
      const input = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
            name: 'DevTools Name',
          }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
            name: 'DevTools Name',
            connectInZone: true,
          }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));

    it(`should add connectInZone to config properties (previous property doesn't end with a comma)`, waitForAsync(async () => {
      const input = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
            name: 'DevTools Name'
          }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
            name: 'DevTools Name',
            connectInZone: true
          }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));

    it(`should add connectInZone to empty config properties`, waitForAsync(async () => {
      const input = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
          }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
          connectInZone: true}),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));

    it(`should add connectInZone to empty config`, waitForAsync(async () => {
      const input = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument(),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({connectInZone: true}),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));

    it(`renames connectOutsideZone to connectInZone and inverts its value`, waitForAsync(async () => {
      const input = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
            connectOutsideZone: true,
          }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { StoreDevtoolsModule } from '@ngrx/store-devtools';

      @NgModule({
        imports: [
          StoreDevtoolsModule.instrument({
            connectInZone: false,
          }),
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));
  });

  describe('bootstrapApplication', () => {
    it(`should add connectInZone to config properties (previous property ends with a comma)`, waitForAsync(async () => {
      const input = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({
            maxAge: 25,
            logOnly: !isDevMode(),
          }),
        ],
      });
    `;
      const expected = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({
            maxAge: 25,
            logOnly: !isDevMode(),
            connectInZone: true,
          }),
        ],
      });
    `;

      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('main.ts');

      expect(file).toBe(expected);
    }));

    it(`should add connectInZone to config properties (previous property doesn't end with a comma)`, waitForAsync(async () => {
      const input = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({
            maxAge: 25,
            logOnly: !isDevMode()
          }),
        ],
      });
    `;
      const expected = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({
            maxAge: 25,
            logOnly: !isDevMode(),
            connectInZone: true
          }),
        ],
      });
    `;

      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('main.ts');

      expect(file).toBe(expected);
    }));

    it(`should add connectInZone to empty config properties`, waitForAsync(async () => {
      const input = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({ }),
        ],
      });
    `;
      const expected = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({ connectInZone: true}),
        ],
      });
    `;

      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('main.ts');

      expect(file).toBe(expected);
    }));

    it(`should add connectInZone to empty config`, waitForAsync(async () => {
      const input = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools(),
        ],
      });
    `;
      const expected = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({connectInZone: true}),
        ],
      });
    `;

      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('main.ts');

      expect(file).toBe(expected);
    }));

    it(`renames connectOutsideZone to connectInZone and inverts its value`, waitForAsync(async () => {
      const input = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({ connectOutsideZone: someValue }),
        ],
      });
    `;
      const expected = `
      import { provideStoreDevtools } from '@ngrx/store-devtools';

      bootstrapApplication(AppComponent, {
        providers: [
          provideStoreDevtools({ connectInZone: !someValue }),
        ],
      });
    `;

      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      const file = newTree.readContent('main.ts');

      expect(file).toBe(expected);
    }));
  });

  describe('config values and imports', () => {
    const imp = `import { provideStoreDevtools } from '@ngrx/store-devtools';\n`;

    const runMigration = async (input: string) => {
      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const logs: logging.LogEntry[] = [];
      runner.logger.subscribe((entry) => logs.push(entry));
      const newTree = await runner.runSchematic(migrationname, {}, appTree);
      return { file: newTree.readContent('main.ts'), logs };
    };

    it('should negate a compound value as a whole', async () => {
      const { file } = await runMigration(
        imp + `provideStoreDevtools({ connectOutsideZone: isDev || isTest });\n`
      );
      expect(file).toBe(
        imp + `provideStoreDevtools({ connectInZone: !(isDev || isTest) });\n`
      );
    });

    it('should add the property after a trailing comma and comment', async () => {
      const { file } = await runMigration(
        imp + `provideStoreDevtools({\n  maxAge: 25, // keep 25 states\n});\n`
      );
      expect(file).toBe(
        imp +
          `provideStoreDevtools({\n  maxAge: 25, // keep 25 states\n  connectInZone: true,\n});\n`
      );
    });

    it('should keep Windows line endings', async () => {
      const input = `import { provideStoreDevtools } from '@ngrx/store-devtools';\r\nprovideStoreDevtools({\r\n  maxAge: 25\r\n});\r\n`;
      const { file } = await runMigration(input);
      expect(file).toBe(
        `import { provideStoreDevtools } from '@ngrx/store-devtools';\r\nprovideStoreDevtools({\r\n  maxAge: 25,\r\n  connectInZone: true\r\n});\r\n`
      );
    });

    it('should leave a config that already sets connectInZone alone', async () => {
      const input =
        imp + `provideStoreDevtools({ maxAge: 25, connectInZone: false });\n`;
      const { file } = await runMigration(input);
      expect(file).toBe(input);
    });

    it('should migrate aliased and namespace imports', async () => {
      const { file } = await runMigration(
        `import { provideStoreDevtools as devtools } from '@ngrx/store-devtools';\nimport * as sd from '@ngrx/store-devtools';\ndevtools({ maxAge: 25 });\nsd.StoreDevtoolsModule.instrument({ connectOutsideZone: true });\n`
      );
      expect(file).toBe(
        `import { provideStoreDevtools as devtools } from '@ngrx/store-devtools';\nimport * as sd from '@ngrx/store-devtools';\ndevtools({ maxAge: 25, connectInZone: true });\nsd.StoreDevtoolsModule.instrument({ connectInZone: false });\n`
      );
    });

    it('should migrate a shorthand connectOutsideZone', async () => {
      const { file } = await runMigration(
        imp + `provideStoreDevtools({ connectOutsideZone });\n`
      );
      expect(file).toBe(
        imp + `provideStoreDevtools({ connectInZone: !connectOutsideZone });\n`
      );
    });

    it('should warn about a config passed as a variable', async () => {
      const input = imp + `provideStoreDevtools(config);\n`;
      const { file, logs } = await runMigration(input);
      expect(file).toBe(input);
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining(
            "set connectInZone: true in the devtools config passed as 'config'"
          ),
        })
      );
    });
  });
});
