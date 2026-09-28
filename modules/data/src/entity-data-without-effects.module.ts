import { ModuleWithProviders, NgModule } from '@angular/core';
import { EntityDataModuleConfig } from './entity-data-config';
import {
  BASE_ENTITY_DATA_PROVIDERS,
  provideEntityDataConfig,
} from './provide-entity-data';

/**
 * The entity data module without effects or data services, so it makes no
 * HTTP calls. Helpful for testing, and for apps that handle server access on
 * their own and therefore opt out of @ngrx/effects for entities.
 * Configure with `forRoot`; `EntityDataModule` adds the effects to it.
 */
@NgModule({
  providers: [BASE_ENTITY_DATA_PROVIDERS],
})
export class EntityDataModuleWithoutEffects {
  static forRoot(
    config: EntityDataModuleConfig
  ): ModuleWithProviders<EntityDataModuleWithoutEffects> {
    return {
      ngModule: EntityDataModuleWithoutEffects,
      providers: [provideEntityDataConfig(config)],
    };
  }
}
