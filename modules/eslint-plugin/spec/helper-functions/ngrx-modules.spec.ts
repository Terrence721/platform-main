import { NGRX_MODULE_PATHS, type NGRX_MODULE } from '../../src/utils';

describe('NGRX_MODULE_PATHS', () => {
  it('maps every module to its package name', () => {
    expect(NGRX_MODULE_PATHS).toEqual({
      component: '@ngrx/component',
      'component-store': '@ngrx/component-store',
      effects: '@ngrx/effects',
      store: '@ngrx/store',
      operators: '@ngrx/operators',
      signals: '@ngrx/signals',
    });
  });

  it('lists the expected modules', () => {
    expect(Object.keys(NGRX_MODULE_PATHS)).toEqual([
      'component',
      'component-store',
      'effects',
      'store',
      'operators',
      'signals',
    ]);
  });

  it('keeps the package names unique', () => {
    expect(new Set(Object.values(NGRX_MODULE_PATHS)).size).toBe(
      Object.keys(NGRX_MODULE_PATHS).length
    );
  });
});

describe('NGRX_MODULE', () => {
  it('is the key set of NGRX_MODULE_PATHS', () => {
    const modules: NGRX_MODULE[] = Object.keys(
      NGRX_MODULE_PATHS
    ) as NGRX_MODULE[];

    expect(modules).toHaveLength(6);
    expect(modules).toContain('store');
    expect(modules).toContain('signals');
  });
});
