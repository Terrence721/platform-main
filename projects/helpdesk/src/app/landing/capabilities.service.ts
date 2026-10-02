import { inject, Injectable } from '@angular/core';
import {
  EntityCollectionServiceBase,
  EntityCollectionServiceElementsFactory,
} from '@ngrx/data';
import { Capability, CAPABILITY } from './capability';

/**
 * The capabilities' entity collection: `load()` dispatches @ngrx/data's
 * query-all action, and `entities$` / `loading$` read the collection back
 * from the store. Where the data comes from is the data service's concern.
 */
@Injectable({ providedIn: 'root' })
export class CapabilitiesService extends EntityCollectionServiceBase<Capability> {
  constructor() {
    super(CAPABILITY, inject(EntityCollectionServiceElementsFactory));
  }
}
