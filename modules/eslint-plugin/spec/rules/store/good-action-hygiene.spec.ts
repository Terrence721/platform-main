import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, { messageId } from '../../../src/rules/store/good-action-hygiene';
import { ruleTester, fromFixture } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const valid: () => (string | ValidTestCase<Options>)[] = () => [
  `export const loadCustomer = createAction('[Customer Page] Load Customer')`,
  `export const loadCustomerSuccess = createAction('[Customer API] Load Customer Success', props<{ customer: Customer }>())`,
  `export const loadCustomerFail = createAction('[Customer API] Load Customer Fail', (error: string) => ({ error, timestamp: +Date.now() }))`,
  `export const computed = createAction(iDoNotCrash)`,
  `export const withIncorrectFunction = createActionType('Just testing')`,
  `export const loadCustomer = createAction("[Customer Page] Load Customer")`,
  // A template literal with expressions is only known at runtime.
  'export const loadCustomer = createAction(`${source} Load Customer`)',
];

const invalid: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(
    `
        export const loadCustomer = createAction('Load Customer')
                                                 ~~~~~~~~~~~~~~~ [${messageId} { "actionType": "Load Customer" }]
    `
  ),
  // Any quotes, and a template literal without expressions.
  fromFixture(
    `
        export const loadCustomer = createAction("Load Customer")
                                                 ~~~~~~~~~~~~~~~ [${messageId} { "actionType": "Load Customer" }]
    `
  ),
  fromFixture(
    `
        export const loadCustomer = createAction(\`Load Customer\`)
                                                 ~~~~~~~~~~~~~~~ [${messageId} { "actionType": "Load Customer" }]
    `
  ),
  // The source must come first and not be empty.
  fromFixture(
    `
        export const loadCustomer = createAction('Load [Customer] Now')
                                                 ~~~~~~~~~~~~~~~~~~~~~ [${messageId} { "actionType": "Load [Customer] Now" }]
    `
  ),
  fromFixture(
    `
        export const loadCustomer = createAction('[] Load Customer')
                                                 ~~~~~~~~~~~~~~~~~~ [${messageId} { "actionType": "[] Load Customer" }]
    `
  ),
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  ruleTester(rule.meta.docs?.requiresTypeChecking).run(
    path.parse(__filename).name,
    rule,
    {
      valid: valid(),
      invalid: invalid(),
    }
  );
});
