import { MinimalRouterStateSerializer, RouterState } from '../src';
import {
  _createRouterConfig,
  DEFAULT_ROUTER_FEATURENAME,
  NavigationActionTiming,
} from '../src/router_store_config';

describe('_createRouterConfig', () => {
  it('applies the minimal serializer defaults', () => {
    expect(_createRouterConfig({})).toEqual({
      stateKey: DEFAULT_ROUTER_FEATURENAME,
      serializer: MinimalRouterStateSerializer,
      navigationActionTiming: NavigationActionTiming.PreActivation,
    });
  });

  it('keeps user overrides, including the full serializer choice', () => {
    const config = _createRouterConfig({
      stateKey: 'customRouter',
      serializer: MinimalRouterStateSerializer,
      navigationActionTiming: NavigationActionTiming.PostActivation,
      routerState: RouterState.Full,
    });

    expect(config.stateKey).toBe('customRouter');
    expect(config.navigationActionTiming).toBe(
      NavigationActionTiming.PostActivation
    );
    expect(config.routerState).toBe(RouterState.Full);
  });

  it('reports the expected enum values', () => {
    expect(NavigationActionTiming.PreActivation).toBe(1);
    expect(NavigationActionTiming.PostActivation).toBe(2);
    expect(RouterState.Full).toBe(0);
    expect(RouterState.Minimal).toBe(1);
  });
});
