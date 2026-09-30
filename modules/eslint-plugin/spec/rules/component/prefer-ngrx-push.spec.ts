import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, { messageId } from '../../../src/rules/component/prefer-ngrx-push';
import { templateRuleTester } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const valid: () => (string | ValidTestCase<Options>)[] = () => [
  `<p>{{ items$ | ngrxPush }}</p>`,
  `<p [title]="title$ | ngrxPush"></p>`,
  // Reported, with a fix, by no-async-with-ngrx-push instead.
  `<p>{{ items$ | async | ngrxPush }}</p>`,
  `<p>{{ items$ | ngrxPush | async }}</p>`,
  `<p>{{ (items$ | async) | ngrxPush }}</p>`,
  // In an ngrxLet binding: no-async-pipe-in-ngrx-let's concern.
  `<ng-container *ngrxLet="items$ | async as items">{{ items }}</ng-container>`,
  `<ng-container *ngrxLet="{ a: a$ | async } as vm">{{ vm.a }}</ng-container>`,
  // Another pipe named like it is not the async pipe.
  `<p>{{ items$ | asyncPreview }}</p>`,
];

const invalid: () => InvalidTestCase<MessageIds, Options>[] = () => [
  {
    code: `<p>{{ items$ | async }}</p>`,
    errors: [{ messageId, line: 1, column: 7, endColumn: 21 }],
  },
  {
    code: `<p [title]="title$ | async"></p>`,
    errors: [{ messageId }],
  },
  {
    code: `<ng-container *ngIf="user$ | async as user">{{ user.name }}</ng-container>`,
    errors: [{ messageId }],
  },
  // Chained with other pipes, and each of several.
  {
    code: `<p>{{ (date$ | async) | date: 'short' }} {{ count$ | async }}</p>`,
    errors: [{ messageId }, { messageId }],
  },
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  templateRuleTester().run(path.parse(__filename).name, rule, {
    valid: valid(),
    invalid: invalid(),
  });
});
