import { routerReducer } from '../src/reducer';
import { ROUTER_CANCEL, ROUTER_ERROR, ROUTER_NAVIGATION } from '../src/actions';

describe('routerReducer', () => {
  it('returns router state from a navigation action', () => {
    const state = routerReducer(undefined, {
      type: ROUTER_NAVIGATION,
      payload: {
        routerState: { url: '/new' },
        event: { id: 3 },
      },
    } as any);

    expect(state).toEqual({ state: { url: '/new' }, navigationId: 3 });
  });

  it('updates state from error and cancel actions', () => {
    expect(
      routerReducer(undefined, {
        type: ROUTER_ERROR,
        payload: {
          routerState: { url: '/error' },
          event: { id: 4 },
        },
      } as any)
    ).toEqual({ state: { url: '/error' }, navigationId: 4 });

    expect(
      routerReducer(undefined, {
        type: ROUTER_CANCEL,
        payload: {
          routerState: { url: '/cancel' },
          event: { id: 5 },
        },
      } as any)
    ).toEqual({ state: { url: '/cancel' }, navigationId: 5 });
  });

  it('leaves state unchanged for other actions', () => {
    const previous = { state: { url: '/old' }, navigationId: 1 };

    expect(
      routerReducer(previous as any, { type: '@ngrx/store/init' } as any)
    ).toBe(previous);
  });

  it('returns undefined when there is no previous state and no router action', () => {
    expect(
      routerReducer(undefined, { type: '@ngrx/store/init' } as any)
    ).toBeUndefined();
  });
});
