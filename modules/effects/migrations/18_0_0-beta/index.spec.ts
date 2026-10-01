import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { createWorkspace } from '@ngrx/schematics-core/testing';
import { tags, logging } from '@angular-devkit/core';
import * as path from 'path';

describe('Effects Migration to 18.0.0-beta', () => {
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/effects/migrations/migration.json'
  );
  const schematicRunner = new SchematicTestRunner('schematics', collectionPath);

  let baseTree: UnitTestTree;
  let appTree: UnitTestTree;

  beforeAll(async () => {
    baseTree = await createWorkspace(schematicRunner, appTree);
  });

  beforeEach(() => {
    appTree = new UnitTestTree(baseTree.branch());
  });

  const verifySchematic = async (input: string, output: string) => {
    appTree.create('main.ts', input);

    const tree = await schematicRunner.runSchematic(
      `ngrx-effects-migration-18-beta`,
      {},
      appTree
    );

    const actual = tree.readContent('main.ts');

    expect(actual).toBe(output);
  };

  describe('replacements', () => {
    it('should replace the import', async () => {
      const input = tags.stripIndent`
import { concatLatestFrom } from '@ngrx/effects';

@Injectable()
export class SomeEffects {

}
      `;
      const output = tags.stripIndent`
import { concatLatestFrom } from '@ngrx/operators';

@Injectable()
export class SomeEffects {

}
      `;

      await verifySchematic(input, output);
    });

    it('should also work with " in imports', async () => {
      const input = tags.stripIndent`
import { concatLatestFrom } from "@ngrx/effects";

@Injectable()
export class SomeEffects {

}
      `;
      const output = tags.stripIndent`
import { concatLatestFrom } from '@ngrx/operators';

@Injectable()
export class SomeEffects {

}
      `;
      await verifySchematic(input, output);
    });

    it('should replace if multiple imports are inside an import statement', async () => {
      const input = tags.stripIndent`
import { Actions, concatLatestFrom } from '@ngrx/effects';

@Injectable()
export class SomeEffects {
  actions$ = inject(Actions);

}
      `;
      const output = tags.stripIndent`
import { Actions } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';

@Injectable()
export class SomeEffects {
  actions$ = inject(Actions);

}
      `;

      await verifySchematic(input, output);
    });

    it('should add concatLatestFrom to existing import', async () => {
      const input = tags.stripIndent`
import { Actions, concatLatestFrom } from '@ngrx/effects';
import { tapResponse } from '@ngrx/operators';

@Injectable()
export class SomeEffects {
  actions$ = inject(Actions);

}
      `;
      const output = tags.stripIndent`
import { Actions } from '@ngrx/effects';
import { tapResponse, concatLatestFrom } from '@ngrx/operators';

@Injectable()
export class SomeEffects {
  actions$ = inject(Actions);

}
      `;
      await verifySchematic(input, output);
    });
  });

  it('should work with prior import from same namespace', async () => {
    const input = tags.stripIndent`
import { Actions } from '@ngrx/effects';
import { concatLatestFrom, createEffect, ofType } from '@ngrx/effects';

class SomeEffects {}
      `;
    const output = tags.stripIndent`
import { Actions } from '@ngrx/effects';
import { createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';

class SomeEffects {}
      `;
    await verifySchematic(input, output);
  });

  it('should operate on multiple files', async () => {
    const inputMainOne = tags.stripIndent`
import { Actions, concatLatestFrom, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';

class SomeEffects {}
`;

    const outputMainOne = tags.stripIndent`
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { tap } from 'rxjs/operators';

class SomeEffects {}
`;

    const inputMainTwo = tags.stripIndent`
import { provideEffects } from '@ngrx/effects';
import { Actions, concatLatestFrom, createEffect, ofType } from '@ngrx/effects';

class SomeEffects {}
`;

    const outputMainTwo = tags.stripIndent`
import { provideEffects } from '@ngrx/effects';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';

class SomeEffects {}
`;
    appTree.create('mainOne.ts', inputMainOne);
    appTree.create('mainTwo.ts', inputMainTwo);

    const tree = await schematicRunner.runSchematic(
      `ngrx-effects-migration-18-beta`,
      {},
      appTree
    );

    const actualMainOne = tree.readContent('mainOne.ts');
    const actualMainTwo = tree.readContent('mainTwo.ts');

    expect(actualMainOne).toBe(outputMainOne);
    expect(actualMainTwo).toBe(outputMainTwo);
  });

  it('should report an info on multiple imports of concatLatestFrom', async () => {
    const input = tags.stripIndent`
import { concatLatestFrom } from '@ngrx/effects';
import { concatLatestFrom, createEffect, ofType } from '@ngrx/effects';

class SomeEffects {}
      `;

    appTree.create('main.ts', input);
    const logEntries: logging.LogEntry[] = [];
    schematicRunner.logger.subscribe((logEntry) => logEntries.push(logEntry));
    await schematicRunner.runSchematic(
      `ngrx-effects-migration-18-beta`,
      {},
      appTree
    );

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]).toMatchObject({
      message:
        '[@ngrx/effects] Skipping because of multiple `concatLatestFrom` imports',
      level: 'info',
    });
  });

  it('should add @ngrx/operators if they are missing', async () => {
    const originalPackageJson = JSON.parse(
      appTree.readContent('/package.json')
    );
    expect(originalPackageJson.dependencies['@ngrx/operators']).toBeUndefined();
    expect(
      originalPackageJson.devDependencies['@ngrx/operators']
    ).toBeUndefined();

    const tree = await schematicRunner.runSchematic(
      `ngrx-effects-migration-18-beta`,
      {},
      appTree
    );

    const packageJson = JSON.parse(tree.readContent('/package.json'));
    expect(packageJson.dependencies['@ngrx/operators']).toBeDefined();
  });

  describe('aliases and modifiers', () => {
    it('should move an aliased concatLatestFrom and keep its local name', async () => {
      await verifySchematic(
        `import { concatLatestFrom as clf } from '@ngrx/effects';\nconst x = clf;\n`,
        `import { concatLatestFrom as clf } from '@ngrx/operators';\nconst x = clf;\n`
      );
    });

    it('should keep the aliases of the other effects imports', async () => {
      await verifySchematic(
        `import { Actions as A, concatLatestFrom } from '@ngrx/effects';\nconst x = [A, concatLatestFrom];\n`,
        `import { Actions as A } from '@ngrx/effects';\nimport { concatLatestFrom } from '@ngrx/operators';\nconst x = [A, concatLatestFrom];\n`
      );
    });

    it('should keep a type modifier', async () => {
      await verifySchematic(
        `import { type EffectConfig, concatLatestFrom } from '@ngrx/effects';\n`,
        `import { type EffectConfig } from '@ngrx/effects';\nimport { concatLatestFrom } from '@ngrx/operators';\n`
      );
    });
  });

  describe('line breaks', () => {
    it('should keep Windows line endings', async () => {
      await verifySchematic(
        `import { Actions, concatLatestFrom } from '@ngrx/effects';\r\nconst x = concatLatestFrom;\r\n`,
        `import { Actions } from '@ngrx/effects';\r\nimport { concatLatestFrom } from '@ngrx/operators';\r\nconst x = concatLatestFrom;\r\n`
      );
    });

    it('should not leave a blank line with Windows line endings', async () => {
      await verifySchematic(
        `import { concatLatestFrom } from '@ngrx/effects';\r\nconst x = concatLatestFrom;\r\n`,
        `import { concatLatestFrom } from '@ngrx/operators';\r\nconst x = concatLatestFrom;\r\n`
      );
    });

    it('should handle the import on the last line without a line break', async () => {
      await verifySchematic(
        `const a = 1;\nimport { concatLatestFrom } from '@ngrx/effects';`,
        `const a = 1;\nimport { concatLatestFrom } from '@ngrx/operators';`
      );
    });
  });

  it('should warn about concatLatestFrom used through a namespace import', async () => {
    const input = `import * as fx from '@ngrx/effects';\nconst x = fx.concatLatestFrom;\n`;
    appTree.create('main.ts', input);
    const logEntries: logging.LogEntry[] = [];
    schematicRunner.logger.subscribe((logEntry) => logEntries.push(logEntry));

    const tree = await schematicRunner.runSchematic(
      `ngrx-effects-migration-18-beta`,
      {},
      appTree
    );

    expect(tree.readContent('main.ts')).toBe(input);
    expect(logEntries).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining(
          'uses concatLatestFrom through a namespace import'
        ),
      })
    );
  });
});
