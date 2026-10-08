import { Injectable } from '@angular/core';
import type { EntityCollectionDataService } from '@ngrx/data';
import { defer, Observable, of, throwError } from 'rxjs';
import { CAPABILITIES, Capability, CAPABILITY } from './capability';

/** What every call but `getAll` fails with. */
const READ_ONLY_MESSAGE =
  'Capabilities are read-only and served by the app: only getAll is supported.';

/**
 * Serves the landing page's capabilities from the app itself, in place of
 * @ngrx/data's HTTP default for this one entity. It implements the data
 * service contract rather than extending the HTTP default, so nothing here
 * can reach the API: `getAll` serves fresh copies, and every other call
 * fails with `READ_ONLY_MESSAGE`, which @ngrx/data reports as an error
 * action. When the API can serve them, this class goes away and the
 * section keeps working unchanged.
 */
@Injectable({ providedIn: 'root' })
export class CapabilitiesDataService implements EntityCollectionDataService<Capability> {
  readonly name = `${CAPABILITY} CapabilitiesDataService`;

  getAll(): Observable<Capability[]> {
    return defer(() =>
      of(CAPABILITIES.map((capability) => ({ ...capability })))
    );
  }

  getById(): Observable<Capability> {
    return readOnly();
  }

  getWithQuery(): Observable<Capability[]> {
    return readOnly();
  }

  add(): Observable<Capability> {
    return readOnly();
  }

  delete(): Observable<number | string> {
    return readOnly();
  }

  update(): Observable<Capability> {
    return readOnly();
  }

  upsert(): Observable<Capability> {
    return readOnly();
  }
}

function readOnly(): Observable<never> {
  return throwError(() => new Error(READ_ONLY_MESSAGE));
}
