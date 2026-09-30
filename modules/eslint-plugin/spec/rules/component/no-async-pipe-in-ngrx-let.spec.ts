import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, {
  messageId,
} from '../../../src/rules/component/no-async-pipe-in-ngrx-let';
import { templateRuleTester } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const valid: () => (string | ValidTestCase<Options>)[] = () => [
  `<ng-container *ngrxLet="items$ as items">{{ items.length }}</ng-container>`,
  `<ng-container *ngrxLet="{ a: a$, b: b$ } as vm">{{ vm.a }}</ng-container>`,
  `<p [ngrxLet]="items$"></p>`,
  // \`async\` outside \`ngrxLet\`.
  `<p>{{ items$ | async }}</p>`,
  `<ng-container *ngIf="items$ | async as items">{{ items }}</ng-container>`,
  // Deeper in the expression: removing the pipe would change what is read.
  `<ng-container *ngrxLet="(items$ | async)?.length as count">{{ count }}</ng-container>`,
];

const invalid: () => InvalidTestCase<MessageIds, Options>[] = () => [
  {
    code: `<ng-container *ngrxLet="items$ | async as items">{{ items }}</ng-container>`,
    errors: [{ messageId, line: 1, column: 25, endColumn: 39 }],
    output: `<ng-container *ngrxLet="items$ as items">{{ items }}</ng-container>`,
  },
  {
    code: `<p [ngrxLet]="items$ | async"></p>`,
    errors: [{ messageId }],
    output: `<p [ngrxLet]="items$"></p>`,
  },
  // The other keys of the binding (`suspense`) stay.
  {
    code: `<ng-container *ngrxLet="items$ | async as items; suspense: loading">{{ items }}</ng-container>`,
    errors: [{ messageId }],
    output: `<ng-container *ngrxLet="items$ as items; suspense: loading">{{ items }}</ng-container>`,
  },
  // A dictionary of observables: each piped value.
  {
    code: `<ng-container *ngrxLet="{ a: a$ | async, b: b$ | async, c: c$ } as vm">{{ vm.a }}</ng-container>`,
    errors: [{ messageId }, { messageId }],
    output: `<ng-container *ngrxLet="{ a: a$, b: b$, c: c$ } as vm">{{ vm.a }}</ng-container>`,
  },
  {
    code: `
<div>
  <ng-container *ngrxLet="user$ | async as user">{{ user.name }}</ng-container>
</div>`,
    errors: [{ messageId, line: 3, column: 27 }],
    output: `
<div>
  <ng-container *ngrxLet="user$ as user">{{ user.name }}</ng-container>
</div>`,
  },
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  templateRuleTester().run(path.parse(__filename).name, rule, {
    valid: valid(),
    invalid: invalid(),
  });
});
