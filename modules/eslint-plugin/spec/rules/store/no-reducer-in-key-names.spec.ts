import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, {
  noReducerInKeyNames,
  noReducerInKeyNamesSuggest,
} from '../../../src/rules/store/no-reducer-in-key-names';
import { ruleTester } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const valid: () => (string | ValidTestCase<Options>)[] = () => [
  `
@NgModule({
  imports: [
    StoreModule.forRoot({
      foo,
      persons: personsReducer,
      'people': peopleReducer,
    }),
  ],
})
export class AppModule {}`,
  `
  @NgModule({
    imports: [
      StoreModule.forFeature({
        foo,
        persons: personsReducer,
        'people': peopleReducer,
      }),
    ],
  })
  export class AppModule {}`,
  // https://github.com/timdeschryver/eslint-plugin-ngrx/issues/91
  `
@NgModule({
  imports: [
    StoreModule.forRoot(reducers, {metaReducers}),
  ],
})
export class AppModule {}`,
  `
export const reducers: ActionReducerMap<AppState> = {
  foo,
  persons: personsReducer,
  'people': peopleReducer,
};`,
  // A feature slice's \`reducer\` key is required, and \`metaReducers\` is config.
  `
@NgModule({
  imports: [
    StoreModule.forFeature({ name: 'books', reducer: booksReducer }),
    StoreModule.forRoot({ books: booksReducer }, { metaReducers }),
  ],
})
export class AppModule {}`,
  `export const providers = [provideState({ name: 'books', reducer: booksReducer })];`,
];

const invalid: () => InvalidTestCase<MessageIds, Options>[] = () => [
  {
    code: `
@NgModule({
  imports: [
    StoreModule.forRoot({
      feeReducer,
    }),
  ],
})
export class AppModule {}`,
    errors: [
      {
        column: 7,
        endColumn: 17,
        line: 5,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `
@NgModule({
  imports: [
    StoreModule.forRoot({
      fee,
    }),
  ],
})
export class AppModule {}`,
          },
        ],
      },
    ],
  },
  {
    code: `
@NgModule({
  imports: [
    StoreModule.forFeature({
      'foo-reducer': foo,
      FoeReducer: FoeReducer,
    }),
  ],
})
export class AppModule {}`,
    errors: [
      {
        column: 7,
        endColumn: 20,
        line: 5,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `
@NgModule({
  imports: [
    StoreModule.forFeature({
      'foo-': foo,
      FoeReducer: FoeReducer,
    }),
  ],
})
export class AppModule {}`,
          },
        ],
      },
      {
        column: 7,
        endColumn: 17,
        line: 6,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `
@NgModule({
  imports: [
    StoreModule.forFeature({
      'foo-reducer': foo,
      Foe: FoeReducer,
    }),
  ],
})
export class AppModule {}`,
          },
        ],
      },
    ],
  },
  {
    code: `
export const reducers: ActionReducerMap<AppState> = {
  feeReducer,
  'fieReducer': fie,
  ['fooReducerName']: foo,
  [\`ReducerFoe\`]: FoeReducer,
};`,
    errors: [
      {
        column: 3,
        endColumn: 13,
        line: 3,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `
export const reducers: ActionReducerMap<AppState> = {
  fee,
  'fieReducer': fie,
  ['fooReducerName']: foo,
  [\`ReducerFoe\`]: FoeReducer,
};`,
          },
        ],
      },
      {
        column: 3,
        endColumn: 15,
        line: 4,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `
export const reducers: ActionReducerMap<AppState> = {
  feeReducer,
  'fie': fie,
  ['fooReducerName']: foo,
  [\`ReducerFoe\`]: FoeReducer,
};`,
          },
        ],
      },
      {
        column: 4,
        endColumn: 20,
        line: 5,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `
export const reducers: ActionReducerMap<AppState> = {
  feeReducer,
  'fieReducer': fie,
  ['fooName']: foo,
  [\`ReducerFoe\`]: FoeReducer,
};`,
          },
        ],
      },
      {
        column: 4,
        endColumn: 16,
        line: 6,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `
export const reducers: ActionReducerMap<AppState> = {
  feeReducer,
  'fieReducer': fie,
  ['fooReducerName']: foo,
  [\`Foe\`]: FoeReducer,
};`,
          },
        ],
      },
    ],
  },
];

// The map is forFeature's and provideState's second argument; provideStore's
// first. A key that is only "reducer" has no suggestion (no name would be left).
const invalidFeatureAndStandalone: () => InvalidTestCase<
  MessageIds,
  Options
>[] = () => [
  {
    code: `StoreModule.forFeature('books', { booksReducer: books })`,
    errors: [
      {
        column: 35,
        endColumn: 47,
        line: 1,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `StoreModule.forFeature('books', { books: books })`,
          },
        ],
      },
    ],
  },
  {
    code: `provideStore({ booksReducer: books })`,
    errors: [
      {
        column: 16,
        endColumn: 28,
        line: 1,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `provideStore({ books: books })`,
          },
        ],
      },
    ],
  },
  {
    code: `provideState('books', { booksReducer: books })`,
    errors: [
      {
        column: 25,
        endColumn: 37,
        line: 1,
        messageId: noReducerInKeyNames,
        suggestions: [
          {
            messageId: noReducerInKeyNamesSuggest,
            output: `provideState('books', { books: books })`,
          },
        ],
      },
    ],
  },
  {
    code: `export const reducers: ActionReducerMap<AppState> = { reducer: books };`,
    errors: [
      {
        column: 55,
        endColumn: 62,
        line: 1,
        messageId: noReducerInKeyNames,
        suggestions: [],
      },
    ],
  },
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  ruleTester(rule.meta.docs?.requiresTypeChecking).run(
    path.parse(__filename).name,
    rule,
    {
      valid: valid(),
      invalid: [...invalid(), ...invalidFeatureAndStandalone()],
    }
  );
});
