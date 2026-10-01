import { Observable, of, OperatorFunction } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162). tapResponse has its own spec next to this.
import {
  concatLatestFrom,
  mapResponse,
  MapResponseObserver,
  tapResponse,
  TapResponseObserver,
} from '@ngrx/operators';

describe('@ngrx/operators public types', () => {
  it('the observers take a value and an error handler', () => {
    expectTypeOf<TapResponseObserver<number, Error>>().toEqualTypeOf<{
      next: (value: number) => void;
      error: (error: Error) => void;
      complete?: () => void;
      finalize?: () => void;
    }>();
    expectTypeOf<
      MapResponseObserver<number, Error, string, null>
    >().toEqualTypeOf<{
      next: (value: number) => string;
      error: (error: Error) => null;
    }>();
  });

  it('tapResponse keeps the values, with an unknown error by default', () => {
    const operator = tapResponse<number>({
      next: () => undefined,
      error: (error) => expectTypeOf(error).toBeUnknown(),
    });
    expectTypeOf(of(1).pipe(operator)).toEqualTypeOf<Observable<number>>();
  });

  it('mapResponse emits what either handler returns', () => {
    expectTypeOf(
      of(1).pipe(
        mapResponse({
          next: (value) => `${value}`,
          error: (error: Error) => error.message.length,
        })
      )
    ).toEqualTypeOf<Observable<string | number>>();
  });

  it('concatLatestFrom pairs each value with the latest of one or more Observables', () => {
    expectTypeOf(
      concatLatestFrom((value: number) => of(`${value}`))
    ).toEqualTypeOf<OperatorFunction<number, [number, string]>>();
    expectTypeOf(concatLatestFrom(() => [of('a'), of(true)])).toEqualTypeOf<
      OperatorFunction<unknown, [unknown, string, boolean]>
    >();
    expectTypeOf(
      of(1).pipe(concatLatestFrom(() => [of('a'), of(true)]))
    ).toEqualTypeOf<Observable<[number, string, boolean]>>();
  });
});
