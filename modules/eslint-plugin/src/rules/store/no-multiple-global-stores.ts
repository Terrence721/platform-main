import {
  AST_NODE_TYPES,
  type TSESLint,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  getNgRxStores,
  getNodeToCommaRemoveFix,
  isTSParameterProperty,
} from '../../utils';

export const noMultipleGlobalStores = 'noMultipleGlobalStores';
export const noMultipleGlobalStoresSuggest = 'noMultipleGlobalStoresSuggest';

type MessageIds =
  typeof noMultipleGlobalStores | typeof noMultipleGlobalStoresSuggest;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: 'There should only be one global store injected.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [noMultipleGlobalStores]: 'Global store should be injected only once.',
      [noMultipleGlobalStoresSuggest]: 'Remove this reference.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    return {
      Program() {
        const { identifiers = [], sourceCode } = getNgRxStores(context);
        const flattenedIdentifiers = groupBy(identifiers).values();

        for (const identifiers of flattenedIdentifiers) {
          if (identifiers.length <= 1) {
            continue;
          }

          for (const node of identifiers) {
            const nodeToReport = getNodeToReport(node);
            context.report({
              node: nodeToReport,
              messageId: noMultipleGlobalStores,
              suggest: [
                {
                  messageId: noMultipleGlobalStoresSuggest,
                  fix: (fixer) => getFixes(sourceCode, fixer, nodeToReport),
                },
              ],
            });
          }
        }
      },
    };
  },
});

// A constructor parameter property (`private store: Store`) or an injected
// property (`store = inject(Store)`) is reported, and removed, as a whole.
function getNodeToReport(node: TSESTree.Node) {
  const { parent } = node;
  return parent &&
    (isTSParameterProperty(parent) ||
      parent.type === AST_NODE_TYPES.PropertyDefinition)
    ? parent
    : node;
}

function getFixes(
  sourceCode: Readonly<TSESLint.SourceCode>,
  fixer: TSESLint.RuleFixer,
  node: TSESTree.Node
) {
  return getNodeToCommaRemoveFix(sourceCode, fixer, node);
}

type Identifiers = NonNullable<ReturnType<typeof getNgRxStores>['identifiers']>;

// Stores in a class are grouped by the class, so injected properties and
// constructor parameters count together; others by their parent as before.
function getGroup(identifier: Identifiers[number]): TSESTree.Node {
  for (
    let node: TSESTree.Node | undefined = identifier.parent;
    node;
    node = node.parent
  ) {
    if (node.type === AST_NODE_TYPES.ClassBody) {
      return node;
    }
  }
  return isTSParameterProperty(identifier.parent)
    ? identifier.parent.parent
    : identifier.parent;
}

function groupBy(identifiers: Identifiers): Map<TSESTree.Node, Identifiers> {
  return identifiers.reduce<Map<TSESTree.Node, Identifiers>>(
    (accumulator, identifier) => {
      const parent = getGroup(identifier);
      const collectedIdentifiers = accumulator.get(parent);
      return accumulator.set(parent, [
        ...(collectedIdentifiers ?? []),
        identifier,
      ]);
    },
    new Map()
  );
}
