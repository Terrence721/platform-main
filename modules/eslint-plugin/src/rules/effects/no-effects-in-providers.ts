import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  effectsInNgModuleImports,
  effectsInNgModuleProviders,
  getNodeToCommaRemoveFix,
  isIdentifier,
  ngModuleDecorator,
} from '../../utils';

export const messageId = 'noEffectsInProviders';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description:
        '`Effect` should not be listed as a provider if it is added to the `EffectsModule`.',
      ngrxModule: 'effects',
    },
    fixable: 'code',
    schema: [],
    messages: {
      [messageId]:
        '`Effect` should not be listed as a provider if it is added to the `EffectsModule`.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const effectsInProviders = new Set<TSESTree.Identifier>();
    const effectsInImports = new Set<string>();

    const reported = new WeakSet<TSESTree.Identifier>();
    function report(effectInProvider: TSESTree.Identifier) {
      if (reported.has(effectInProvider)) {
        return;
      }
      reported.add(effectInProvider);
      context.report({
        node: effectInProvider,
        messageId,
        fix: (fixer) =>
          getNodeToCommaRemoveFix(context.sourceCode, fixer, effectInProvider),
      });
    }

    return {
      [effectsInNgModuleProviders](node: TSESTree.Identifier) {
        effectsInProviders.add(node);
      },
      [effectsInNgModuleImports]({ name }: TSESTree.Identifier) {
        effectsInImports.add(name);
      },
      [`${ngModuleDecorator}:exit`]() {
        for (const effectInProvider of effectsInProviders) {
          if (effectsInImports.has(effectInProvider.name)) {
            report(effectInProvider);
          }
        }

        effectsInImports.clear();
        effectsInProviders.clear();
      },
      // Standalone: `providers: [provideEffects(FooEffects), FooEffects]`, in
      // bootstrapApplication, an app config, route providers or an NgModule.
      [`Property[key.name='providers'] > ArrayExpression`](
        node: TSESTree.ArrayExpression
      ) {
        const provided = new Set<string>();
        for (const element of node.elements) {
          if (
            element?.type !== AST_NODE_TYPES.CallExpression ||
            !isIdentifier(element.callee) ||
            element.callee.name !== 'provideEffects'
          ) {
            continue;
          }
          for (const argument of element.arguments) {
            const effects =
              argument.type === AST_NODE_TYPES.ArrayExpression
                ? argument.elements
                : [argument];
            for (const effect of effects) {
              if (effect && isIdentifier(effect)) {
                provided.add(effect.name);
              }
            }
          }
        }

        for (const element of node.elements) {
          if (element && isIdentifier(element) && provided.has(element.name)) {
            report(element);
          }
        }
      },
    };
  },
});
