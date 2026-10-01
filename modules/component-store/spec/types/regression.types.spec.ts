// Through the package name, so a missing public export fails here (#162).
import { ComponentStore } from '@ngrx/component-store';
import { Observable } from 'rxjs';
import { describe, it } from 'vitest';

describe('regression component-store', () => {
  it('https://github.com/ngrx/platform/issues/3482', () => {
    interface SomeType {
      name: string;
      prop: string;
    }

    // Never used: the test is that this class compiles.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    abstract class MyStore<
      QueryVariables extends SomeType,
    > extends ComponentStore<any> {
      protected abstract readonly query$: Observable<
        Omit<QueryVariables, 'name'>
      >;

      readonly load = this.effect(
        (origin$: Observable<Omit<QueryVariables, 'name'> | null>) => origin$
      );

      protected constructor() {
        super();
      }

      protected initializeLoad() {
        // 👇 this should work
        this.load(this.query$);
      }
    }
  });
});
