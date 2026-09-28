import { ModuleWithProviders, NgModule } from '@angular/core';
import { EntityDataModuleConfig } from './entity-data-config';
import { EntityDataModuleWithoutEffects } from './entity-data-without-effects.module';
import {
  ENTITY_DATA_EFFECTS_PROVIDERS,
  provideEntityDataConfig,
} from './provide-entity-data';

/**
 * The main entity data module, with effects and HTTP data services.
 * Configure with `forRoot`; there is no `forFeature`.
 *
 * The app must also set up @ngrx/effects (`EffectsModule.forRoot()` or
 * `provideEffects()`). This module only registers its effects; without that
 * setup they never run, so queries and saves silently reach no server.
 * Use `EntityDataModuleWithoutEffects` to opt out of effects on purpose.
 */
@NgModule({
  imports: [EntityDataModuleWithoutEffects],
  providers: [ENTITY_DATA_EFFECTS_PROVIDERS],
})
export class EntityDataModule {
  static forRoot(
    config: EntityDataModuleConfig
  ): ModuleWithProviders<EntityDataModule> {
    return {
      ngModule: EntityDataModule,
      providers: [provideEntityDataConfig(config)],
    };
  }
}
