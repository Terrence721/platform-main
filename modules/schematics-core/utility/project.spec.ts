import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import {
  getProject,
  getProjectPath,
  isLib,
  getProjectMainFile,
} from './project';

function createWorkspaceTree(workspace: Record<string, unknown>) {
  const tree = new UnitTestTree(Tree.empty());
  tree.create('/angular.json', JSON.stringify(workspace));
  return tree;
}

const appProject = {
  root: 'projects/bar',
  projectType: 'application',
  architect: {
    build: { options: { browser: 'projects/bar/src/main.ts' } },
  },
};

const legacyAppProject = {
  root: 'projects/legacy',
  projectType: 'application',
  architect: {
    build: { options: { main: 'projects/legacy/src/main.ts' } },
  },
};

const libProject = {
  root: 'projects/baz',
  projectType: 'library',
  architect: {},
};

describe('project utilities', () => {
  describe('getProject', () => {
    it('resolves the named project', () => {
      const tree = createWorkspaceTree({
        projects: { bar: appProject, baz: libProject },
      });

      expect(getProject(tree, { project: 'bar' })).toEqual(appProject);
    });

    it('falls back to the workspace defaultProject when none is specified', () => {
      const tree = createWorkspaceTree({
        defaultProject: 'baz',
        projects: { bar: appProject, baz: libProject },
      });

      expect(getProject(tree, {})).toEqual(libProject);
    });

    it('falls back to the first project when there is no defaultProject', () => {
      const tree = createWorkspaceTree({
        projects: { bar: appProject, baz: libProject },
      });

      expect(getProject(tree, {})).toEqual(appProject);
    });

    it('throws a clear error for a project name that does not exist', () => {
      const tree = createWorkspaceTree({
        projects: { bar: appProject },
      });

      expect(() => getProject(tree, { project: 'does-not-exist' })).toThrow(
        "Project 'does-not-exist' does not exist."
      );
    });
  });

  describe('getProjectPath', () => {
    it('trims a trailing slash from the project root', () => {
      const tree = createWorkspaceTree({
        projects: { bar: { ...appProject, root: 'projects/bar/' } },
      });

      expect(getProjectPath(tree, { project: 'bar' })).toBe(
        '/projects/bar/src/app'
      );
    });

    it('defaults to src/app for an application project', () => {
      const tree = createWorkspaceTree({ projects: { bar: appProject } });

      expect(getProjectPath(tree, { project: 'bar' })).toBe(
        '/projects/bar/src/app'
      );
    });

    it('defaults to src/lib for a library project', () => {
      const tree = createWorkspaceTree({ projects: { baz: libProject } });

      expect(getProjectPath(tree, { project: 'baz' })).toBe(
        '/projects/baz/src/lib'
      );
    });

    it('returns the explicit path unchanged when provided', () => {
      const tree = createWorkspaceTree({ projects: { bar: appProject } });

      expect(
        getProjectPath(tree, { project: 'bar', path: '/custom/path' })
      ).toBe('/custom/path');
    });
  });

  describe('isLib', () => {
    it('is true for a library project', () => {
      const tree = createWorkspaceTree({ projects: { baz: libProject } });

      expect(isLib(tree, { project: 'baz' })).toBe(true);
    });

    it('is false for an application project', () => {
      const tree = createWorkspaceTree({ projects: { bar: appProject } });

      expect(isLib(tree, { project: 'bar' })).toBe(false);
    });
  });

  describe('getProjectMainFile', () => {
    it('throws for a library project', () => {
      const tree = createWorkspaceTree({ projects: { baz: libProject } });

      expect(() => getProjectMainFile(tree, { project: 'baz' })).toThrow(
        'Invalid project type'
      );
    });

    it('returns the browser entry point for the modern application builder', () => {
      const tree = createWorkspaceTree({ projects: { bar: appProject } });

      expect(getProjectMainFile(tree, { project: 'bar' })).toBe(
        'projects/bar/src/main.ts'
      );
    });

    it('falls back to the main entry point for the legacy builder', () => {
      const tree = createWorkspaceTree({
        projects: { legacy: legacyAppProject },
      });

      expect(getProjectMainFile(tree, { project: 'legacy' })).toBe(
        'projects/legacy/src/main.ts'
      );
    });
  });
});
