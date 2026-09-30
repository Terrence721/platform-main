import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import { createWorkspace } from '@ngrx/schematics-core/testing';
import { tags, logging } from '@angular-devkit/core';
import * as path from 'path';

describe('18_0_0-rc_3-writablestatesource', () => {
  const collectionPath = path.join(
    process.cwd(),
    'dist/modules/signals/migrations/migration.json'
  );
  const schematicRunner = new SchematicTestRunner('schematics', collectionPath);

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  const verifySchematic = async (
    input: string,
    output: string
  ): Promise<logging.LogEntry[]> => {
    appTree.create('main.ts', input);

    const logEntries: logging.LogEntry[] = [];
    schematicRunner.logger.subscribe((logEntry) => logEntries.push(logEntry));

    const tree = await schematicRunner.runSchematic(
      `18_0_0-rc_3-writablestatesource`,
      {},
      appTree
    );

    const actual = tree.readContent('main.ts');
    expect(actual).toBe(output);

    return logEntries;
  };

  it('replaces StateSignal references to WritableStateSource', async () => {
    const input = tags.stripIndent`
import { StateSignal, patchState } from '@ngrx/signals';

function updateCount(state: StateSignal<{ count: number }>, count: number): void {
  patchState(state, { count });
}

function updateCount2(state: StateSignal<{ count: number }>, count: number): void {
  patchState(state, { count });
}`;
    const output = tags.stripIndent`
import { WritableStateSource, patchState } from '@ngrx/signals';

function updateCount(state: WritableStateSource<{ count: number }>, count: number): void {
  patchState(state, { count });
}

function updateCount2(state: WritableStateSource<{ count: number }>, count: number): void {
  patchState(state, { count });
}`;

    const logEntries = await verifySchematic(input, output);

    expect(logEntries).toHaveLength(2);
    expect(logEntries[0]).toMatchObject({
      message: `[@ngrx/signals] Migrating 'StateSignal' to 'WritableStateSource'`,
      level: 'info',
    });
    expect(logEntries[1]).toMatchObject({
      message: `[@ngrx/signals] Updated 2 references from 'StateSignal' to 'WritableStateSource'`,
      level: 'info',
    });
  });

  it('does nothing if StateSignal is imported from other package', async () => {
    const input = tags.stripIndent`
import { StateSignal, patchState } from '@awesome-lib';

function updateCount(state: StateSignal<{ count: number }>, count: number): void {
  patchState(state, { count });
}`;

    const logEntries = await verifySchematic(input, input);

    expect(logEntries).toHaveLength(2);
    expect(logEntries[0]).toMatchObject({
      message: `[@ngrx/signals] Migrating 'StateSignal' to 'WritableStateSource'`,
      level: 'info',
    });
    expect(logEntries[1]).toMatchObject({
      message: `[@ngrx/signals] No 'StateSignal' references found, skipping the migration`,
      level: 'info',
    });
  });

  describe('import forms', () => {
    it('should migrate an aliased import', async () => {
      await verifySchematic(
        `import { StateSignal as SS } from '@ngrx/signals';\nlet s: SS<{}>;\n`,
        `import { WritableStateSource as SS } from '@ngrx/signals';\nlet s: SS<{}>;\n`
      );
    });

    it('should keep a type modifier', async () => {
      await verifySchematic(
        `import { type StateSignal, signalStore } from '@ngrx/signals';\nlet s: StateSignal<{}>;\n`,
        `import { type WritableStateSource, signalStore } from '@ngrx/signals';\nlet s: WritableStateSource<{}>;\n`
      );
    });

    it('should migrate uses through a namespace import', async () => {
      await verifySchematic(
        `import * as ngrx from '@ngrx/signals';\nlet s: ngrx.StateSignal<{}>;\n`,
        `import * as ngrx from '@ngrx/signals';\nlet s: ngrx.WritableStateSource<{}>;\n`
      );
    });

    it('should leave object keys and other properties alone', async () => {
      await verifySchematic(
        `import { StateSignal } from '@ngrx/signals';\nlet s: StateSignal<{}>;\nconst o = { StateSignal: 1 };\nfoo.StateSignal;\n`,
        `import { WritableStateSource } from '@ngrx/signals';\nlet s: WritableStateSource<{}>;\nconst o = { StateSignal: 1 };\nfoo.StateSignal;\n`
      );
    });
  });
});
