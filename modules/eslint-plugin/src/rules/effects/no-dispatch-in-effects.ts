import type { TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  asPattern,
  createEffectExpression,
  dispatchInEffects,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxStores,
  isArrowFunctionExpression,
  isReturnStatement,
  isVariableOfClass,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const noDispatchInEffects = 'noDispatchInEffects';
export const noDispatchInEffectsSuggest = 'noDispatchInEffectsSuggest';

type MessageIds =
  typeof noDispatchInEffects | typeof noDispatchInEffectsSuggest;
type Options = readonly [];
type MemberExpressionWithinCallExpression = TSESTree.MemberExpression & {
  parent: TSESTree.CallExpression;
};

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: '`Effect` should not call `store.dispatch`.',
      ngrxModule: 'effects',
    },
    schema: [],
    messages: {
      [noDispatchInEffects]:
        'Calling `store.dispatch` in `Effect` is forbidden.',
      [noDispatchInEffectsSuggest]: 'Remove `store.dispatch`.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const { identifiers = [] } = getNgRxStores(context);
    const storeNames = identifiers.length > 0 ? asPattern(identifiers) : null;
    // The local name Store is imported as, for functional effects.
    const { importSpecifier } =
      getImportDeclarationSpecifier(
        getImportDeclarations(
          context.sourceCode.ast,
          NGRX_MODULE_PATHS.store
        ) ?? [],
        'Store'
      ) ?? {};
    const storeImportName = importSpecifier?.local.name;

    const reported = new WeakSet<TSESTree.Node>();
    function report(node: MemberExpressionWithinCallExpression) {
      if (reported.has(node)) {
        return;
      }
      reported.add(node);
      const nodeToReport = getNodeToReport(node);
      context.report({
        node: nodeToReport,
        messageId: noDispatchInEffects,
        suggest: [
          {
            messageId: noDispatchInEffectsSuggest,
            fix: (fixer) => fixer.remove(nodeToReport),
          },
        ],
      });
    }

    // A variable is a store when it is typed `Store` or set to
    // `inject(Store)`: a functional effect's parameter default
    // (`store = inject(Store)`) or a `const` in its body.
    function isStoreVariable(identifier: TSESTree.Identifier): boolean {
      return isVariableOfClass(context.sourceCode, identifier, storeImportName);
    }

    return {
      ...(storeNames && { [dispatchInEffects(storeNames)]: report }),
      ...(storeImportName && {
        [`${createEffectExpression} CallExpression[callee.property.name='dispatch'] > MemberExpression.callee[object.type='Identifier']`](
          node: MemberExpressionWithinCallExpression
        ) {
          if (isStoreVariable(node.object as TSESTree.Identifier)) {
            report(node);
          }
        },
      }),
    };
  },
});

function getNodeToReport(node: MemberExpressionWithinCallExpression) {
  const { parent } = node;
  const { parent: grandParent } = parent;
  return grandParent &&
    (isArrowFunctionExpression(grandParent) || isReturnStatement(grandParent))
    ? node
    : parent;
}
