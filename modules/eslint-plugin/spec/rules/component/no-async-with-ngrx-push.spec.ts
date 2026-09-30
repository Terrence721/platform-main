import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, {
  messageId,
} from '../../../src/rules/component/no-async-with-ngrx-push';
import { templateRuleTester } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const valid: () => (string | ValidTestCase<Options>)[] = () => [
  `<p>{{ items$ | ngrxPush }}</p>`,
  `<p>{{ items$ | async }}</p>`,
  // Other pipes around one subscribing pipe.
  `<p>{{ date$ | ngrxPush | date: 'short' }}</p>`,
  `<p>{{ date$ | async | date }}</p>`,
  // Different observables.
  `<p [title]="(title$ | async) + (suffix$ | ngrxPush)"></p>`,
];

const invalid: () => InvalidTestCase<MessageIds, Options>[] = () => [
  {
    code: `<p>{{ items$ | async | ngrxPush }}</p>`,
    errors: [{ messageId, line: 1, column: 7, endColumn: 32 }],
    output: `<p>{{ items$ | ngrxPush }}</p>`,
  },
  // `async` after `ngrxPush` throws on the plain value it receives.
  {
    code: `<p>{{ items$ | ngrxPush | async }}</p>`,
    errors: [{ messageId }],
    output: `<p>{{ items$ | ngrxPush }}</p>`,
  },
  // `ngrxPush`'s arguments stay.
  {
    code: `<p>{{ items$ | async | ngrxPush: config }}</p>`,
    errors: [{ messageId }],
    output: `<p>{{ items$ | ngrxPush: config }}</p>`,
  },
  {
    code: `<p>{{ (items$ | async) | ngrxPush }}</p>`,
    errors: [{ messageId }],
    output: `<p>{{ items$ | ngrxPush }}</p>`,
  },
  {
    code: `<p [title]="title$ | ngrxPush | async"></p>`,
    errors: [{ messageId }],
    output: `<p [title]="title$ | ngrxPush"></p>`,
  },
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  templateRuleTester().run(path.parse(__filename).name, rule, {
    valid: valid(),
    invalid: invalid(),
  });
});
