import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, {
  messageId,
} from '../../../src/rules/signals/signal-store-feature-should-use-generic-type';
import { ruleTester, fromFixture } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const valid: () => (string | ValidTestCase<Options>)[] = () => [
  `const withY = <Y>() => signalStoreFeature({ state: type<{ y: Y }>() }, withState({}));`,
  `export const withY = <Y>() => signalStoreFeature(type<{ state: { y: Y } }>(), withState({}));`,
  `const withY = <_>() => { return signalStoreFeature({ state: type<{ y: number }>() }, withState({})); }`,
  `export const withY = <_>() => { return signalStoreFeature(type<{ state: { y: number } }>(), withState({})); }`,
  `function withY<Y>() { return signalStoreFeature({ state: type<{ y: Y }>() }, withState({})); }`,
  `export function withY<_>() { return signalStoreFeature(type<{ state: { y: number } }>(), withState({})); }`,
  `function withY<_>() {
    const feature = signalStoreFeature(type<{ state: { y: number } }>(), withState({}));
    return feature;
  }`,
  // The nearest function creates the feature; an outer one is not checked.
  `function outer() {
    const withY = <Y>() => signalStoreFeature({ state: type<{ y: Y }>() }, withState({}));
    return withY;
  }`,
];

const invalid: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(
    `
const withY = () => signalStoreFeature({ state: type<{ y: number }>() }, withState({}));
                    ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
const withY = <_>() => signalStoreFeature({ state: type<{ y: number }>() }, withState({}));`,
    }
  ),
  fromFixture(
    `
const withY = () => signalStoreFeature(type<{ state: { y: number } }>(), withState({}));
                    ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
const withY = <_>() => signalStoreFeature(type<{ state: { y: number } }>(), withState({}));`,
    }
  ),
  fromFixture(
    `
const withY = () => { return signalStoreFeature({ state: type<{ y: number }>() }, withState({})); }
                             ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
const withY = <_>() => { return signalStoreFeature({ state: type<{ y: number }>() }, withState({})); }`,
    }
  ),
  fromFixture(
    `
const withY = () => { return signalStoreFeature(type<{ state: { y: number } }>(), withState({})); }
                             ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
const withY = <_>() => { return signalStoreFeature(type<{ state: { y: number } }>(), withState({})); }`,
    }
  ),
  fromFixture(
    `
function withY() { return signalStoreFeature(type<{ state: { y: number } }>(), withState({})); }
                          ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
function withY<_>() { return signalStoreFeature(type<{ state: { y: number } }>(), withState({})); }`,
    }
  ),
  fromFixture(
    `
function withY() { return signalStoreFeature({ state: type<{ y: number }>() }, withState({})); }
                          ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
function withY<_>() { return signalStoreFeature({ state: type<{ y: number }>() }, withState({})); }`,
    }
  ),
  fromFixture(
    `
function withY() {
  const feature = signalStoreFeature({ state: type<{ y: number }>() }, withState({}));
                  ~~~~~~~~~~~~~~~~~~ [${messageId}]
  return feature;
}`,
    {
      output: `
function withY<_>() {
  const feature = signalStoreFeature({ state: type<{ y: number }>() }, withState({}));
  return feature;
}`,
    }
  ),
  // Reported once, on the nearest function only.
  fromFixture(
    `
function outer() {
  const withY = () => signalStoreFeature({ state: type<{ y: number }>() });
                      ~~~~~~~~~~~~~~~~~~ [${messageId}]
  return withY;
}`,
    {
      output: `
function outer() {
  const withY = <_>() => signalStoreFeature({ state: type<{ y: number }>() });
  return withY;
}`,
    }
  ),
  fromFixture(
    `
const withY = async () => signalStoreFeature({ state: type<{ y: number }>() });
                          ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
const withY = async <_>() => signalStoreFeature({ state: type<{ y: number }>() });`,
    }
  ),
  fromFixture(
    `
const withY = function (y) { return signalStoreFeature({ state: type<{ y: number }>() }); };
                                    ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
const withY = function <_>(y) { return signalStoreFeature({ state: type<{ y: number }>() }); };`,
    }
  ),
  fromFixture(
    `
const withY = y => signalStoreFeature({ state: type<{ y: number }>() });
                   ~~~~~~~~~~~~~~~~~~ [${messageId}]`,
    {
      output: `
const withY = <_>(y) => signalStoreFeature({ state: type<{ y: number }>() });`,
    }
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
