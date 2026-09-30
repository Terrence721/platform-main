import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { createWorkspace } from '@ngrx/schematics-core/testing';
import { tags } from '@angular-devkit/core';
import * as path from 'path';
import { logging } from '@angular-devkit/core';

describe('ComponentStore Migration to 18.0.0-beta', () => {
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/component-store/migrations/migration.json'
  );
  const schematicRunner = new SchematicTestRunner('schematics', collectionPath);

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  const verifySchematic = async (input: string, output: string) => {
    appTree.create('main.ts', input);

    const tree = await schematicRunner.runSchematic(
      `ngrx-component-store-migration-18-beta`,
      {},
      appTree
    );

    const actual = tree.readContent('main.ts');

    expect(actual).toBe(output);
  };

  describe('replacements', () => {
    it('should replace the import', async () => {
      const input = tags.stripIndent`
import { tapResponse } from '@ngrx/component-store';

@Injectable()
export class MyStore extends ComponentStore {

}
      `;
      const output = tags.stripIndent`
import { tapResponse } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
      `;

      await verifySchematic(input, output);
    });

    it('should also work with " in imports', async () => {
      const input = tags.stripIndent`
import { tapResponse } from "@ngrx/component-store";

@Injectable()
export class MyStore extends ComponentStore {

}
      `;
      const output = tags.stripIndent`
import { tapResponse } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
      `;
      await verifySchematic(input, output);
    });

    it('should replace if multiple imports are inside an import statement', async () => {
      const input = tags.stripIndent`
import { ComponentStore, tapResponse } from '@ngrx/component-store';

@Injectable()
export class MyStore extends ComponentStore {

}
      `;
      const output = tags.stripIndent`
import { ComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
      `;

      await verifySchematic(input, output);
    });

    it('should add tapResponse to existing import', async () => {
      const input = tags.stripIndent`
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import { concatLatestFrom } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
      `;
      const output = tags.stripIndent`
import { ComponentStore } from '@ngrx/component-store';
import { concatLatestFrom, tapResponse } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
      `;
      await verifySchematic(input, output);
    });
  });

  it('should work with prior import from same namespace', async () => {
    const input = tags.stripIndent`
import { ComponentStore, provideComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/component-store';

export class MyStore extends ComponentStore {}
      `;
    const output = tags.stripIndent`
import { ComponentStore, provideComponentStore } from '@ngrx/component-store';
import { tapResponse } from '@ngrx/operators';

export class MyStore extends ComponentStore {}
      `;
    await verifySchematic(input, output);
  });

  it('should operate on multiple files', async () => {
    const inputMainOne = tags.stripIndent`
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import { concatLatestFrom } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
`;

    const outputMainOne = tags.stripIndent`
import { ComponentStore } from '@ngrx/component-store';
import { concatLatestFrom, tapResponse } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
`;

    const inputMainTwo = tags.stripIndent`
import { tapResponse } from "@ngrx/component-store";

@Injectable()
export class MyStore extends ComponentStore {

}
      `;
    const outputMainTwo = tags.stripIndent`
import { tapResponse } from '@ngrx/operators';

@Injectable()
export class MyStore extends ComponentStore {

}
`;
    appTree.create('mainOne.ts', inputMainOne);
    appTree.create('mainTwo.ts', inputMainTwo);

    const tree = await schematicRunner.runSchematic(
      `ngrx-component-store-migration-18-beta`,
      {},
      appTree
    );

    const actualMainOne = tree.readContent('mainOne.ts');
    const actualMainTwo = tree.readContent('mainTwo.ts');

    expect(actualMainOne).toBe(outputMainOne);
    expect(actualMainTwo).toBe(outputMainTwo);
  });

  it('should report a warning on multiple imports of tapResponse', async () => {
    const input = tags.stripIndent`
import { tapResponse } from '@ngrx/component-store';
import { tapResponse, ComponentStore } from '@ngrx/component-store';

class SomeEffects {}
      `;

    appTree.create('main.ts', input);
    const logEntries: logging.LogEntry[] = [];
    schematicRunner.logger.subscribe((logEntry) => logEntries.push(logEntry));
    await schematicRunner.runSchematic(
      `ngrx-component-store-migration-18-beta`,
      {},
      appTree
    );

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]).toMatchObject({
      message:
        '[@ngrx/component-store] Skipping because of multiple `tapResponse` imports',
      level: 'info',
    });
  });

  describe('aliases and modifiers', () => {
    it('should move an aliased tapResponse and keep its local name', async () => {
      await verifySchematic(
        `import { tapResponse as tr } from '@ngrx/component-store';\nconst x = tr;\n`,
        `import { tapResponse as tr } from '@ngrx/operators';\nconst x = tr;\n`
      );
    });

    it('should keep the aliases of the other component-store imports', async () => {
      await verifySchematic(
        `import { ComponentStore as CS, tapResponse } from '@ngrx/component-store';\nconst x = [CS, tapResponse];\n`,
        `import { ComponentStore as CS } from '@ngrx/component-store';\nimport { tapResponse } from '@ngrx/operators';\nconst x = [CS, tapResponse];\n`
      );
    });

    it('should keep the aliases of an existing @ngrx/operators import', async () => {
      await verifySchematic(
        `import { tapResponse } from '@ngrx/component-store';\nimport { concatLatestFrom as clf } from '@ngrx/operators';\nconst x = [tapResponse, clf];\n`,
        `import { concatLatestFrom as clf, tapResponse } from '@ngrx/operators';\nconst x = [tapResponse, clf];\n`
      );
    });

    it('should keep a type modifier', async () => {
      await verifySchematic(
        `import { type ComponentStoreConfig, tapResponse } from '@ngrx/component-store';\n`,
        `import { type ComponentStoreConfig } from '@ngrx/component-store';\nimport { tapResponse } from '@ngrx/operators';\n`
      );
    });

    it('should leave a package that only starts with the same name', async () => {
      const input = `import { tapResponse } from '@ngrx/component-store-extras';\n`;
      await verifySchematic(input, input);
    });
  });

  describe('line breaks', () => {
    it('should keep Windows line endings', async () => {
      await verifySchematic(
        `import { ComponentStore, tapResponse } from '@ngrx/component-store';\r\nconst x = tapResponse;\r\n`,
        `import { ComponentStore } from '@ngrx/component-store';\r\nimport { tapResponse } from '@ngrx/operators';\r\nconst x = tapResponse;\r\n`
      );
    });

    it('should not leave a blank line with Windows line endings', async () => {
      await verifySchematic(
        `import { tapResponse } from '@ngrx/component-store';\r\nconst x = tapResponse;\r\n`,
        `import { tapResponse } from '@ngrx/operators';\r\nconst x = tapResponse;\r\n`
      );
    });

    it('should handle the import on the last line without a line break', async () => {
      await verifySchematic(
        `const a = 1;\nimport { tapResponse } from '@ngrx/component-store';`,
        `const a = 1;\nimport { tapResponse } from '@ngrx/operators';`
      );
      appTree.delete('main.ts');
      await verifySchematic(
        `const a = 1;\nimport { ComponentStore, tapResponse } from '@ngrx/component-store';`,
        `const a = 1;\nimport { ComponentStore } from '@ngrx/component-store';\nimport { tapResponse } from '@ngrx/operators';`
      );
    });
  });

  it('should warn about tapResponse used through a namespace import', async () => {
    const input = `import * as cs from '@ngrx/component-store';\nconst x = cs.tapResponse;\n`;
    appTree.create('main.ts', input);
    const logEntries: logging.LogEntry[] = [];
    schematicRunner.logger.subscribe((logEntry) => logEntries.push(logEntry));

    const tree = await schematicRunner.runSchematic(
      `ngrx-component-store-migration-18-beta`,
      {},
      appTree
    );

    expect(tree.readContent('main.ts')).toBe(input);
    expect(logEntries).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining(
          'uses tapResponse through a namespace import'
        ),
      })
    );
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
      `ngrx-component-store-migration-18-beta`,
      {},
      appTree
    );

    const packageJson = JSON.parse(tree.readContent('/package.json'));
    expect(packageJson.dependencies['@ngrx/operators']).toBeDefined();
  });
});
