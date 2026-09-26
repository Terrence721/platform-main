import { expectTypeOf } from 'vitest';
import {
  InnerSignalStore,
  MethodsDictionary,
  SignalStoreFeature,
  SignalStoreFeatureResult,
  SignalStoreHooks,
  withMethods,
} from '../../src';

// A library author has to be able to name the types that a SignalStoreFeature,
// SignalStoreFeatureResult and withMethods are made of. A name that the barrel
// does not export resolves to `any` in this file, so each test first checks
// that it does not.
describe('public API types', () => {
  it('names the store that a feature receives and returns', () => {
    expectTypeOf<InnerSignalStore>().not.toBeAny();

    const passThrough: SignalStoreFeature = (store: InnerSignalStore) => store;

    expectTypeOf(passThrough).parameter(0).toEqualTypeOf<InnerSignalStore>();
    expectTypeOf(passThrough).returns.toEqualTypeOf<InnerSignalStore>();
  });

  it('names the hooks of a store', () => {
    expectTypeOf<SignalStoreHooks>().not.toBeAny();
    expectTypeOf<InnerSignalStore['hooks']>().toEqualTypeOf<SignalStoreHooks>();
    expectTypeOf<SignalStoreHooks>().toEqualTypeOf<{
      onInit?: () => void;
      onDestroy?: () => void;
    }>();
  });

  it('names the methods of a feature result and constrains a wrapper of withMethods', () => {
    expectTypeOf<MethodsDictionary>().not.toBeAny();

    function withMethodsOf<Methods extends MethodsDictionary>(
      methods: Methods
    ) {
      return withMethods(() => methods);
    }

    expectTypeOf<
      SignalStoreFeatureResult['methods']
    >().toEqualTypeOf<MethodsDictionary>();
    withMethodsOf({ ping: () => 'pong' });
    // @ts-expect-error a member that is not a function is not a method
    withMethodsOf({ ping: 1 });
  });
});
