import { vi } from 'vitest';

import {
  DataServiceError,
  DefaultPersistenceResultHandler,
  EntityAction,
  EntityActionDataServiceError,
  EntityActionFactory,
  EntityOp,
  Logger,
} from '../../';

describe('DefaultPersistenceResultHandler', () => {
  const factory = new EntityActionFactory();
  let logger: Logger;
  let handler: DefaultPersistenceResultHandler;
  let originalAction: EntityAction;

  beforeEach(() => {
    logger = { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
    handler = new DefaultPersistenceResultHandler(logger, factory);
    originalAction = factory.create(
      'Hero',
      EntityOp.SAVE_ADD_ONE,
      { id: 1 },
      {
        correlationId: 'CRID',
        tag: 'Add',
      }
    );
  });

  it('should make the success action from the original, with the result as data', () => {
    const action = handler.handleSuccess(originalAction)({ id: 1, name: 'A' });

    expect(action).toEqual(
      factory.create(
        'Hero',
        EntityOp.SAVE_ADD_ONE_SUCCESS,
        { id: 1, name: 'A' },
        { correlationId: 'CRID', tag: 'Add' }
      )
    );
  });

  it('should pass a DataServiceError through and log it', () => {
    const error = new DataServiceError('boom', { method: 'POST', url: 'x' });
    const action = handler.handleError(originalAction)(error);

    expect(action.payload.entityOp).toBe(EntityOp.SAVE_ADD_ONE_ERROR);
    expect(action.payload.correlationId).toBe('CRID');
    expect(action.payload.data).toEqual({ error, originalAction });
    expect(logger.error).toHaveBeenCalledWith({ error, originalAction });
  });

  it('should wrap any other error in a DataServiceError without request data', () => {
    const cause = new Error('network down');
    const action = handler.handleError(originalAction)(cause);
    const data = action.payload.data as EntityActionDataServiceError;

    expect(data.error).toBeInstanceOf(DataServiceError);
    expect(data.error.error).toBe(cause);
    expect(data.error.message).toBe('network down');
    expect(data.error.requestData).toBeNull();
    expect(data.originalAction).toBe(originalAction);
  });
});
