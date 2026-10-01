import { TestBed } from '@angular/core/testing';
import {
  Action,
  provideStore,
  ScannedActionsSubject,
  Store,
} from '@ngrx/store';
import { vi } from 'vitest';

import {
  ChangeSet,
  ChangeSetItem,
  ChangeSetOperation,
  ClearCollections,
  CorrelationIdGenerator,
  DataServiceError,
  EntityCache,
  EntityCacheDispatcher,
  EntityDispatcherDefaultOptions,
  LoadCollections,
  MergeQuerySet,
  MergeStrategy,
  PersistenceCanceled,
  provideEntityData,
  SaveEntities,
  SaveEntitiesCancel,
  SaveEntitiesError,
  SaveEntitiesSuccess,
  SetEntityCache,
} from '../../';

describe('EntityCacheDispatcher', () => {
  const url = 'api/save';
  let scannedActions$: ScannedActionsSubject;
  let dispatched: Action[];
  let dispatcher: EntityCacheDispatcher;

  beforeEach(() => {
    scannedActions$ = new ScannedActionsSubject();
    dispatched = [];
    const store = {
      dispatch: vi.fn((action: Action) => dispatched.push(action)),
    } as unknown as Store<object>;
    dispatcher = new EntityCacheDispatcher(
      new CorrelationIdGenerator(),
      new EntityDispatcherDefaultOptions(),
      scannedActions$,
      store
    );
  });

  const changes: ChangeSetItem[] = [
    { op: ChangeSetOperation.Add, entityName: 'Hero', entities: [{ id: 1 }] },
  ];

  describe('#saveEntities', () => {
    it('should dispatch SaveEntities with the defaulted options', () => {
      dispatcher.saveEntities(changes, url);

      const action = dispatched[0] as SaveEntities;
      expect(action).toBeInstanceOf(SaveEntities);
      expect(action.payload.changeSet.changes).toEqual(changes);
      expect(action.payload).toMatchObject({
        url,
        correlationId: 'CRID1',
        isOptimistic: false,
        tag: 'Save Entities',
      });
    });

    it('should emit the change set of the matching success action', () => {
      const saved: ChangeSet = { changes };
      let result: ChangeSet | undefined;
      dispatcher
        .saveEntities(changes, url, { correlationId: 'A' })
        .subscribe((r) => (result = r));

      scannedActions$.next(
        new SaveEntitiesSuccess({ changes: [] }, url, { correlationId: 'B' })
      );
      expect(result).toBeUndefined();

      scannedActions$.next(
        new SaveEntitiesSuccess(saved, url, { correlationId: 'A' })
      );
      expect(result).toBe(saved);
    });

    it('should error with the payload of the matching error action', () => {
      let error: unknown;
      const save = dispatcher.saveEntities(changes, url, {
        correlationId: 'A',
      });
      save.subscribe({ error: (e) => (error = e) });

      const saveAction = dispatched[0] as SaveEntities;
      const errorAction = new SaveEntitiesError(
        new DataServiceError('boom', null),
        saveAction
      );
      scannedActions$.next(errorAction);
      expect(error).toBe(errorAction.payload);
    });

    it('should error with PersistenceCanceled when the save is canceled', () => {
      let error: unknown;
      dispatcher
        .saveEntities(changes, url, { correlationId: 'A' })
        .subscribe({ error: (e) => (error = e) });

      scannedActions$.next(new SaveEntitiesCancel('A', 'user quit'));
      expect(error).toBeInstanceOf(PersistenceCanceled);
      expect((error as PersistenceCanceled).message).toBe('user quit');
    });
  });

  describe('#cancelSaveEntities', () => {
    it('should dispatch a cancel for any correlation id, including 0', () => {
      dispatcher.cancelSaveEntities(0, 'why');
      expect(dispatched[0]).toEqual(new SaveEntitiesCancel(0, 'why'));
    });

    it('should throw without a correlation id', () => {
      expect(() => dispatcher.cancelSaveEntities(undefined)).toThrow(
        'Missing correlationId'
      );
    });
  });

  describe('#reducedActions$', () => {
    it('should replay the latest reduced action to a late subscriber, until destroyed', () => {
      const action = { type: 'latest' };
      scannedActions$.next(action);

      let seen: Action | undefined;
      dispatcher.reducedActions$.subscribe((a) => (seen = a)).unsubscribe();
      expect(seen).toBe(action);

      dispatcher.ngOnDestroy();
      scannedActions$.next({ type: 'after destroy' });
      seen = undefined;
      dispatcher.reducedActions$.subscribe((a) => (seen = a)).unsubscribe();
      // no longer listening: nothing was replayed from after the destroy
      expect(seen).toBeUndefined();
    });
  });

  describe('cache-wide actions', () => {
    it('#clearCollections dispatches ClearCollections', () => {
      dispatcher.clearCollections(['Hero'], 'tag');
      expect(dispatched[0]).toEqual(new ClearCollections(['Hero'], 'tag'));
    });

    it('#loadCollections dispatches LoadCollections', () => {
      const collections = { Hero: [{ id: 1 }] };
      dispatcher.loadCollections(collections, 'tag');
      expect(dispatched[0]).toEqual(new LoadCollections(collections, 'tag'));
    });

    it('#mergeQuerySet dispatches MergeQuerySet', () => {
      const querySet = { Hero: [{ id: 1 }] };
      dispatcher.mergeQuerySet(querySet, MergeStrategy.IgnoreChanges, 'tag');
      expect(dispatched[0]).toEqual(
        new MergeQuerySet(querySet, MergeStrategy.IgnoreChanges, 'tag')
      );
    });

    it('#setEntityCache dispatches SetEntityCache', () => {
      const cache: EntityCache = {};
      dispatcher.setEntityCache(cache, 'tag');
      expect(dispatched[0]).toEqual(new SetEntityCache(cache, 'tag'));
    });
  });
});

describe('EntityCacheDispatcher (provided by provideEntityData)', () => {
  it('should be injectable and dispatch to the real store', () => {
    TestBed.configureTestingModule({
      providers: [provideStore(), provideEntityData({})],
    });
    const dispatcher = TestBed.inject(EntityCacheDispatcher);
    const store = TestBed.inject(Store);
    const dispatch = vi.spyOn(store, 'dispatch');

    dispatcher.clearCollections();

    expect(dispatch).toHaveBeenCalledWith(new ClearCollections(undefined));
  });
});
