import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EntityDataService, provideEntityData, withEffects } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { CapabilitiesDataService } from './capabilities.data-service';
import { CapabilitiesService } from './capabilities.service';
import { CAPABILITIES, CAPABILITY } from './capability';

describe('CapabilitiesService', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(),
        provideEffects(),
        provideEntityData(
          { entityMetadata: { [CAPABILITY]: {} } },
          withEffects()
        ),
      ],
    });
    TestBed.inject(EntityDataService).registerService(
      CAPABILITY,
      TestBed.inject(CapabilitiesDataService)
    );
    return {
      service: TestBed.inject(CapabilitiesService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('starts with no capabilities, not loading', async () => {
    const { service } = setUp();

    expect(await firstValueFrom(service.entities$)).toEqual([]);
    expect(await firstValueFrom(service.loading$)).toBe(false);
  });

  it('loads every capability, in order, through the local data service', async () => {
    const { service, http } = setUp();

    expect(await firstValueFrom(service.load())).toEqual(CAPABILITIES);
    expect(await firstValueFrom(service.entities$)).toEqual(CAPABILITIES);
    expect(await firstValueFrom(service.loaded$)).toBe(true);
    http.verify();
  });

  it('is loading only while the capabilities are on their way', async () => {
    const { service } = setUp();
    const loading: boolean[] = [];
    service.loading$.subscribe((value) => loading.push(value));

    await firstValueFrom(service.load());

    expect(loading).toEqual([false, true, false]);
  });
});
