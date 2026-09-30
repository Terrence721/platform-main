import * as path from 'path';
import { logging } from '@angular-devkit/core';
import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';

describe('Component Migration 16_0_0', () => {
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
          "include": [**./*.ts"]
        }
     `
    );
    createPackageJson('', pkgName, appTree);
  });

  [
    { module: 'LetModule', declarable: 'LetDirective' },
    {
      module: 'PushModule',
      declarable: 'PushPipe',
    },
  ].forEach(({ module, declarable }) => {
    describe(`${module} => ${declarable}`, () => {
      it(`should replace the ${module} in NgModule with ${declarable}`, async () => {
        const input = `
          import { ${module} } from '@ngrx/component';

          @NgModule({
            imports: [
              AuthModule,
              AppRoutingModule,
              ${module},
              CoreModule,
            ],
            exports: [${module}],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
        `;
        const expected = `
          import { ${declarable} } from '@ngrx/component';

          @NgModule({
            imports: [
              AuthModule,
              AppRoutingModule,
              ${declarable},
              CoreModule,
            ],
            exports: [${declarable}],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
        `;

        appTree.create('./app.module.ts', input);
        const runner = new SchematicTestRunner('schematics', collectionPath);

        const newTree = await runner.runSchematic(
          `ngrx-${pkgName}-migration-16`,
          {},
          appTree
        );
        const file = newTree.readContent('app.module.ts');

        expect(file).toBe(expected);
      });

      it(`should replace the ${module} in standalone component with ${declarable}`, async () => {
        const input = `
          import { ${module} } from '@ngrx/component';

          @Component({
            imports: [
              AuthModule,
              ${module}
            ]
          })
          export class SomeStandaloneComponent {}
        `;
        const expected = `
          import { ${declarable} } from '@ngrx/component';

          @Component({
            imports: [
              AuthModule,
              ${declarable}
            ]
          })
          export class SomeStandaloneComponent {}
        `;

        appTree.create('./app.module.ts', input);
        const runner = new SchematicTestRunner('schematics', collectionPath);

        const newTree = await runner.runSchematic(
          `ngrx-${pkgName}-migration-16`,
          {},
          appTree
        );
        const file = newTree.readContent('app.module.ts');

        expect(file).toBe(expected);
      });

      it(`should not remove the ${module} JS import when used as a type`, async () => {
        const input = `
          import { ${module} } from '@ngrx/component';

          const module: ${module};

          @NgModule({
            imports: [
              AuthModule,
              AppRoutingModule,
              ${module},
              CoreModule
            ],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
        `;
        const expected = `
          import { ${module}, ${declarable} } from '@ngrx/component';

          const module: ${module};

          @NgModule({
            imports: [
              AuthModule,
              AppRoutingModule,
              ${declarable},
              CoreModule
            ],
            bootstrap: [AppComponent]
          })
          export class AppModule {}
        `;

        appTree.create('./app.module.ts', input);
        const runner = new SchematicTestRunner('schematics', collectionPath);

        const newTree = await runner.runSchematic(
          `ngrx-${pkgName}-migration-16`,
          {},
          appTree
        );
        const file = newTree.readContent('app.module.ts');

        expect(file).toBe(expected);
      });
    });
  });

  describe('imports and usages', () => {
    const runMigration = async (input: string) => {
      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const logs: logging.LogEntry[] = [];
      runner.logger.subscribe((entry) => logs.push(entry));
      const newTree = await runner.runSchematic(
        'ngrx-component-migration-16',
        {},
        appTree
      );
      return { file: newTree.readContent('main.ts'), logs };
    };

    it('should migrate TestBed imports and shared arrays', async () => {
      const { file } = await runMigration(
        `import { LetModule, PushModule } from '@ngrx/component';\nTestBed.configureTestingModule({ imports: [LetModule] });\nexport const SHARED = [CommonModule, PushModule];\n`
      );
      expect(file).toBe(
        `import { LetDirective, PushPipe } from '@ngrx/component';\nTestBed.configureTestingModule({ imports: [LetDirective] });\nexport const SHARED = [CommonModule, PushPipe];\n`
      );
    });

    it('should not import LetDirective twice', async () => {
      const { file } = await runMigration(
        `import { LetDirective, LetModule } from '@ngrx/component';\n@Component({ imports: [LetModule] })\nexport class C {}\n`
      );
      expect(file).toBe(
        `import { LetDirective } from '@ngrx/component';\n@Component({ imports: [LetDirective] })\nexport class C {}\n`
      );
    });

    it('should leave a file that only imports @ngrx/component-store alone', async () => {
      const input = `import { ComponentStore } from '@ngrx/component-store';\nclass LetModule {}\n@NgModule({ imports: [LetModule] })\nexport class M {}\n`;
      const { file } = await runMigration(input);
      expect(file).toBe(input);
    });

    it('should keep only the module that is still used, and warn', async () => {
      const { file, logs } = await runMigration(
        `import { LetModule, PushModule } from '@ngrx/component';\nconst m: LetModule = null;\n@Component({ imports: [LetModule, PushModule] })\nexport class C {}\n`
      );
      expect(file).toBe(
        `import { LetModule, LetDirective, PushPipe } from '@ngrx/component';\nconst m: LetModule = null;\n@Component({ imports: [LetDirective, PushPipe] })\nexport class C {}\n`
      );
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining(
            'still uses LetModule outside an imports array'
          ),
        })
      );
    });

    it('should warn about a namespace import', async () => {
      const input = `import * as c from '@ngrx/component';\n@Component({ imports: [c.PushModule] })\nexport class C {}\n`;
      const { file, logs } = await runMigration(input);
      expect(file).toBe(input);
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'warn',
          message: expect.stringContaining(
            'uses PushModule through a namespace import'
          ),
        })
      );
    });
  });
});
