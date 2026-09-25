import { describe, expect, it } from 'vitest';
import { Manifest, ModuleManifest, findRangeProblems } from './version-ranges';

const peers = (module: string, peerDependencies: Record<string, string>) => ({
  module,
  manifest: { peerDependencies },
});

const root: Manifest = {
  dependencies: { tslib: '^2.8.1' },
  devDependencies: { rxjs: '7.8.2', '@angular/core': '22.1.4' },
};

describe('findRangeProblems', () => {
  describe('agreement between modules', () => {
    it('accepts modules that declare the same ranges', () => {
      const modules = [
        peers('store', { rxjs: '^6.5.3 || ^7.5.0' }),
        peers('effects', { rxjs: '^6.5.3 || ^7.5.0' }),
      ];

      expect(findRangeProblems(root, modules)).toEqual([]);
    });

    it('treats differently spelled but equal ranges as the same', () => {
      const modules = [
        peers('store', { rxjs: '^6.5.3 || ^7.5.0' }),
        peers('effects', { rxjs: '^6.5.3||^7.5.0' }),
      ];

      expect(findRangeProblems(root, modules)).toEqual([]);
    });

    it('compares a package across dependency fields', () => {
      const modules: ModuleManifest[] = [
        { module: 'store', manifest: { dependencies: { tslib: '^2.0.0' } } },
        {
          module: 'signals',
          manifest: { peerDependencies: { tslib: '^2.3.0' } },
        },
      ];

      expect(findRangeProblems(root, modules)).toEqual([
        expect.stringContaining('tslib: modules declare different ranges'),
      ]);
    });

    it('reports modules that disagree, naming each range and its modules', () => {
      const modules = [
        peers('store', { rxjs: '^6.5.3 || ^7.5.0' }),
        peers('effects', { rxjs: '^6.5.3 || ^7.5.0' }),
        peers('signals', { rxjs: '^6.5.3 || ^7.4.0' }),
      ];

      const [problem, ...rest] = findRangeProblems(root, modules);

      expect(rest).toEqual([]);
      expect(problem).toContain('rxjs: modules declare different ranges');
      expect(problem).toContain('^6.5.3 || ^7.5.0  (store, effects)');
      expect(problem).toContain('^6.5.3 || ^7.4.0  (signals)');
    });

    it('does not compare packages that only one module declares', () => {
      const modules = [
        peers('store', { rxjs: '^7.5.0' }),
        peers('effects', { '@angular/core': '^22.0.0' }),
      ];

      expect(findRangeProblems(root, modules)).toEqual([]);
    });

    it('ignores modules without dependency fields', () => {
      const modules: ModuleManifest[] = [
        { module: 'schematics-core', manifest: {} },
        peers('store', { rxjs: '^7.5.0' }),
      ];

      expect(findRangeProblems(root, modules)).toEqual([]);
    });

    it('compares ranges that are not semver as plain text', () => {
      const same = [
        peers('effects', { '@ngrx/store': '0.0.0' }),
        peers('entity', { '@ngrx/store': '0.0.0' }),
      ];
      const different = [
        peers('effects', { '@ngrx/store': 'workspace:*' }),
        peers('entity', { '@ngrx/store': 'workspace:^' }),
      ];

      expect(findRangeProblems(root, same)).toEqual([]);
      expect(findRangeProblems(root, different)).toEqual([
        expect.stringContaining(
          '@ngrx/store: modules declare different ranges'
        ),
      ]);
    });
  });

  describe('pinned deviations', () => {
    const modules = [
      peers('store', { rxjs: '^6.5.3 || ^7.5.0' }),
      peers('effects', { rxjs: '^6.5.3 || ^7.5.0' }),
      peers('signals', { rxjs: '^6.5.3 || ^7.4.0' }),
    ];
    const signalsRxjs = {
      module: 'signals',
      name: 'rxjs',
      range: '^6.5.3 || ^7.4.0',
    };

    it('allows a module to keep its pinned range', () => {
      expect(findRangeProblems(root, modules, [signalsRxjs])).toEqual([]);
    });

    it('still reports a module that deviates without being listed', () => {
      expect(findRangeProblems(root, modules, [])).toHaveLength(1);
    });

    it('fails when the module no longer declares the pinned range', () => {
      const changed = [
        ...modules.slice(0, 2),
        peers('signals', { rxjs: '^6.5.3 || ^7.6.0' }),
      ];

      expect(findRangeProblems(root, changed, [signalsRxjs])).toEqual([
        expect.stringContaining(
          'the exception pins signals to ^6.5.3 || ^7.4.0'
        ),
      ]);
    });

    it('fails when the module now agrees with the others', () => {
      const aligned = [
        ...modules.slice(0, 2),
        peers('signals', { rxjs: '^6.5.3 || ^7.5.0' }),
      ];
      const pinnedToAligned = { ...signalsRxjs, range: '^6.5.3 || ^7.5.0' };

      expect(findRangeProblems(root, aligned, [pinnedToAligned])).toEqual([
        expect.stringContaining('its range now matches the other modules'),
      ]);
    });

    it('fails when the module no longer declares the package', () => {
      const dropped = [...modules.slice(0, 2), peers('signals', {})];

      expect(findRangeProblems(root, dropped, [signalsRxjs])).toEqual([
        expect.stringContaining('the module no longer declares it'),
      ]);
    });
  });

  describe('development version inside the range', () => {
    it('accepts ranges that include the root version', () => {
      const modules = [
        peers('store', {
          rxjs: '^6.5.3 || ^7.5.0',
          '@angular/core': '^22.0.0',
        }),
        { module: 'effects', manifest: { dependencies: { tslib: '^2.0.0' } } },
      ];

      expect(findRangeProblems(root, modules)).toEqual([]);
    });

    it('reports a range that excludes the root version', () => {
      const modules = [peers('store', { '@angular/core': '^21.0.0' })];

      expect(findRangeProblems(root, modules)).toEqual([
        'store: @angular/core ^21.0.0 does not include 22.1.4, the version the repo develops against (the root declares 22.1.4)',
      ]);
    });

    it('uses the lowest version a root range allows', () => {
      const modules = [
        { module: 'store', manifest: { dependencies: { tslib: '^2.9.0' } } },
      ];

      expect(findRangeProblems(root, modules)).toEqual([
        expect.stringContaining('tslib ^2.9.0 does not include 2.8.1'),
      ]);
    });

    it('also checks modules that hold a pinned deviation', () => {
      const modules = [peers('signals', { rxjs: '^6.5.3 || ^8.0.0' })];
      const deviations = [
        { module: 'signals', name: 'rxjs', range: '^6.5.3 || ^8.0.0' },
      ];

      expect(findRangeProblems(root, modules, deviations)).toEqual([
        expect.stringContaining('rxjs ^6.5.3 || ^8.0.0 does not include 7.8.2'),
      ]);
    });

    it('accepts a wildcard range', () => {
      const modules = [peers('eslint-plugin', { rxjs: '*' })];

      expect(findRangeProblems(root, modules)).toEqual([]);
    });

    it('skips packages the root does not declare', () => {
      const modules = [peers('effects', { '@ngrx/store': '0.0.0' })];

      expect(findRangeProblems(root, modules)).toEqual([]);
    });

    it('skips ranges that are not semver', () => {
      const modules = [
        peers('effects', { rxjs: 'workspace:*' }),
        peers('store', { rxjs: 'workspace:*' }),
      ];
      const nonSemverRoot: Manifest = { devDependencies: { rxjs: 'latest' } };

      expect(findRangeProblems(root, modules)).toEqual([]);
      expect(
        findRangeProblems(nonSemverRoot, [peers('store', { rxjs: '^7.5.0' })])
      ).toEqual([]);
    });
  });
});
