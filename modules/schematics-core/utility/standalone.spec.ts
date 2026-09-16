import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import {
  addFunctionalProvidersToStandaloneBootstrap,
  callsProvidersFunction,
} from './standalone';

function createTree(): UnitTestTree {
  return new UnitTestTree(Tree.empty());
}

describe('standalone', () => {
  describe('callsProvidersFunction', () => {
    it('returns true when the function is already called in the bootstrap config', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';
          import { provideStore } from '@ngrx/store';

          bootstrapApplication(AppComponent, {
            providers: [provideStore()],
          });
        `
      );

      expect(callsProvidersFunction(tree, '/main.ts', 'provideStore')).toBe(
        true
      );
    });

    it('returns false when the function is not called', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';

          bootstrapApplication(AppComponent, { providers: [] });
        `
      );

      expect(callsProvidersFunction(tree, '/main.ts', 'provideStore')).toBe(
        false
      );
    });
  });

  describe('addFunctionalProvidersToStandaloneBootstrap', () => {
    it('throws when there is no bootstrapApplication call in the target file', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { AppComponent } from './app/app.component';
        `
      );

      expect(() =>
        addFunctionalProvidersToStandaloneBootstrap(
          tree,
          '/main.ts',
          'provideStore',
          '@ngrx/store'
        )
      ).toThrow('Could not find bootstrapApplication call in /main.ts');
    });

    it('creates a new config object when bootstrapApplication has a single argument', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';

          bootstrapApplication(AppComponent);
        `
      );

      const result = addFunctionalProvidersToStandaloneBootstrap(
        tree,
        '/main.ts',
        'provideStore',
        '@ngrx/store'
      );

      const content = tree.readText('/main.ts');
      expect(result).toBe('/main.ts');
      expect(content).toContain("import { provideStore } from '@ngrx/store';");
      expect(content).toMatch(
        /bootstrapApplication\(AppComponent, \{\s*providers: \[provideStore\(\)\]\s*\}\)/
      );
    });

    it('merges into an existing inline providers array', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';
          import { provideRouter } from '@angular/router';

          bootstrapApplication(AppComponent, {
            providers: [provideRouter([])],
          });
        `
      );

      addFunctionalProvidersToStandaloneBootstrap(
        tree,
        '/main.ts',
        'provideStore',
        '@ngrx/store'
      );

      const content = tree.readText('/main.ts');
      expect(content).toMatch(
        /providers: \[provideRouter\(\[\]\), provideStore\(\)\]/
      );
    });

    it('adds a providers array to an existing config that does not have one', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';

          bootstrapApplication(AppComponent, {});
        `
      );

      addFunctionalProvidersToStandaloneBootstrap(
        tree,
        '/main.ts',
        'provideStore',
        '@ngrx/store'
      );

      const content = tree.readText('/main.ts');
      expect(content).toMatch(/providers: \[provideStore\(\)\]/);
    });

    it('resolves the app config from a same-file identifier', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';
          import { provideRouter } from '@angular/router';

          const appConfig = {
            providers: [provideRouter([])],
          };

          bootstrapApplication(AppComponent, appConfig);
        `
      );

      const result = addFunctionalProvidersToStandaloneBootstrap(
        tree,
        '/main.ts',
        'provideStore',
        '@ngrx/store'
      );

      expect(result).toBe('/main.ts');
      const content = tree.readText('/main.ts');
      expect(content).toMatch(
        /providers: \[provideRouter\(\[\]\), provideStore\(\)\]/
      );
    });

    it('resolves the app config from an identifier imported from a relative file', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';
          import { appConfig } from './app/app.config';

          bootstrapApplication(AppComponent, appConfig);
        `
      );
      tree.create(
        '/app/app.config.ts',
        `
          import { provideRouter } from '@angular/router';

          export const appConfig = {
            providers: [provideRouter([])],
          };
        `
      );

      const result = addFunctionalProvidersToStandaloneBootstrap(
        tree,
        '/main.ts',
        'provideStore',
        '@ngrx/store'
      );

      expect(result).toBe('/app/app.config.ts');
      const configContent = tree.readText('/app/app.config.ts');
      expect(configContent).toContain(
        "import { provideStore } from '@ngrx/store';"
      );
      expect(configContent).toMatch(
        /providers: \[provideRouter\(\[\]\), provideStore\(\)\]/
      );
      // The bootstrap file itself is untouched - only the config file changes.
      expect(tree.readText('/main.ts')).not.toContain('provideStore');
    });

    it('adds another config to a mergeApplicationConfig call', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { mergeApplicationConfig } from '@angular/core';
          import { AppComponent } from './app/app.component';
          import { appConfig } from './app/app.config';
          import { serverConfig } from './app/app.config.server';

          bootstrapApplication(
            AppComponent,
            mergeApplicationConfig(appConfig, serverConfig)
          );
        `
      );

      addFunctionalProvidersToStandaloneBootstrap(
        tree,
        '/main.ts',
        'provideStore',
        '@ngrx/store'
      );

      const content = tree.readText('/main.ts');
      expect(content).toContain("import { provideStore } from '@ngrx/store';");
      expect(content).toMatch(
        /mergeApplicationConfig\(appConfig, serverConfig, \{\s*providers: \[provideStore\(\)\]\s*\}\)/
      );
    });

    it('throws when the config cannot be statically analyzed', () => {
      const tree = createTree();
      tree.create(
        '/main.ts',
        `
          import { bootstrapApplication } from '@angular/platform-browser';
          import { AppComponent } from './app/app.component';

          bootstrapApplication(AppComponent, getConfig());
        `
      );

      expect(() =>
        addFunctionalProvidersToStandaloneBootstrap(
          tree,
          '/main.ts',
          'provideStore',
          '@ngrx/store'
        )
      ).toThrow(
        'Could not statically analyze config in bootstrapApplication call in /main.ts'
      );
    });
  });
});
