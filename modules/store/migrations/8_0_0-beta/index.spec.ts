import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';

describe('Store Migration 8_0_0 beta', () => {
  let appTree: UnitTestTree;
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/store/migrations/migration.json'
  );
  const pkgName = 'store';
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

  it(`should replace the meta reducer imports`, async () => {
    const contents = `
      import {
        RuntimeChecks,
        META_REDUCERS,
        Store,
        META_REDUCERS,
        StoreModule,
        META_REDUCERS as foo,
      } from '@ngrx/store';`;
    const expected = `
      import {
        RuntimeChecks,
        USER_PROVIDED_META_REDUCERS,
        Store,
        USER_PROVIDED_META_REDUCERS,
        StoreModule,
        USER_PROVIDED_META_REDUCERS as foo,
      } from '@ngrx/store';`;

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

  it(`should replace the meta reducer assignments`, async () => {
    const contents = `
      import { META_REDUCERS } from '@ngrx/store';
      @NgModule({
        imports: [
          CommonModule,
          BrowserModule,
          BrowserAnimationsModule,
          HttpClientModule,
          AuthModule,
          AppRoutingModule,
          StoreModule.forRoot(reducers),
        ],
        providers: [
          {
            provide: META_REDUCERS,
            useValue: [fooReducer, barReducer]
          }
        ]
        bootstrap: [AppComponent],
      })
      export class AppModule {}`;
    const expected = `
      import { USER_PROVIDED_META_REDUCERS } from '@ngrx/store';
      @NgModule({
        imports: [
          CommonModule,
          BrowserModule,
          BrowserAnimationsModule,
          HttpClientModule,
          AuthModule,
          AppRoutingModule,
          StoreModule.forRoot(reducers),
        ],
        providers: [
          {
            provide: USER_PROVIDED_META_REDUCERS,
            useValue: [fooReducer, barReducer]
          }
        ]
        bootstrap: [AppComponent],
      })
      export class AppModule {}`;

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

  it(`should migrate a namespace import`, async () => {
    const contents = `
      import * as store from '@ngrx/store';

      @NgModule({
        imports: [
          CommonModule,
          BrowserModule,
          BrowserAnimationsModule,
          HttpClientModule,
          AuthModule,
          AppRoutingModule,
          store.StoreModule.forRoot(reducers),
        ],
        providers: [
          {
            provide: store.META_REDUCERS,
            useValue: [fooReducer, barReducer]
          }
        ]
        bootstrap: [AppComponent],
      })
      export class AppModule {}
    `;

    appTree.create('./app.module.ts', contents);
    const runner = new SchematicTestRunner('schematics', collectionPath);

    const logs: string[] = [];
    runner.logger.subscribe((log) => logs.push(log.message));

    const newTree = await runner.runSchematic(
      `ngrx-${pkgName}-migration-02`,
      {},
      appTree
    );
    const file = newTree.readContent('app.module.ts');

    expect(file).toBe(
      contents.replace(
        'store.META_REDUCERS',
        'store.USER_PROVIDED_META_REDUCERS'
      )
    );
    expect(logs).toEqual([]);
  });

  describe('more import and reference forms', () => {
    const verify = async (input: string, output: string) => {
      appTree.create('./main.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);
      const logs: string[] = [];
      runner.logger.subscribe((log) => logs.push(log.message));
      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-02`,
        {},
        appTree
      );
      expect(newTree.readContent('main.ts')).toBe(output);
      return logs;
    };

    it('should migrate a double-quoted import', async () => {
      await verify(
        `import { META_REDUCERS } from "@ngrx/store";\nconst p = { provide: META_REDUCERS, useValue: [] };\n`,
        `import { USER_PROVIDED_META_REDUCERS } from "@ngrx/store";\nconst p = { provide: USER_PROVIDED_META_REDUCERS, useValue: [] };\n`
      );
    });

    it('should rename inject() and other references', async () => {
      await verify(
        `import { META_REDUCERS } from '@ngrx/store';\nconst r = inject(META_REDUCERS);\nclass C { constructor(@Inject(META_REDUCERS) r: any) {} }\n`,
        `import { USER_PROVIDED_META_REDUCERS } from '@ngrx/store';\nconst r = inject(USER_PROVIDED_META_REDUCERS);\nclass C { constructor(@Inject(USER_PROVIDED_META_REDUCERS) r: any) {} }\n`
      );
    });

    it('should leave a META_REDUCERS from another library alone', async () => {
      const input = `import { META_REDUCERS } from 'my-lib';\nconst p = { provide: META_REDUCERS, useValue: [] };\n`;
      await verify(input, input);
    });

    it('should not log for files that do not import @ngrx/store', async () => {
      const logs = await verify(
        `export const a = 1;\n`,
        `export const a = 1;\n`
      );
      expect(logs).toEqual([]);
    });
  });
});
