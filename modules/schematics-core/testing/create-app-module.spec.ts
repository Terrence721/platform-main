import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import {
  createAppModule,
  createAppModuleWithEffects,
} from './create-app-module';

describe('create-app-module testing helpers', () => {
  it('creates the default app module file', () => {
    const tree = new UnitTestTree(Tree.empty());

    createAppModule(tree);

    expect(tree.exists('/src/app/app.module.ts')).toBe(true);
    expect(tree.readContent('/src/app/app.module.ts')).toContain('AppModule');
  });

  it('creates an app module at a custom path with effects', () => {
    const tree = new UnitTestTree(Tree.empty());

    createAppModuleWithEffects(
      tree,
      '/src/custom.module.ts',
      'EffectsModule.forRoot([])'
    );

    expect(tree.exists('/src/custom.module.ts')).toBe(true);
    const content = tree.readContent('/src/custom.module.ts');
    expect(content).toContain('EffectsModule');
    expect(content).toContain('EffectsModule.forRoot([])');
  });
});
