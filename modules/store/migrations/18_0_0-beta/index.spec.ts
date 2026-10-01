import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { createWorkspace } from '@ngrx/schematics-core/testing';
import * as path from 'path';
import { tags } from '@angular-devkit/core';

describe('Store Migration to 18.0.0-beta', () => {
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/store/migrations/migration.json'
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
    appTree.create(
      'other.ts',
      `const action: TypedAction<'[SOURCE] Event'> = { type: '[SOURCE] Event' };`
    );

    const tree = await schematicRunner.runSchematic(
      `ngrx-store-migration-18-beta`,
      {},
      appTree
    );

    const actual = tree.readContent('main.ts');
    expect(actual).toBe(output);

    const other = tree.readContent('other.ts');
    expect(other).toBe(
      `const action: TypedAction<'[SOURCE] Event'> = { type: '[SOURCE] Event' };`
    );
  };

  describe('replacements', () => {
    it('should replace the import', async () => {
      const input = tags.stripIndent`
import { TypedAction } from '@ngrx/store/src/models';

const action: TypedAction<'[SOURCE] Event'> = { type: '[SOURCE] Event' };

export type ActionCreatorWithOptionalProps<T> = T extends undefined
  ? ActionCreator<string, () => TypedAction<string>>
  : ActionCreator<
      string,
      (props: T & NotAllowedCheck<T & object>) => T & TypedAction<string>
    >;

class Fixture {
  errorHandler(input?: (payload?: any) => TypedAction<any>): Action | never {}
}`;
      const output = tags.stripIndent`
import { Action } from '@ngrx/store';

const action: Action<'[SOURCE] Event'> = { type: '[SOURCE] Event' };

export type ActionCreatorWithOptionalProps<T> = T extends undefined
  ? ActionCreator<string, () => Action<string>>
  : ActionCreator<
      string,
      (props: T & NotAllowedCheck<T & object>) => T & Action<string>
    >;

class Fixture {
  errorHandler(input?: (payload?: any) => Action<any>): Action | never {}
}`;

      await verifySchematic(input, output);
    });

    it('should also work with " in imports', async () => {
      const input = tags.stripIndent`
import { TypedAction } from "@ngrx/store/src/models";
const action: TypedAction<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
`;
      const output = tags.stripIndent`
import { Action } from '@ngrx/store';
const action: Action<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
`;
      await verifySchematic(input, output);
    });

    it('should replace if multiple imports are inside an import statement', async () => {
      const input = tags.stripIndent`
import { TypedAction, ActionReducer } from '@ngrx/store/src/models';

const action: TypedAction<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
      `;
      const output = tags.stripIndent`
import { ActionReducer } from '@ngrx/store/src/models';
import { Action } from '@ngrx/store';

const action: Action<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
      `;

      await verifySchematic(input, output);
    });

    it('should add Action to existing import', async () => {
      const input = tags.stripIndent`
import { TypedAction } from '@ngrx/store/src/models';
import { createAction } from '@ngrx/store';

const action: TypedAction<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
      `;
      const output = tags.stripIndent`
import { createAction, Action } from '@ngrx/store';

const action: Action<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
      `;
      await verifySchematic(input, output);
    });

    it('should not add Action if already exists', async () => {
      const input = tags.stripIndent`
import { TypedAction } from '@ngrx/store/src/models';
import { Action } from '@ngrx/store';

const action: TypedAction<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
      `;
      const output = tags.stripIndent`
import { Action } from '@ngrx/store';

const action: Action<'[SOURCE] Event'> = { type: '[SOURCE] Event' };
      `;
      await verifySchematic(input, output);
    });
  });

  describe('imports and line breaks', () => {
    const models = `import { TypedAction } from '@ngrx/store/src/models';\n`;

    it('should not add Action to an @ngrx/store-devtools import', async () => {
      await verifySchematic(
        models +
          `import { StoreDevtoolsModule } from '@ngrx/store-devtools';\nlet a: TypedAction<'x'>;\n`,
        `import { Action } from '@ngrx/store';\nimport { StoreDevtoolsModule } from '@ngrx/store-devtools';\nlet a: Action<'x'>;\n`
      );
    });

    it('should leave files without TypedAction alone', async () => {
      const input = `import { ActionReducer } from '@ngrx/store/src/models';\nimport { createAction } from '@ngrx/store';\nlet r: ActionReducer<any>;\n`;
      await verifySchematic(input, input);
    });

    it('should keep aliases and type modifiers', async () => {
      await verifySchematic(
        `import { TypedAction, ActionReducer as AR } from '@ngrx/store/src/models';\nlet a: TypedAction<'x'>; let r: AR<any>;\n`,
        `import { ActionReducer as AR } from '@ngrx/store/src/models';\nimport { Action } from '@ngrx/store';\nlet a: Action<'x'>; let r: AR<any>;\n`
      );
      appTree.delete('main.ts');
      appTree.delete('other.ts');
      await verifySchematic(
        `import { type TypedAction, type ActionReducer } from '@ngrx/store/src/models';\nlet a: TypedAction<'x'>;\n`,
        `import { type ActionReducer } from '@ngrx/store/src/models';\nimport { type Action } from '@ngrx/store';\nlet a: Action<'x'>;\n`
      );
    });

    it('should import Action under the alias of TypedAction', async () => {
      await verifySchematic(
        `import { TypedAction as TA } from '@ngrx/store/src/models';\nlet a: TA<'x'>;\n`,
        `import { Action as TA } from '@ngrx/store';\nlet a: TA<'x'>;\n`
      );
    });

    it('should keep Windows line endings', async () => {
      await verifySchematic(
        `import { TypedAction } from '@ngrx/store/src/models';\r\nlet a: TypedAction<'x'>;\r\n`,
        `import { Action } from '@ngrx/store';\r\nlet a: Action<'x'>;\r\n`
      );
    });

    it('should handle the import on the last line without a line break', async () => {
      await verifySchematic(
        `let a: TypedAction<'x'>;\nimport { TypedAction } from '@ngrx/store/src/models';`,
        `let a: Action<'x'>;\nimport { Action } from '@ngrx/store';`
      );
    });

    it('should leave object keys alone', async () => {
      await verifySchematic(
        models + `const o = { TypedAction: 1 };\nlet a: TypedAction<'x'>;\n`,
        `import { Action } from '@ngrx/store';\nconst o = { TypedAction: 1 };\nlet a: Action<'x'>;\n`
      );
    });
  });
});
