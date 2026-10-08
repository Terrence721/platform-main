import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { EntityCollectionDataService } from '@ngrx/data';
import { firstValueFrom, type Observable } from 'rxjs';
import { CapabilitiesDataService } from './capabilities.data-service';
import { CAPABILITIES, type Capability } from './capability';

/** A call @ngrx/data could make on the service, as it would make it. */
type Call = (
  service: EntityCollectionDataService<Capability>
) => Observable<unknown>;

describe('CapabilitiesDataService', () => {
  function setUp() {
    // HttpClient under test, only to prove nothing is ever requested.
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      service: TestBed.inject(CapabilitiesDataService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('serves every capability without a request to the server', async () => {
    const { service, http } = setUp();

    expect(await firstValueFrom(service.getAll())).toEqual(CAPABILITIES);
    http.verify();
  });

  it('serves copies, so the store never holds the constant itself', async () => {
    const { service } = setUp();

    const served = await firstValueFrom(service.getAll());

    served.forEach((capability, index) =>
      expect(capability).not.toBe(CAPABILITIES[index])
    );
  });

  it('is named after the Capability entity', () => {
    expect(setUp().service.name).toBe('Capability CapabilitiesDataService');
  });

  // Anything but getAll would otherwise ask the API for capabilities it
  // doesn't have; it says so instead, with no request.
  it.each<[string, Call]>([
    ['getById', (service) => service.getById('admin')],
    ['getWithQuery', (service) => service.getWithQuery({ title: 'Live' })],
    ['add', (service) => service.add(CAPABILITIES[0])],
    ['delete', (service) => service.delete('admin')],
    [
      'update',
      (service) => service.update({ id: 'admin', changes: { title: 'Admin' } }),
    ],
    ['upsert', (service) => service.upsert(CAPABILITIES[0])],
  ])('refuses %s, with no request to the server', async (_, call) => {
    const { service, http } = setUp();

    await expect(firstValueFrom(call(service))).rejects.toThrow(
      'Capabilities are read-only and served by the app: only getAll is supported.'
    );
    http.verify();
  });
});
