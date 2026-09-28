import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { vi } from 'vitest';

import {
  ChangeSet,
  ChangeSetOperation,
  DataServiceError,
  DefaultDataServiceConfig,
  EntityCacheDataService,
  EntityDefinitionService,
} from '../../';

interface Hero {
  heroId: number;
  name: string;
}

describe('EntityCacheDataService', () => {
  const url = 'api/save-entities';
  let http: HttpClient;
  let httpTestingController: HttpTestingController;
  let definitionService: EntityDefinitionService;

  function createService(config?: DefaultDataServiceConfig) {
    return new EntityCacheDataService(definitionService, http, config);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    definitionService = {
      getDefinition: () => ({ selectId: (hero: Hero) => hero.heroId }),
    } as unknown as EntityDefinitionService;
  });

  afterEach(() => {
    vi.useRealTimers();
    httpTestingController.verify();
  });

  it('should send updates as entities and restore them as updates', () => {
    const changeSet: ChangeSet = {
      changes: [
        {
          op: ChangeSetOperation.Update,
          entityName: 'Hero',
          entities: [{ id: 1, changes: { heroId: 1, name: 'A' } }],
        },
        { op: ChangeSetOperation.Delete, entityName: 'Hero', entities: [] },
      ],
    };
    let result: ChangeSet | undefined;

    createService()
      .saveEntities(changeSet, url)
      .subscribe((r) => (result = r));
    const req = httpTestingController.expectOne(url);

    // the empty item is dropped, the update is sent as its changes
    expect(req.request.method).toBe('POST');
    expect(req.request.body.changes).toEqual([
      {
        op: ChangeSetOperation.Update,
        entityName: 'Hero',
        entities: [{ heroId: 1, name: 'A' }],
      },
    ]);

    req.flush({
      changes: [
        {
          op: ChangeSetOperation.Update,
          entityName: 'Hero',
          entities: [{ heroId: 1, name: 'A2' }],
        },
      ],
    });
    // restored with the entity type's own id selector
    expect(result?.changes[0].entities).toEqual([
      { id: 1, changes: { heroId: 1, name: 'A2' } },
    ]);
  });

  it('should pass on an empty (204) response', () => {
    let result: ChangeSet | null | undefined;
    createService()
      .saveEntities({ changes: [] }, url)
      .subscribe((r) => (result = r));

    httpTestingController.expectOne(url).flush(null);
    expect(result).toBeNull();
  });

  it('should report an HTTP failure as a DataServiceError with the request data', () => {
    let error: DataServiceError | undefined;
    createService()
      .saveEntities({ changes: [] }, url)
      .subscribe({ error: (e) => (error = e) });

    httpTestingController
      .expectOne(url)
      .flush('db down', { status: 500, statusText: 'Server Error' });
    expect(error).toBeInstanceOf(DataServiceError);
    expect(error?.requestData).toMatchObject({ method: 'POST', url });
  });

  it('should report a timeout as a DataServiceError with the request data', () => {
    vi.useFakeTimers();
    let error: DataServiceError | undefined;
    createService({ timeout: 30 })
      .saveEntities({ changes: [] }, url)
      .subscribe({ error: (e) => (error = e) });
    const req = httpTestingController.expectOne(url);

    vi.advanceTimersByTime(31);
    expect(error).toBeInstanceOf(DataServiceError);
    expect(error?.requestData).toMatchObject({ method: 'POST', url });
    expect(req.cancelled).toBe(true);
  });
});
