import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, {
  useConsistentGlobalStoreName,
  useConsistentGlobalStoreNameSuggest,
} from '../../../src/rules/store/use-consistent-global-store-name';
import { ruleTester, fromFixture } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const validConstructor: () => (string | ValidTestCase<Options>)[] = () => [
  `
class Ok {}`,
  `
import { Store } from '@ngrx/store'

class Ok1 {
  constructor(store: Store) {}
}`,
  {
    code: `
import { Store } from '@ngrx/store'

class Ok2 {
  constructor(private customName: Store) {}
}`,
    options: ['customName'],
  },
];

const validInject: () => (string | ValidTestCase<Options>)[] = () => [
  `
class Ok3 {}`,
  `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class Ok4 {
  readonly store = inject(Store)
}`,
  {
    code: `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class Ok5 {
  readonly customName = inject(Store)
}`,
    options: ['customName'],
  },
];

const invalidConstructor: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(
    `
import { Store } from '@ngrx/store'

class NotOk {
  constructor(private readonly somethingElse$: Store) {}
                               ~~~~~~~~~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest]
}`,
    {
      suggestions: [
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'store',
          },
          output: `
import { Store } from '@ngrx/store'

class NotOk {
  constructor(private readonly store: Store) {}
}`,
        },
      ],
    }
  ),
  // No suggestion: `store` is taken, and renaming would declare it twice.
  fromFixture(
    `
import { Store } from '@ngrx/store'

class NotOk1 {
  constructor(private readonly store1: Store, private readonly store: Store) {}
                               ~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" }]
}`
  ),
  fromFixture(
    `
import { Store } from '@ngrx/store'

class NotOk2 {
  constructor(private readonly store1: Store, private readonly store2: Store) {}
                               ~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest 0]
                                                               ~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest 1]
}`,
    {
      suggestions: [
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'store',
          },
          output: `
import { Store } from '@ngrx/store'

class NotOk2 {
  constructor(private readonly store: Store, private readonly store2: Store) {}
}`,
        },
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'store',
          },
          output: `
import { Store } from '@ngrx/store'

class NotOk2 {
  constructor(private readonly store1: Store, private readonly store: Store) {}
}`,
        },
      ],
    }
  ),
  fromFixture(
    `
import { Store } from '@ngrx/store'

class NotOk3 {
  constructor(private store: Store) {}
                      ~~~~~ [${useConsistentGlobalStoreName} { "storeName": "customName" } suggest]
}`,
    {
      options: ['customName'],
      suggestions: [
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'customName',
          },
          output: `
import { Store } from '@ngrx/store'

class NotOk3 {
  constructor(private customName: Store) {}
}`,
        },
      ],
    }
  ),
];

const invalidInject: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk4 {
  readonly somethingElse$: Store = inject(Store)
           ~~~~~~~~~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest]
}`,
    {
      suggestions: [
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'store',
          },
          output: `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk4 {
  readonly store: Store = inject(Store)
}`,
        },
      ],
    }
  ),
  // No suggestion: `store` is taken, and renaming would declare it twice.
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk5 {
  private readonly store1 = inject(Store)
                   ~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" }]
  private readonly store = inject(Store)
}`
  ),
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk6 {
  private readonly store1 = inject(Store)
                   ~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest 0]
  private readonly store2 = inject(Store)
                   ~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest 1]
}`,
    {
      suggestions: [
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'store',
          },
          output: `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk6 {
  private readonly store = inject(Store)
  private readonly store2 = inject(Store)
}`,
        },
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'store',
          },
          output: `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk6 {
  private readonly store1 = inject(Store)
  private readonly store = inject(Store)
}`,
        },
      ],
    }
  ),
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk7 {
  private store = inject(Store)
          ~~~~~ [${useConsistentGlobalStoreName} { "storeName": "customName" } suggest]
}`,
    {
      options: ['customName'],
      suggestions: [
        {
          messageId: useConsistentGlobalStoreNameSuggest,
          data: {
            storeName: 'customName',
          },
          output: `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class NotOk7 {
  private customName = inject(Store)
}`,
        },
      ],
    }
  ),
];

const suggestStore = (output: string) => ({
  suggestions: [
    {
      messageId: useConsistentGlobalStoreNameSuggest,
      data: { storeName: 'store' },
      output,
    },
  ] as const,
});

const invalidUsesAndVariables: () => InvalidTestCase<
  MessageIds,
  Options
>[] = () => [
  // A well-named store earlier in the file doesn't end the check.
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class Ok {
  private readonly store = inject(Store)
}

class NotOk8 {
  private readonly appStore = inject(Store)
                   ~~~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest]
}`,
    suggestStore(`
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

class Ok {
  private readonly store = inject(Store)
}

class NotOk8 {
  private readonly store = inject(Store)
}`)
  ),
  // Every use is renamed: \`this.name\` in the class (not in a nested class),
  // and a constructor parameter's bare name.
  fromFixture(
    `
import { Store } from '@ngrx/store'

class NotOk9 {
  books$ = this.appStore.select(selectBooks)
  constructor(private readonly appStore: Store) {
                               ~~~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest]
    appStore.dispatch(init())
  }
  load = () => this.appStore.dispatch(load())
  nested() {
    return class { appStore = 1; value = this.appStore }
  }
}`,
    suggestStore(`
import { Store } from '@ngrx/store'

class NotOk9 {
  books$ = this.store.select(selectBooks)
  constructor(private readonly store: Store) {
    store.dispatch(init())
  }
  load = () => this.store.dispatch(load())
  nested() {
    return class { appStore = 1; value = this.appStore }
  }
}`)
  ),
  // A store held in a variable, as in a functional resolver; a shorthand
  // property keeps its key.
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

export const booksResolver = () => {
  const appStore = inject(Store)
        ~~~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest]
  appStore.dispatch(loadBooks())
  return { appStore }
}`,
    suggestStore(`
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

export const booksResolver = () => {
  const store = inject(Store)
  store.dispatch(loadBooks())
  return { appStore: store }
}`)
  ),
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

export const booksResolver = (appStore = inject(Store)) =>
                              ~~~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" } suggest]
  appStore.select(selectBooks)`,
    suggestStore(`
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

export const booksResolver = (store = inject(Store)) =>
  store.select(selectBooks)`)
  ),
  // No suggestion: a use sees another \`store\`.
  fromFixture(
    `
import { Store } from '@ngrx/store'
import { inject } from '@angular/core'

export const booksResolver = () => {
  const appStore = inject(Store)
        ~~~~~~~~ [${useConsistentGlobalStoreName} { "storeName": "store" }]
  return stores.map((store) => appStore.select(store))
}`
  ),
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  ruleTester(rule.meta.docs?.requiresTypeChecking).run(
    path.parse(__filename).name,
    rule,
    {
      valid: [...validConstructor(), ...validInject()],
      invalid: [
        ...invalidConstructor(),
        ...invalidInject(),
        ...invalidUsesAndVariables(),
      ],
    }
  );
});
