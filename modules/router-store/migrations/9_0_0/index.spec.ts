import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';

describe('Router Store Migration 9_0_0', () => {
  let appTree: UnitTestTree;
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/router-store/migrations/migration.json'
  );
  const pkgName = 'router-store';

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

  describe('Adds the default serializer when none is set', () => {
    it(`should use the default serializer if none was present (empty)`, async () => {
      const input = `
      import { StoreRouterConnectingModule } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot(),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { StoreRouterConnectingModule, DefaultRouterStateSerializer } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot({ serializer: DefaultRouterStateSerializer }),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      await test(input, expected);
    });

    it(`should use the default serializer if none was present (with props)`, async () => {
      const input = `
      import { StoreRouterConnectingModule } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot({ key: 'router' }),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = `
      import { StoreRouterConnectingModule, DefaultRouterStateSerializer } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot({ serializer: DefaultRouterStateSerializer, key: 'router' }),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

      await test(input, expected);
    });

    it(`should not run the migration if there was a serializer set`, async () => {
      const input = `
      import { StoreRouterConnectingModule } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot({ serializer: CustomSerializer }),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = input;

      await test(input, expected);
    });

    it(`should not run the migration if there was a routerState set`, async () => {
      const input = `
      import { StoreRouterConnectingModule, RouterState } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          StoreRouterConnectingModule.forRoot({ routerState: RouterState.Minimal }),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
      const expected = input;

      await test(input, expected);
    });

    describe('beyond NgModule imports', () => {
      const imp = `import { StoreRouterConnectingModule } from '@ngrx/router-store';\n`;
      const withSerializer = `import { StoreRouterConnectingModule, DefaultRouterStateSerializer } from '@ngrx/router-store';\n`;

      it('should migrate TestBed imports and shared arrays', async () => {
        await test(
          imp +
            `TestBed.configureTestingModule({ imports: [StoreRouterConnectingModule.forRoot()] });\nexport const IMPORTS = [StoreRouterConnectingModule.forRoot({ stateKey: 'router' })];\n`,
          withSerializer +
            `TestBed.configureTestingModule({ imports: [StoreRouterConnectingModule.forRoot({ serializer: DefaultRouterStateSerializer })] });\nexport const IMPORTS = [StoreRouterConnectingModule.forRoot({ serializer: DefaultRouterStateSerializer, stateKey: 'router' })];\n`
        );
      });

      it('should migrate aliased and namespace imports', async () => {
        await test(
          `import { StoreRouterConnectingModule as R } from '@ngrx/router-store';\n@NgModule({ imports: [R.forRoot()] })\nexport class M {}\n`,
          `import { StoreRouterConnectingModule as R, DefaultRouterStateSerializer } from '@ngrx/router-store';\n@NgModule({ imports: [R.forRoot({ serializer: DefaultRouterStateSerializer })] })\nexport class M {}\n`
        );
        appTree.delete('./app.module.ts');
        await test(
          `import * as rs from '@ngrx/router-store';\n@NgModule({ imports: [rs.StoreRouterConnectingModule.forRoot()] })\nexport class M {}\n`,
          `import * as rs from '@ngrx/router-store';\n@NgModule({ imports: [rs.StoreRouterConnectingModule.forRoot({ serializer: rs.DefaultRouterStateSerializer })] })\nexport class M {}\n`
        );
      });

      it('should warn about a config passed as a variable', async () => {
        const input =
          imp +
          `const config = { stateKey: 'router' };\n@NgModule({ imports: [StoreRouterConnectingModule.forRoot(config)] })\nexport class M {}\n`;
        const runner = new SchematicTestRunner('schematics', collectionPath);
        const logs: string[] = [];
        runner.logger.subscribe((entry) => logs.push(entry.message));
        appTree.create('./app.module.ts', input);

        const newTree = await runner.runSchematic(
          `ngrx-${pkgName}-migration-03`,
          {},
          appTree
        );

        expect(newTree.readContent('app.module.ts')).toBe(input);
        expect(logs).toContainEqual(
          expect.stringContaining("in the config passed as 'config'")
        );
      });
    });

    async function test(input: string, expected: string) {
      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-03`,
        {},
        appTree
      );
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }
  });
});
