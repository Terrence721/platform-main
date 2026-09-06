import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { getWorkspace, getWorkspacePath } from './config';

describe('config utilities', () => {
  describe('getWorkspacePath', () => {
    it('finds angular.json', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/angular.json', '{}');

      expect(getWorkspacePath(tree)).toBe('/angular.json');
    });

    it('falls back to .angular.json when angular.json is missing', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/.angular.json', '{}');

      expect(getWorkspacePath(tree)).toBe('/.angular.json');
    });

    it('falls back to workspace.json when neither angular.json nor .angular.json exist', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/workspace.json', '{}');

      expect(getWorkspacePath(tree)).toBe('/workspace.json');
    });

    it('throws a clear error when no workspace configuration file exists', () => {
      const tree = new UnitTestTree(Tree.empty());

      expect(() => getWorkspacePath(tree)).toThrow(
        'Could not find a workspace configuration file (checked angular.json, .angular.json, workspace.json).'
      );
    });
  });

  describe('getWorkspace', () => {
    it('parses and returns the workspace configuration', () => {
      const tree = new UnitTestTree(Tree.empty());
      const workspace = { version: 1, projects: { foo: {} } };
      tree.create('/angular.json', JSON.stringify(workspace));

      expect(getWorkspace(tree)).toEqual(workspace);
    });

    it('throws when no workspace configuration file exists', () => {
      const tree = new UnitTestTree(Tree.empty());

      expect(() => getWorkspace(tree)).toThrow(
        'Could not find a workspace configuration file (checked angular.json, .angular.json, workspace.json).'
      );
    });
  });
});
