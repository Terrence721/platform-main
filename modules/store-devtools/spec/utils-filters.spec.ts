import {
  filterLiftedState,
  isActionFiltered,
  sanitizeAction,
  sanitizeActions,
  sanitizeState,
  sanitizeStates,
  shouldFilterActions,
} from '../src/utils';

describe('sanitize helpers', () => {
  it('sanitizes an action with the provided sanitizer', () => {
    const action = {
      action: { type: 'INCREMENT' },
      timestamp: 1,
    } as any;

    expect(sanitizeAction((a, idx) => ({ ...a, idx }), action, 3)).toEqual({
      action: { type: 'INCREMENT', idx: 3 },
      timestamp: 1,
    });
  });

  it('sanitizes every action in a collection', () => {
    const actions = {
      0: { action: { type: 'A' }, timestamp: 1 },
      1: { action: { type: 'B' }, timestamp: 2 },
    } as any;

    const sanitized = sanitizeActions(
      (action, idx) => ({ ...action, idx }),
      actions
    ) as any;

    expect(sanitized[0].action).toEqual({ type: 'A', idx: 0 });
    expect(sanitized[1].action).toEqual({ type: 'B', idx: 1 });
  });

  it('sanitizes individual states', () => {
    const states = [{ state: { count: 1 }, error: null }] as any;

    expect(
      sanitizeStates((state) => ({ ...state, count: state.count + 1 }), states)
    ).toEqual([{ state: { count: 2 }, error: null }]);
    expect(
      sanitizeState((state) => ({ ...state, count: 5 }), { count: 1 }, 0)
    ).toEqual({
      count: 5,
    });
  });
});

describe('shouldFilterActions', () => {
  it('is true only when a predicate or list is configured', () => {
    expect(shouldFilterActions({} as any)).toBeFalsy();
    expect(shouldFilterActions({ predicate: () => true } as any)).toBeTruthy();
    expect(shouldFilterActions({ actionsSafelist: ['A'] } as any)).toBeTruthy();
    expect(
      shouldFilterActions({ actionsBlocklist: ['A'] } as any)
    ).toBeTruthy();
  });
});

describe('isActionFiltered', () => {
  it('matches a blocklist and not an allowlist', () => {
    const action = { action: { type: 'BLOCKED' } } as any;

    expect(
      isActionFiltered(
        { count: 1 },
        action,
        undefined,
        ['ALLOWED'],
        ['BLOCKED']
      )
    ).toBeTruthy();
    expect(
      isActionFiltered({ count: 1 }, action, undefined, ['BLOCKED'], undefined)
    ).toBeFalsy();
  });

  it('uses predicate results when provided', () => {
    const action = { action: { type: 'A' } } as any;

    expect(isActionFiltered({ count: 1 }, action, () => false)).toBeTruthy();
    expect(isActionFiltered({ count: 1 }, action, () => true)).toBeFalsy();
  });
});

describe('filterLiftedState', () => {
  it('removes filtered actions and recomputes state collections', () => {
    const liftedState = {
      stagedActionIds: [0, 1, 2],
      actionsById: {
        0: { action: { type: 'KEEP' } },
        1: { action: { type: 'DROP' } },
        2: { action: { type: 'KEEP' } },
      },
      computedStates: [
        { state: { count: 0 } },
        { state: { count: 1 } },
        { state: { count: 2 } },
      ],
      currentStateIndex: 2,
      nextActionId: 3,
    } as any;

    const filtered = filterLiftedState(liftedState, undefined, undefined, [
      'DROP',
    ]) as any;

    expect(filtered.stagedActionIds).toEqual([0, 2]);
    expect(Object.keys(filtered.actionsById)).toEqual(['0', '2']);
    expect(filtered.computedStates).toHaveLength(2);
  });
});
