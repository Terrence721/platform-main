import { expectTypeOf } from 'vitest';
import { signalStore, withMethods } from '../../src';

describe('withMethods types', () => {
  const SECRET = Symbol('secret');

  it('accepts symbol-keyed methods and passes them on to later features', () => {
    signalStore(
      withMethods(() => ({ [SECRET]: (): string => 'secret' })),
      withMethods((store) => {
        expectTypeOf(store[SECRET]).toEqualTypeOf<() => string>();

        return {};
      })
    );
  });

  it('rejects a symbol-keyed member that is not a function', () => {
    // @ts-expect-error a symbol-keyed non-function is not a method
    withMethods(() => ({ [SECRET]: 42 }));
  });

  it('rejects a string-keyed member that is not a function', () => {
    // @ts-expect-error a string-keyed non-function is not a method
    withMethods(() => ({ notAMethod: 42 }));
  });
});
