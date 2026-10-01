import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createPackageJson } from '@ngrx/schematics-core/testing/create-package';

describe('Effects Migration 9_0_0', () => {
  let appTree: UnitTestTree;
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/effects/migrations/migration.json'
  );
  const pkgName = 'effects';

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

  describe('Replaces resubscribeOnError with useEffectsErrorHandler in effect options', () => {
    describe('should replace resubscribeOnError configuration key with useEffectsErrorHandler', () => {
      it('in createEffect() effect creator', async () => {
        const input = `
  import { Injectable } from '@angular/core';
  import { Actions, ofType, createEffect } from '@ngrx/effects';
  import { tap } from 'rxjs/operators';

  @Injectable()
  export class LogEffects {
    constructor(private actions$: Actions) {}

    logActions$ = createEffect(() =>
      this.actions$.pipe(
        tap(action => console.log(action))
      ), { resubscribeOnError: false });
  }
        `;

        const expected = `
  import { Injectable } from '@angular/core';
  import { Actions, ofType, createEffect } from '@ngrx/effects';
  import { tap } from 'rxjs/operators';

  @Injectable()
  export class LogEffects {
    constructor(private actions$: Actions) {}

    logActions$ = createEffect(() =>
      this.actions$.pipe(
        tap(action => console.log(action))
      ), { useEffectsErrorHandler: false });
  }
        `;

        await test(input, expected);
      });

      it('in @Effect() decorator', async () => {
        const input = `
  import { Injectable } from '@angular/core';
  import { Actions, Effect, ofType } from '@ngrx/effects';
  import { tap } from 'rxjs/operators';

  @Injectable()
  export class LogEffects {
    constructor(private actions$: Actions) {}

    @Effect({ resubscribeOnError: false })
    logActions$ = this.actions$.pipe(
      tap(action => console.log(action))
    )
  }
        `;

        const expected = `
  import { Injectable } from '@angular/core';
  import { Actions, Effect, ofType } from '@ngrx/effects';
  import { tap } from 'rxjs/operators';

  @Injectable()
  export class LogEffects {
    constructor(private actions$: Actions) {}

    @Effect({ useEffectsErrorHandler: false })
    logActions$ = this.actions$.pipe(
      tap(action => console.log(action))
    )
  }
        `;

        await test(input, expected);
      });
    });

    describe('should not replace non-ngrx identifiers', () => {
      it('in module scope', async () => {
        const input = `
export const resubscribeOnError = null;
      `;

        await test(input, input);
      });

      it('within create effect callback', async () => {
        const input = `
import { Injectable } from '@angular/core';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { tap } from 'rxjs/operators';

@Injectable()
export class LogEffects {
  constructor(private actions$: Actions) {}

  logActions$ = createEffect(() =>
    this.actions$.pipe(
      tap(resubscribeOnError => console.log(resubscribeOnError))
    ));
}
      `;

        await test(input, input);
      });
    });

    describe('should rename only the config key', () => {
      const imp = `import { createEffect, Effect } from '@ngrx/effects';\n`;

      it('keeps a value with the same name', async () => {
        await test(
          imp +
            `const resubscribeOnError = false;\na$ = createEffect(() => x$, { resubscribeOnError: resubscribeOnError });\nclass E { @Effect({ resubscribeOnError: this.resubscribeOnError }) b$ = x$; }\n`,
          imp +
            `const resubscribeOnError = false;\na$ = createEffect(() => x$, { useEffectsErrorHandler: resubscribeOnError });\nclass E { @Effect({ useEffectsErrorHandler: this.resubscribeOnError }) b$ = x$; }\n`
        );
      });

      it('expands a shorthand property', async () => {
        await test(
          imp +
            `const resubscribeOnError = false;\na$ = createEffect(() => x$, { resubscribeOnError });\n`,
          imp +
            `const resubscribeOnError = false;\na$ = createEffect(() => x$, { useEffectsErrorHandler: resubscribeOnError });\n`
        );
      });

      it('migrates an aliased createEffect', async () => {
        await test(
          `import { createEffect as ce } from '@ngrx/effects';\na$ = ce(() => x$, { resubscribeOnError: false });\n`,
          `import { createEffect as ce } from '@ngrx/effects';\na$ = ce(() => x$, { useEffectsErrorHandler: false });\n`
        );
      });

      it('warns about a config passed as a variable', async () => {
        const input =
          imp +
          `const config = { resubscribeOnError: false };\na$ = createEffect(() => x$, config);\n`;
        const runner = new SchematicTestRunner('schematics', collectionPath);
        const logs: string[] = [];
        runner.logger.subscribe((entry) => logs.push(entry.message));
        appTree.create('./app.module.ts', input);

        const newTree = await runner.runSchematic(
          `ngrx-${pkgName}-migration-02`,
          {},
          appTree
        );

        expect(newTree.readContent('app.module.ts')).toBe(input);
        expect(logs).toContainEqual(
          expect.stringContaining(
            "the effect config 'config' is not an object literal"
          )
        );
      });
    });

    async function test(input: string, expected: string) {
      appTree.create('./app.module.ts', input);
      const runner = new SchematicTestRunner('schematics', collectionPath);

      const newTree = await runner.runSchematic(
        `ngrx-${pkgName}-migration-02`,
        {},
        appTree
      );
      const file = newTree.readContent('app.module.ts');

      expect(file).toBe(expected);
    }
  });
});
