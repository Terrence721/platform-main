import { Action, ScannedActionsSubject, Store } from '@ngrx/store';
import { vi } from 'vitest';

import {
  ChangeSet,
  ChangeSetItem,
  ChangeSetOperation,
  CorrelationIdGenerator,
  DataServiceError,
  EntityCache,
  EntityCacheDispatcher,
  EntityDispatcherDefaultOptions,
  PersistenceCanceled,
  SaveEntities,
  SaveEntitiesCancel,
  SaveEntitiesError,
  SaveEntitiesSuccess,
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
    } as unknown as Store<EntityCache>;
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
});
