import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { logging } from '@angular-devkit/core';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';
import { waitForAsync } from '@angular/core/testing';

describe('Component Migration 15_0_0-beta', () => {
  let appTree: UnitTestTree;
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/component/migrations/migration.json'
  );
  const pkgName = 'component';

  beforeEach(() => {
    appTree = new UnitTestTree(Tree.empty());
    appTree.create(
      '/tsconfig.json',
      `
        {
          "include": ["**/*.ts"]
        }
       `
    );
    createPackageJson('', pkgName, appTree);
  });

  describe('Replace ReactiveComponentModule', () => {
    it(`should replace the ReactiveComponentModule in NgModules with LetModule and PushModule`, waitForAsync(async () => {
      const input = `
      import { ReactiveComponentModule } from '@ngrx/component';

      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          ReactiveComponentModule,
          CoreModule,
        ],
        exports: [ReactiveComponentModule],
        bootstrap: [AppComponent]
      })
      export class AppModule {}
    `;
      const expected = `
      import { LetModule, PushModule } from '@ngrx/component';

      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          LetModule, PushModule,
          CoreModule,
        ],
        exports: [LetModule, PushModule],
        bootstrap: [AppComponent]
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-15-beta`,
        {},
        appTree
      );
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));
    it(`should replace the ReactiveComponentModule in standalone components with LetModule and PushModule`, waitForAsync(async () => {
      const input = `
      import { ReactiveComponentModule } from '@ngrx/component';

      @Component({
        imports: [
          AuthModule,
          ReactiveComponentModule
        ]
      })
      export class SomeStandaloneComponent {}
    `;
      const expected = `
      import { LetModule, PushModule } from '@ngrx/component';

      @Component({
        imports: [
          AuthModule,
          LetModule, PushModule
        ]
      })
      export class SomeStandaloneComponent {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-15-beta`,
        {},
        appTree
      );
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));
    it(`should not remove the ReactiveComponentModule JS import when used as a type`, waitForAsync(async () => {
      const input = `
      import { ReactiveComponentModule } from '@ngrx/component';

      const reactiveComponentModule: ReactiveComponentModule;

      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          ReactiveComponentModule,
          CoreModule
        ],
        bootstrap: [AppComponent]
      })
      export class AppModule {}
    `;
      const expected = `
      import { ReactiveComponentModule, LetModule, PushModule } from '@ngrx/component';

      const reactiveComponentModule: ReactiveComponentModule;

      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          LetModule, PushModule,
          CoreModule
        ],
        bootstrap: [AppComponent]
      })
      export class AppModule {}
    `;

      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-15-beta`,
        {},
        appTree
      );
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }));
  });

  describe('imports and usages', () => {
    const runMigration = async (input: string) => {
      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const logs: logging.LogEntry[] = [];
      runner.logger.subscribe((entry) => logs.push(entry));
      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-15-beta`,
        {},
        appTree
      );
      return { file: newTree.readContent('main.ts'), logs };
    };

    it('should migrate an aliased import and its usages', async () => {
      const { file } = await runMigration(
        `import { ReactiveComponentModule as RCM } from '@ngrx/component';\n@NgModule({ imports: [RCM] })\nexport class M {}\n`
      );
      expect(file).toBe(
        `import { LetModule, PushModule } from '@ngrx/component';\n@NgModule({ imports: [LetModule, PushModule] })\nexport class M {}\n`
      );
    });

    it('should migrate TestBed imports and shared arrays', async () => {
      const { file } = await runMigration(
        `import { ReactiveComponentModule } from '@ngrx/component';\nTestBed.configureTestingModule({ imports: [ReactiveComponentModule] });\nexport const SHARED = [CommonModule, ReactiveComponentModule];\n`
      );
      expect(file).toBe(
        `import { LetModule, PushModule } from '@ngrx/component';\nTestBed.configureTestingModule({ imports: [LetModule, PushModule] });\nexport const SHARED = [CommonModule, LetModule, PushModule];\n`
      );
    });

    it('should not import LetModule twice', async () => {
      const { file } = await runMigration(
        `import { LetModule, ReactiveComponentModule } from '@ngrx/component';\n@NgModule({ imports: [ReactiveComponentModule] })\nexport class M {}\n`
      );
      expect(file).toBe(
        `import { LetModule, PushModule } from '@ngrx/component';\n@NgModule({ imports: [LetModule, PushModule] })\nexport class M {}\n`
      );
    });

    it('should leave a file that only imports @ngrx/component-store alone', async () => {
      const input = `import { ComponentStore } from '@ngrx/component-store';\nclass ReactiveComponentModule {}\n@NgModule({ imports: [ReactiveComponentModule] })\nexport class M {}\n`;
      const { file } = await runMigration(input);
      expect(file).toBe(input);
    });

    it('should warn when ReactiveComponentModule stays in use', async () => {
      const { logs } = await runMigration(
        `import { ReactiveComponentModule } from '@ngrx/component';\nconst m: ReactiveComponentModule = null;\n`
      );
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining('outside an imports array'),
        })
      );
    });

    it('should warn about a namespace import', async () => {
      const input = `import * as c from '@ngrx/component';\n@NgModule({ imports: [c.ReactiveComponentModule] })\nexport class M {}\n`;
      const { file, logs } = await runMigration(input);
      expect(file).toBe(input);
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining('through a namespace import'),
        })
      );
    });
  });
});
