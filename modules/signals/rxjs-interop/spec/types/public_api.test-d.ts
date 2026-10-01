import { Injector, Signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162).
import { rxMethod, RxMethod } from '@ngrx/signals/rxjs-interop';

describe('@ngrx/signals/rxjs-interop public types', () => {
  it('rxMethod takes a value, a signal or an Observable of its input', () => {
    const log = rxMethod<number>(tap(() => undefined));
    expectTypeOf(log).toEqualTypeOf<RxMethod<number>>();
    expectTypeOf(log)
      .parameter(0)
      .toEqualTypeOf<number | (() => number) | Observable<number>>();
    expectTypeOf(log)
      .parameter(1)
      .toEqualTypeOf<{ injector?: Injector } | undefined>();
    expectTypeOf(log).toBeCallableWith({} as Signal<number>);
    // @ts-expect-error not an input of the method
    log('one');
  });

  it('rxMethod and the reference it returns can be destroyed', () => {
    const log = rxMethod<void>(tap(() => undefined));
    expectTypeOf(log.destroy).toEqualTypeOf<() => void>();
    expectTypeOf(log()).toHaveProperty('destroy');
  });
});
