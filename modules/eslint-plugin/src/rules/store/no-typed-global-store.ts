import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  getImportDeclarations,
  getImportDeclarationSpecifier,
  isCallExpression,
  isTSInstantiationExpression,
  isTSTypeReference,
  NGRX_MODULE_PATHS,
} from '../../utils';
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export const noTypedStore = 'noTypedStore';
export const noTypedStoreSuggest = 'noTypedStoreSuggest';

type MessageIds = typeof noTypedStore | typeof noTypedStoreSuggest;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: 'The global store should not be typed.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [noTypedStore]:
        '`Store` should not be typed, use `Store` (without generic) instead.',
      [noTypedStoreSuggest]: 'Remove generic from `Store`.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    return {
      // Every use of the `Store` imported from @ngrx/store with a generic: as
      // a type (`store: Store<S>`, `store: Store<S> = inject(Store)`,
      // `inject<Store<S>>(Store)`) or as a value (`inject(Store<S>)`), in a
      // class or a function.
      Program(program: TSESTree.Program) {
        const { importSpecifier } =
          getImportDeclarationSpecifier(
            getImportDeclarations(program, NGRX_MODULE_PATHS.store) ?? [],
            'Store'
          ) ?? {};
        if (!importSpecifier) {
          return;
        }
        const [variable] =
          context.sourceCode.getDeclaredVariables(importSpecifier);

        // Only where the store is declared or injected: another function
        // given `Store<S>` (e.g. `somethingElse(Store<{}>)`) is not.
        const isInjectCall = (node: TSESTree.Node | undefined) =>
          !!node &&
          isCallExpression(node) &&
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === 'inject';

        for (const { identifier } of variable?.references ?? []) {
          const { parent } = identifier;
          if (
            isTSTypeReference(parent) &&
            parent.typeName === identifier &&
            parent.typeArguments &&
            (parent.parent?.type === AST_NODE_TYPES.TSTypeAnnotation ||
              (parent.parent?.type ===
                AST_NODE_TYPES.TSTypeParameterInstantiation &&
                isInjectCall(parent.parent.parent)))
          ) {
            report(parent.typeArguments);
          } else if (
            isTSInstantiationExpression(parent) &&
            parent.expression === identifier &&
            isInjectCall(parent.parent)
          ) {
            report(parent.typeArguments);
          }
        }
      },
    };

    function report(typeArguments: TSESTree.TSTypeParameterInstantiation) {
      context.report({
        node: typeArguments,
        messageId: noTypedStore,
        suggest: [
          {
            messageId: noTypedStoreSuggest,
            fix: (fixer) => fixer.remove(typeArguments),
          },
        ],
      });
    }
  },
});
