import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  DefaultHttpUrlGenerator,
  DefaultPluralizer,
  HttpUrlGenerator,
  Pluralizer,
} from '@ngrx/data';
import { firstValueFrom } from 'rxjs';
import { CapabilitiesDataService } from './capabilities.data-service';
import { CAPABILITIES } from './capability';

describe('CapabilitiesDataService', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: HttpUrlGenerator, useClass: DefaultHttpUrlGenerator },
        { provide: Pluralizer, useClass: DefaultPluralizer },
      ],
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
    expect(setUp().service.name).toBe('Capability DefaultDataService');
  });
});
