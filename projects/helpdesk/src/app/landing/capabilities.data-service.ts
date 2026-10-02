import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DefaultDataService, HttpUrlGenerator } from '@ngrx/data';
import { defer, Observable, of } from 'rxjs';
import { CAPABILITIES, Capability, CAPABILITY } from './capability';

/**
 * Serves the landing page's capabilities from the app itself, in place of
 * @ngrx/data's HTTP default for this one entity. Only reading is served:
 * the page never changes a capability. When the API can serve them, this
 * class goes away and the section keeps working unchanged.
 */
@Injectable({ providedIn: 'root' })
export class CapabilitiesDataService extends DefaultDataService<Capability> {
  constructor() {
    super(CAPABILITY, inject(HttpClient), inject(HttpUrlGenerator));
  }

  override getAll(): Observable<Capability[]> {
    return defer(() =>
      of(CAPABILITIES.map((capability) => ({ ...capability })))
    );
  }
}
