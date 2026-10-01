import { InjectionToken, Provider, Resource } from '@angular/core';
import { describe, expectTypeOf, it } from 'vitest';
// Through the package name, as an app imports it, so a missing or mistyped
// public export fails here (#162).
import {
  ERROR_EXTENSION_TYPE,
  extendResource,
  LOADING_EXTENSION_TYPE,
  provideResourceExtensions,
  RESOURCE_EXTENSIONS,
  ResourceExtension,
  withPreviousValueOnError,
  withPreviousValueOnLoading,
  withValueOnError,
  withValueOnLoading,
} from '@ngrx/signals/resource';

declare const books: Resource<string[]>;

describe('@ngrx/signals/resource public types', () => {
  it('an extension applies to a resource and has a type', () => {
    expectTypeOf<ResourceExtension<Resource<string[]>>>().toEqualTypeOf<{
      type: symbol;
      apply: (resource: Resource<string[]>) => void;
    }>();
    expectTypeOf(ERROR_EXTENSION_TYPE).toExtend<symbol>();
    expectTypeOf(LOADING_EXTENSION_TYPE).toExtend<symbol>();
  });

  it('extendResource returns the same resource type', () => {
    expectTypeOf(
      extendResource(books, withPreviousValueOnLoading(), withValueOnError([]))
    ).toEqualTypeOf<Resource<string[]>>();
  });

  it('the value extensions take a value of the resource type', () => {
    expectTypeOf(withValueOnLoading<Resource<string[]>>)
      .parameter(0)
      .toEqualTypeOf<string[]>();
    expectTypeOf(withValueOnError<Resource<number>>)
      .parameter(0)
      .toEqualTypeOf<number>();
    // @ts-expect-error not a value of the resource type
    extendResource(books, withValueOnError(42));
    expectTypeOf(withPreviousValueOnError<Resource<number>>()).toEqualTypeOf<
      ResourceExtension<Resource<number>>
    >();
  });

  it('extensions can be provided for every resource', () => {
    expectTypeOf(
      provideResourceExtensions(withPreviousValueOnLoading())
    ).toEqualTypeOf<Provider>();
    expectTypeOf(RESOURCE_EXTENSIONS).toEqualTypeOf<
      InjectionToken<ResourceExtension<Resource<unknown>>[]>
    >();
  });
});
