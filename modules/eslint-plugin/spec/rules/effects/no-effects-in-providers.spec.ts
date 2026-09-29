import type { ESLintUtils } from '@typescript-eslint/utils';
import type {
  InvalidTestCase,
  ValidTestCase,
} from '@typescript-eslint/rule-tester';
import * as path from 'path';
import rule, {
  messageId,
} from '../../../src/rules/effects/no-effects-in-providers';
import { ruleTester, fromFixture } from '../../utils';

type MessageIds = ESLintUtils.InferMessageIdsTypeFromRule<typeof rule>;
type Options = ESLintUtils.InferOptionsTypeFromRule<typeof rule>;

const valid: () => (string | ValidTestCase<Options>)[] = () => [
  `
@NgModule({
  imports: [
    StoreModule.forFeature('persons', {"foo": "bar"}),
    EffectsModule.forRoot([RootEffectOne]),
    EffectsModule.forFeature([FeatEffectOne]),
  ],
  providers: [FeatEffectTwo, UnRegisteredEffect, FeatEffectThree, RootEffectTwo],
})
export class AppModule {}`,
];

const invalid: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(
    `
@NgModule({
  imports: [EffectsModule.forFeature([RegisteredEffect])],
  providers: [RegisteredEffect]
              ~~~~~~~~~~~~~~~~ [${messageId}]
})
export class AppModule {}`,
    {
      output: `
@NgModule({
  imports: [EffectsModule.forFeature([RegisteredEffect])],
  providers: []
})
export class AppModule {}`,
    }
  ),
  fromFixture(
    `
@NgModule({
  imports: [EffectsModule.forRoot([RegisteredEffect])],
  providers: [
    RegisteredEffect// Let's see what happens with this comment?
    ~~~~~~~~~~~~~~~~ [${messageId}]
    ,
  ],
})
export class AppModule {}`,
    {
      output: `
@NgModule({
  imports: [EffectsModule.forRoot([RegisteredEffect])],
  providers: [
    // Let's see what happens with this comment?
    
  ],
})
export class AppModule {}`,
    }
  ),
  fromFixture(
    `
@NgModule({
  providers: [
    UnRegisteredEffect,
    FeatEffectTwo,
    ~~~~~~~~~~~~~ [${messageId}]


    UnRegisteredEffect2,
  ],
  'imports': [
    EffectsModule.forFeature([FeatEffectOne, FeatEffectTwo]),
  ],
})
export class AppModule {}

@NgModule({
  imports: [EffectsModule.forFeature([UnRegisteredEffect])],
  providers: [],
})
export class SharedModule {}`,
    {
      output: `
@NgModule({
  providers: [
    UnRegisteredEffect,
    


    UnRegisteredEffect2,
  ],
  'imports': [
    EffectsModule.forFeature([FeatEffectOne, FeatEffectTwo]),
  ],
})
export class AppModule {}

@NgModule({
  imports: [EffectsModule.forFeature([UnRegisteredEffect])],
  providers: [],
})
export class SharedModule {}`,
    }
  ),
  fromFixture(
    `
@NgModule({
  imports: [
    StoreModule.forFeature('persons', {"foo": "bar"}),
    EffectsModule.forRoot([RootEffectOne, RootEffectTwo]),
    EffectsModule.forFeature([FeatEffectOne, FeatEffectTwo]),
    EffectsModule.forFeature([FeatEffectThree]),
  ],
  ['providers']: [
    FeatEffectTwo,
    ~~~~~~~~~~~~~   [${messageId}]
    UnRegisteredEffect,
    FeatEffectThree/* Deprecated effect */,
    ~~~~~~~~~~~~~~~ [${messageId}]
    RootEffectTwo
    ~~~~~~~~~~~~~   [${messageId}]
  ],
})
export class AppModule {}`,
    {
      output: `
@NgModule({
  imports: [
    StoreModule.forFeature('persons', {"foo": "bar"}),
    EffectsModule.forRoot([RootEffectOne, RootEffectTwo]),
    EffectsModule.forFeature([FeatEffectOne, FeatEffectTwo]),
    EffectsModule.forFeature([FeatEffectThree]),
  ],
  ['providers']: [
    
    UnRegisteredEffect,
    /* Deprecated effect */
    
  ],
})
export class AppModule {}`,
    }
  ),
  fromFixture(
    `
@NgModule({
  [\`providers\`]: [
    FeatEffectTwo,
    ~~~~~~~~~~~~~   [${messageId}]
    FeatEffectThree,
    ~~~~~~~~~~~~~~~ [${messageId}]
    RootEffectTwo,
    ~~~~~~~~~~~~~   [${messageId}]
    UnRegisteredEffect
  ],
  ['imports']: [
    StoreModule.forFeature('persons', {"foo": "bar"}),
    EffectsModule.forRoot([RootEffectOne, RootEffectTwo]),
    EffectsModule.forFeature([FeatEffectOne, FeatEffectTwo]),
    EffectsModule.forFeature([FeatEffectThree]),
  ],
})
export class AppModule {}`,
    {
      output: `
@NgModule({
  [\`providers\`]: [
    
    
    
    UnRegisteredEffect
  ],
  ['imports']: [
    StoreModule.forFeature('persons', {"foo": "bar"}),
    EffectsModule.forRoot([RootEffectOne, RootEffectTwo]),
    EffectsModule.forFeature([FeatEffectOne, FeatEffectTwo]),
    EffectsModule.forFeature([FeatEffectThree]),
  ],
})
export class AppModule {}`,
    }
  ),
];

const validProviderObjects: () => (string | ValidTestCase<Options>)[] = () => [
  // Only a class listed directly is a provider of that class.
  `
@NgModule({
  imports: [EffectsModule.forFeature([RegisteredEffect])],
  providers: [
    { provide: EFFECT_TOKEN, useClass: RegisteredEffect },
    { provide: RegisteredEffect, useClass: MockEffect },
    provideSomething(RegisteredEffect),
  ],
})
export class AppModule {}`,
  `
export const routes = [
  { path: 'a', providers: [provideEffects(RegisteredEffect), OtherEffect] },
];`,
];

const invalidStandalone: () => InvalidTestCase<MessageIds, Options>[] = () => [
  fromFixture(
    `
bootstrapApplication(App, {
  providers: [provideEffects(RegisteredEffect, OtherEffect), RegisteredEffect],
                                                             ~~~~~~~~~~~~~~~~ [${messageId}]
});`,
    {
      output: `
bootstrapApplication(App, {
  providers: [provideEffects(RegisteredEffect, OtherEffect), ],
});`,
    }
  ),
  fromFixture(
    `
export const appConfig = {
  providers: [RegisteredEffect, provideEffects([RegisteredEffect])],
              ~~~~~~~~~~~~~~~~ [${messageId}]
};`,
    {
      output: `
export const appConfig = {
  providers: [ provideEffects([RegisteredEffect])],
};`,
    }
  ),
  // Registered both ways in one module: reported once.
  fromFixture(
    `
@NgModule({
  imports: [EffectsModule.forFeature([RegisteredEffect])],
  providers: [provideEffects(RegisteredEffect), RegisteredEffect],
                                                ~~~~~~~~~~~~~~~~ [${messageId}]
})
export class AppModule {}`,
    {
      output: `
@NgModule({
  imports: [EffectsModule.forFeature([RegisteredEffect])],
  providers: [provideEffects(RegisteredEffect), ],
})
export class AppModule {}`,
    }
  ),
];

// Static describe so Vitest's typecheck mode finds a suite (see spec/utils/rule-tester.ts).
describe('rule', () => {
  ruleTester(rule.meta.docs?.requiresTypeChecking).run(
    path.parse(__filename).name,
    rule,
    {
      valid: [...valid(), ...validProviderObjects()],
      invalid: [...invalid(), ...invalidStandalone()],
    }
  );
});
