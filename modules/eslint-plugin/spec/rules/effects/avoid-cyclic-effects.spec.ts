import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, {
  messageId,
} from '../../../src/rules/effects/avoid-cyclic-effects';
import { ruleTester, fromFixture } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const setup = `
import type { OnRunEffects } from '@ngrx/effects'
import { EffectConfig } from '@ngrx/effects'
import { Actions, createEffect, ofType } from '@ngrx/effects'
import { createAction } from '@ngrx/store'
import { map, tap, timer, takeUntil, merge,  } from 'rxjs'
import { inject } from '@angular/core';

const foo = createAction('FOO')
const bar = createAction('BAR')

const fromFoo = {
  foo,
  bar
}
const subject = 'SUBJECT'
const genericFoo = createAction(\`$\{subject} FOO\`)
const genericBar = createAction(\`$\{subject} BAR\`)
`;

const validConstructor: () => (string | ValidTestCase<Options>)[] = () => [
  `
${setup}
class Effect {
  foo$ = createEffect(() =>
    this.actions$.pipe(
      ofType(foo),
      map(() => bar()),
    ),
  )

  constructor(
    private actions$: Actions,
  ) {}
}`,
  `
${setup}
class Effect {
  foo$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(foo),
      map(() => bar()),
    )
  })

  constructor(
    private actions$: Actions,
  ) {}
}`,
  `
${setup}
class Effect {
  foo$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(fromFoo.foo),
      map(() => fromFoo.bar()),
    )
  })

  constructor(
    private actions$: Actions,
  ) {}
}`,
  `
${setup}
class Effect {
  foo$ = createEffect(() => {
    return this.actions.pipe(
      ofType(foo),
      mapTo(bar()),
    )
  })

  constructor(
    private actions: Actions,
  ) {}
}`,
  `
${setup}
class Effect {
  foo$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(foo),
      tap(() => alert('hi'))
    )
    }, { dispatch: false }
  )

  constructor(
    private actions$: Actions,
  ) {}
}`,
  `
${setup}
class Effect {
  foo$: CreateEffectMetadata

  constructor(
    private actions$: Actions,
  ) {
    this.foo$ = createEffect(() =>
      this.actions$.pipe(
        ofType(genericFoo),
        map(() => genericBar()),
      ),
    )
  }
}`,
  // https://github.com/timdeschryver/eslint-plugin-ngrx/issues/223
  `
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

enum OrderEntityActionTypes {
  postPortInData = '[Order Entity] Post PortIn Data',
  postPortInDataSuccess = '[Order Entity] Post PortIn Data Success',
}

class PostPortInData implements Action {
  readonly type = OrderEntityActionTypes.postPortInData
}

class PostPortInDataSuccess implements Action {
  readonly type = OrderEntityActionTypes.postPortInDataSuccess
}

@Injectable()
class Effect {
  readonly postPortInData$ = createEffect(() =>
    this.actions$.pipe(
      ofType<PostPortInData>(OrderEntityActionTypes.postPortInData),
      switchMap(() => of(new PostPortInDataSuccess())),
    ),
  )

  constructor(private readonly actions$: Actions) {}
}`,
];

const validInject: () => (string | ValidTestCase<Options>)[] = () => [
  `
  ${setup}
  class Effect {
    private actions$ = inject(Actions);
    foo$ = createEffect(() =>
      this.actions$.pipe(
        ofType(foo),
        map(() => bar()),
      ),
    )
  }`,
  `
  ${setup}
  class Effect {
    private actions$ = inject(Actions);
    foo$ = createEffect(() => {
      return this.actions$.pipe(
        ofType(foo),
        map(() => bar()),
      )
    })
  }`,
  `
  ${setup}
  class Effect {
    private actions$ = inject(Actions);
    foo$ = createEffect(() => {
      return this.actions$.pipe(
        ofType(fromFoo.foo),
        map(() => fromFoo.bar()),
      )
    })
  }`,
  `
  ${setup}
  class Effect {
    private actions = inject(Actions);
    foo$ = createEffect(() => {
      return this.actions.pipe(
        ofType(foo),
        mapTo(bar()),
      )
    })
  }`,
  `
  ${setup}
  class Effect {
    private actions$ = inject(Actions);
    foo$ = createEffect(() => {
      return this.actions$.pipe(
        ofType(foo),
        tap(() => alert('hi'))
      )
      }, { dispatch: false }
    )
  }`,
  `
  ${setup}
  class Effect {
    foo$: CreateEffectMetadata
    private actions$ = inject(Actions);

    constructor() {
      this.foo$ = createEffect(() =>
        this.actions$.pipe(
          ofType(genericFoo),
          map(() => genericBar()),
        ),
      )
    }
  }`,
  `
  ${setup}
  class Effect {
    private actions$ = otherInject(Actions);
    foo$ = createEffect(() => {
      return this.actions$.pipe(
        ofType(foo),
        tap(() => alert('hi'))
      )
      }, { dispatch: false }
    )
  }`,
  `
  ${setup}
  class Effect {
    private actions$ = inject(OtherActions);
    foo$ = createEffect(() => {
      return this.actions$.pipe(
        ofType(foo),
        tap(() => alert('hi'))
      )
      }, { dispatch: false }
    )
  }`,
  // https://github.com/ngrx/platform/issues/4168
  `
${setup}
class Effect {
  actions$: Actions = inject(Actions);
  foo$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(foo),
      switchMap(() => {
        return timer(500).pipe(
          map(() => {
            return bar();
          }),
          takeUntil(merge(timer(1000), this.actions$.pipe(ofType(foo))))
        );
      })
    );
  });
}`,
];

const invalidConstructor: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(`
${setup}
class Effect {
  foo$ = createEffect(() =>
    this.actions$.pipe(
    ~~~~~~~~~~~~~~~~~~ [${messageId}]
      ofType(foo),
      tap(() => alert('hi'))
    ),
  )

  constructor(
    private actions$: Actions,
  ) {}
}`),
  fromFixture(`
${setup}
class Effect {
  foo$ = createEffect(() => {
    return this.actions$.pipe(
           ~~~~~~~~~~~~~~~~~~ [${messageId}]
      ofType(foo),
      tap(() => alert('hi'))
    )
  })

  constructor(
    private actions$: Actions,
  ) {}
}`),
  fromFixture(`
${setup}
class Effect {
  foo$ = createEffect(() => {
    return this.actions$.pipe(
           ~~~~~~~~~~~~~~~~~~ [${messageId}]
      ofType(foo),
      tap(() => alert('hi'))
    )
  }, { dispatch: true })

  constructor(
    private actions$: Actions,
  ) {}
}`),
  fromFixture(`
${setup}
class Effect {
  foo$ = createEffect(
    () =>
      ({ debounce = 100 } = {}) =>
        debounce
          ? this.actions$.pipe(
            ~~~~~~~~~~~~~~~~~~ [${messageId}]
              ofType(fromFoo.foo),
              tap(() => alert('hi')),
            )
          : this.actions$.pipe(),
  )

  constructor(private actions$: Actions) {}
}`),
  fromFixture(`
${setup}
class Effect {
  foo$: CreateEffectMetadata

  constructor(
    private actions$: Actions,
  ) {
    this.foo$ = createEffect(() =>
      this.actions$.pipe(
      ~~~~~~~~~~~~~~~~~~ [${messageId}]
        ofType(genericFoo),
      ),
    )
  }
}`),
  // https://github.com/timdeschryver/eslint-plugin-ngrx/issues/223
  fromFixture(`
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Action } from '@ngrx/store';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

enum OrderEntityActionTypes {
  postPortInData = '[Order Entity] Post PortIn Data',
  postPortInDataSuccess = '[Order Entity] Post PortIn Data Success',
}

class PostPortInData implements Action {
  readonly type = OrderEntityActionTypes.postPortInData
}

class PostPortInDataSuccess implements Action {
  readonly type = OrderEntityActionTypes.postPortInDataSuccess
}

@Injectable()
class Effect {
  readonly postPortInData$ = createEffect(() =>
    this.actions$.pipe(
    ~~~~~~~~~~~~~~~~~~ [${messageId}]
      ofType<PostPortInData>(OrderEntityActionTypes.postPortInData),
      switchMap(() => of(new PostPortInData())),
    ),
  )

  constructor(private readonly actions$: Actions) {}
}`),
];

const invalidInject: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(`
${setup}
class Effect {
  private actions$ = inject(Actions);
  foo$ = createEffect(() =>
    this.actions$.pipe(
    ~~~~~~~~~~~~~~~~~~ [${messageId}]
      ofType(foo),
      tap(() => alert('hi'))
    ),
  )
}`),
  fromFixture(`
${setup}
class Effect {
  private actions$ = inject(Actions);
  foo$ = createEffect(() => {
    return this.actions$.pipe(
           ~~~~~~~~~~~~~~~~~~ [${messageId}]
      ofType(foo),
      tap(() => alert('hi'))
    )
  })
}`),
  fromFixture(`
${setup}
class Effect {
  private actions$ = inject(Actions);
  foo$ = createEffect(() => {
    return this.actions$.pipe(
           ~~~~~~~~~~~~~~~~~~ [${messageId}]
      ofType(foo),
      tap(() => alert('hi'))
    )
  }, { dispatch: true });
}`),
  fromFixture(`
${setup}
class Effect {
  private actions$ = inject(Actions);
  foo$ = createEffect(
    () =>
      ({ debounce = 100 } = {}) =>
        debounce
          ? this.actions$.pipe(
            ~~~~~~~~~~~~~~~~~~ [${messageId}]
              ofType(fromFoo.foo),
              tap(() => alert('hi')),
            )
          : this.actions$.pipe(),
  );
}`),
  fromFixture(`
${setup}
class Effect {
  foo$: CreateEffectMetadata
  private actions$ = inject(Actions);

  constructor() {
    this.foo$ = createEffect(() =>
      this.actions$.pipe(
      ~~~~~~~~~~~~~~~~~~ [${messageId}]
        ofType(genericFoo),
      ),
    )
  }
}`),
];

const moreSetup = `
${setup}
import { Observable, switchMap, take } from 'rxjs'
const baz = createAction('BAZ')
`;

const validNested: () => (string | ValidTestCase<Options>)[] = () => [
  // Only the effect's outermost Actions pipe is its output, whether or not
  // another pipe comes before the nested one.
  `
${moreSetup}
class Effect {
  private actions$ = inject(Actions);
  foo$ = createEffect(() =>
    this.actions$.pipe(
      ofType(bar),
      switchMap(() => timer(1).pipe(map(() => 1))),
      switchMap(() => this.actions$.pipe(ofType(foo), take(1))),
      map(() => baz()),
    ),
  )
}`,
  // An Actions class that is not NgRx's is not the actions stream.
  `
${moreSetup}
class Actions extends Observable<unknown> {}
class Effect {
  private actions$ = new Actions();
  foo$ = createEffect(() => this.actions$.pipe(ofType(foo), map(() => foo())))
}`,
  `
${moreSetup}
export const foo$ = createEffect(
  (actions$ = inject(Actions)) => actions$.pipe(ofType(foo), map(() => foo())),
  { functional: true, dispatch: false }
);`,
];

const invalidFunctional: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(`
${moreSetup}
export const foo$ = createEffect(
  (actions$ = inject(Actions)) => actions$.pipe(ofType(foo), map(() => foo())),
                                  ~~~~~~~~~~~~~ [${messageId}]
  { functional: true }
);`),
  fromFixture(`
${moreSetup}
export const foo$ = createEffect(
  () => {
    const actions$ = inject(Actions);
    return actions$.pipe(ofType(foo), map(() => foo()));
           ~~~~~~~~~~~~~ [${messageId}]
  },
  { functional: true }
);`),
  // A dispatch: false object inside the body is not the effect's config.
  fromFixture(`
${moreSetup}
declare function log(options: object): void;
class Effect {
  private actions$ = inject(Actions);
  foo$ = createEffect(
    () =>
      this.actions$.pipe(
      ~~~~~~~~~~~~~~~~~~ [${messageId}]
        ofType(foo),
        map(() => {
          log({ dispatch: false });
          return foo();
        }),
      ),
    { useEffectsErrorHandler: true },
  )
}`),
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  ruleTester(rule.meta.docs?.requiresTypeChecking).run(
    path.parse(__filename).name,
    rule,
    {
      valid: [...validConstructor(), ...validInject(), ...validNested()],
      invalid: [
        ...invalidConstructor(),
        ...invalidInject(),
        ...invalidFunctional(),
      ],
    }
  );
});
