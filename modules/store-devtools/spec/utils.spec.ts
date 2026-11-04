import {
  difference,
  liftAction,
  unliftAction,
  unliftState,
} from '../src/utils';

describe('difference', () => {
  it('returns items from the first array missing from the second', () => {
    expect(difference([1, 2, 3], [2])).toEqual([1, 3]);
  });

  it('returns all items when there is no overlap', () => {
    expect(difference(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});

describe('unliftState', () => {
  it('returns the state at the current index', () => {
    const liftedState = {
      computedStates: [{ state: { count: 1 } }, { state: { count: 2 } }],
      currentStateIndex: 1,
    } as any;

    expect(unliftState(liftedState)).toEqual({ count: 2 });
  });

  it('falls back to the last state when the index is out of bounds', () => {
    const liftedState = {
      computedStates: [{ state: { count: 1 } }, { state: { count: 2 } }],
      currentStateIndex: 5,
    } as any;

    expect(unliftState(liftedState)).toEqual({ count: 2 });
  });
});

describe('unliftAction', () => {
  it('returns the action whose id is one before nextActionId', () => {
    const liftedState = {
      actionsById: { 1: 'first', 2: 'second' },
      nextActionId: 3,
    } as any;

    expect(unliftAction(liftedState)).toBe('second');
  });
});

describe('liftAction', () => {
  it('wraps the action in a PerformAction with a timestamp', () => {
    const action = { type: 'INCREMENT' };
    const lifted = liftAction(action) as any;

    expect(lifted.action).toEqual(action);
    expect(typeof lifted.timestamp).toBe('number');
  });
});
