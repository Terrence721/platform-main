import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';

describe('Router Store Migration 8_0_0', () => {
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

  it(`should import StoreRouterConnectingModule as StoreRouterConnectingModule.forRoot()`, async () => {
    const contents = `
      import { StoreRouterConnectingModule } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          /**
           * @ngrx/router-store keeps router state up-to-date in the store.
           */
          StoreRouterConnectingModule,
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
    const expected = `
      import { StoreRouterConnectingModule } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          /**
           * @ngrx/router-store keeps router state up-to-date in the store.
           */
          StoreRouterConnectingModule.forRoot(),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

    appTree.create('./app.module.ts', contents);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-02`,
      {},
      appTree
    );
    const file = newTree.readContent('app.module.ts');

    expect(file).toBe(expected);
  });

  it(`should not replace StoreRouterConnectingModule.forRoot()`, async () => {
    const contents = `
      import { StoreRouterConnectingModule } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          /**
           * @ngrx/router-store keeps router state up-to-date in the store.
           */
          StoreRouterConnectingModule.forRoot(),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;
    const expected = `
      import { StoreRouterConnectingModule } from '@ngrx/router-store';
      @NgModule({
        imports: [
          AuthModule,
          AppRoutingModule,
          /**
           * @ngrx/router-store keeps router state up-to-date in the store.
           */
          StoreRouterConnectingModule.forRoot(),
          CoreModule,
        ],
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

    appTree.create('./app.module.ts', contents);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-02`,
      {},
      appTree
    );
    const file = newTree.readContent('app.module.ts');

    expect(file).toBe(expected);
  });

  describe('beyond NgModule imports', () => {
    const imp = `import { StoreRouterConnectingModule } from '@ngrx/router-store';\n`;

    const verify = async (input: string, output: string) => {
      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-02`,
        {},
        appTree
      );
      expect(newTree.readContent('main.ts')).toBe(output);
    };

    it('should migrate TestBed imports and shared arrays', async () => {
      await verify(
        imp +
          `TestBed.configureTestingModule({ imports: [StoreRouterConnectingModule] });\nexport const SHARED = [CommonModule, StoreRouterConnectingModule];\n`,
        imp +
          `TestBed.configureTestingModule({ imports: [StoreRouterConnectingModule.forRoot()] });\nexport const SHARED = [CommonModule, StoreRouterConnectingModule.forRoot()];\n`
      );
    });

    it('should migrate aliased and namespace imports', async () => {
      await verify(
        `import { StoreRouterConnectingModule as Router } from '@ngrx/router-store';\nimport * as rs from '@ngrx/router-store';\n@NgModule({ imports: [Router, rs.StoreRouterConnectingModule] })\nexport class M {}\n`,
        `import { StoreRouterConnectingModule as Router } from '@ngrx/router-store';\nimport * as rs from '@ngrx/router-store';\n@NgModule({ imports: [Router.forRoot(), rs.StoreRouterConnectingModule.forRoot()] })\nexport class M {}\n`
      );
    });

    it('should leave an exports list alone', async () => {
      await verify(
        imp +
          `@NgModule({ imports: [StoreRouterConnectingModule], exports: [StoreRouterConnectingModule] })\nexport class M {}\n`,
        imp +
          `@NgModule({ imports: [StoreRouterConnectingModule.forRoot()], exports: [StoreRouterConnectingModule] })\nexport class M {}\n`
      );
    });
  });
});
