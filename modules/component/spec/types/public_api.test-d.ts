import { TemplateRef } from '@angular/core';
import { Observable } from 'rxjs';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162). How ngrxLet and ngrxPush infer values is
// covered by the ts-snippet specs next to this one.
import {
  LetDirective,
  LetViewContext,
  PushPipe,
  PushPipeResult,
  RenderScheduler,
} from '@ngrx/component';

describe('@ngrx/component public types', () => {
  it('LetViewContext holds the value under both names, the error and completion', () => {
    expectTypeOf<LetViewContext<Observable<number>>>().toEqualTypeOf<{
      $implicit: number;
      ngrxLet: number;
      error: any;
      complete: boolean;
    }>();
  });

  it('the context guard narrows the template context', () => {
    const ctx: unknown = {};
    const directive = {} as LetDirective<Observable<string>>;
    if (LetDirective.ngTemplateContextGuard(directive, ctx)) {
      expectTypeOf(ctx).toEqualTypeOf<LetViewContext<Observable<string>>>();
    }
  });

  it('LetDirective takes the value and an optional suspense template', () => {
    expectTypeOf<
      LetDirective<Observable<number>>['suspenseTemplateRef']
    >().toEqualTypeOf<TemplateRef<unknown> | undefined>();
  });

  it('PushPipeResult is undefined until the first value', () => {
    expectTypeOf<PushPipeResult<Observable<number>>>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<PushPipeResult<Promise<string>>>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<PushPipeResult<number>>().toEqualTypeOf<number>();
    expectTypeOf<PushPipe['transform']>().toEqualTypeOf<
      <PO>(potentialObservable: PO) => PushPipeResult<PO>
    >();
  });

  it('arrays are values, even of Observables: they are not combined', () => {
    expectTypeOf<PushPipeResult<Observable<number>[]>>().toEqualTypeOf<
      Observable<number>[]
    >();
    expectTypeOf<
      LetViewContext<Observable<number>[]>['$implicit']
    >().toEqualTypeOf<Observable<number>[]>();
  });

  it('RenderScheduler schedules a render', () => {
    expectTypeOf<RenderScheduler['schedule']>().toEqualTypeOf<() => void>();
  });
});
