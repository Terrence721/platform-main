import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import {
  InsertChange,
  RemoveChange,
  ReplaceChange,
  NoopChange,
  createReplaceChange,
  createRemoveChange,
  commitChanges,
} from './change';
import ts from 'typescript';

function parse(source: string) {
  return ts.createSourceFile(
    '/sample.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
}

describe('change', () => {
  describe('InsertChange', () => {
    it('stores its constructor arguments and throws for negative positions', () => {
      const change = new InsertChange('/sample.ts', 2, 'x');

      expect(change.path).toBe('/sample.ts');
      expect(change.pos).toBe(2);
      expect(change.toAdd).toBe('x');

      expect(() => new InsertChange('/sample.ts', -1, 'x')).toThrow(
        'Negative positions are invalid'
      );
    });
  });

  describe('RemoveChange', () => {
    it('stores its constructor arguments and throws for negative positions', () => {
      const change = new RemoveChange('/sample.ts', 1, 3);

      expect(change.path).toBe('/sample.ts');
      expect(change.pos).toBe(1);
      expect(change.end).toBe(3);

      expect(() => new RemoveChange('/sample.ts', -1, 3)).toThrow(
        'Negative positions are invalid'
      );
      expect(() => new RemoveChange('/sample.ts', 1, -1)).toThrow(
        'Negative positions are invalid'
      );
    });
  });

  describe('ReplaceChange', () => {
    it('stores its constructor arguments and throws for negative positions', () => {
      const change = new ReplaceChange('/sample.ts', 2, 'old', 'new');

      expect(change.oldText).toBe('old');
      expect(change.newText).toBe('new');

      expect(() => new ReplaceChange('/sample.ts', -1, 'old', 'new')).toThrow(
        'Negative positions are invalid'
      );
    });
  });

  describe('NoopChange', () => {
    it('implements Change with an infinite order', () => {
      const change = new NoopChange();

      expect(change.order).toBe(Infinity);
      expect(change.path).toBeNull();
    });
  });

  describe('createReplaceChange / createRemoveChange', () => {
    it('build changes anchored at the given node', () => {
      const sourceFile = parse('const value = old;');
      const node = (sourceFile.statements[0] as ts.VariableStatement)
        .declarationList.declarations[0].initializer!;

      expect(createReplaceChange(sourceFile, node, 'old', 'new').newText).toBe(
        'new'
      );
      expect(createRemoveChange(sourceFile, node).end).toBeGreaterThan(
        createRemoveChange(sourceFile, node).pos
      );
    });
  });

  describe('commitChanges', () => {
    it('returns false and changes nothing when there are no changes', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/sample.ts', 'abc');

      expect(commitChanges(tree, '/sample.ts', [])).toBe(false);
      expect(tree.readContent('/sample.ts')).toBe('abc');
    });

    it('applies an insert change through the change recorder', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/sample.ts', 'abc');

      const committed = commitChanges(tree, '/sample.ts', [
        new InsertChange('/sample.ts', 0, 'X'),
      ]);

      expect(committed).toBe(true);
      expect(tree.readContent('/sample.ts')).toBe('Xabc');
    });

    it('applies a remove change through the change recorder', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/sample.ts', 'abcde');

      commitChanges(tree, '/sample.ts', [new RemoveChange('/sample.ts', 1, 3)]);

      expect(tree.readContent('/sample.ts')).toBe('ade');
    });

    it('applies a replace change through the change recorder', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/sample.ts', 'abcde');

      commitChanges(tree, '/sample.ts', [
        new ReplaceChange('/sample.ts', 1, 'bc', 'X'),
      ]);

      expect(tree.readContent('/sample.ts')).toBe('aXde');
    });
  });
});
