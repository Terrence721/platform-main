import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  asPattern,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxStores,
  isVariableOfClass,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const messageId = 'avoidCombiningSelectors';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer combining selectors at the selector level.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]: 'Combine selectors at the selector level.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const { identifiers = [] } = getNgRxStores(context);
    const storeNames = identifiers.length > 0 ? asPattern(identifiers) : null;
    // The local name Store is imported as, for stores held in variables.
    const { importSpecifier } =
      getImportDeclarationSpecifier(
        getImportDeclarations(
          context.sourceCode.ast,
          NGRX_MODULE_PATHS.store
        ) ?? [],
        'Store'
      ) ?? {};
    const storeImportName = importSpecifier?.local.name;

    // Typed `Store` or set to `inject(Store)`.
    function isStoreVariable(identifier: TSESTree.Identifier): boolean {
      return isVariableOfClass(context.sourceCode, identifier, storeImportName);
    }

    // Inside a constructor, as before: an injected store's name used bare.
    function isInConstructor(node: TSESTree.Node): boolean {
      for (let parent = node.parent; parent; parent = parent.parent) {
        if (
          parent.type === AST_NODE_TYPES.MethodDefinition &&
          parent.kind === 'constructor'
        ) {
          return true;
        }
      }
      return false;
    }

    // `this.<injected store>`, a variable holding a store, or (inside a
    // constructor) an injected store's name.
    function isStore(node: TSESTree.Expression): boolean {
      if (node.type === AST_NODE_TYPES.Identifier) {
        return (
          (!!storeImportName && isStoreVariable(node)) ||
          (!!storeNames && storeNames.test(node.name) && isInConstructor(node))
        );
      }
      return (
        !!storeNames &&
        node.type === AST_NODE_TYPES.MemberExpression &&
        node.object.type === AST_NODE_TYPES.ThisExpression &&
        node.property.type === AST_NODE_TYPES.Identifier &&
        storeNames.test(node.property.name)
      );
    }

    // `store.select(...)`, or `store.pipe(..., select(...), ...)`.
    function isStoreSelect(node: TSESTree.Node | null): boolean {
      if (
        node?.type !== AST_NODE_TYPES.CallExpression ||
        node.callee.type !== AST_NODE_TYPES.MemberExpression ||
        node.callee.property.type !== AST_NODE_TYPES.Identifier ||
        !isStore(node.callee.object)
      ) {
        return false;
      }
      if (node.callee.property.name === 'select') {
        return true;
      }
      return (
        node.callee.property.name === 'pipe' &&
        node.arguments.some(
          (argument) =>
            argument.type === AST_NODE_TYPES.CallExpression &&
            argument.callee.type === AST_NODE_TYPES.Identifier &&
            argument.callee.name === 'select'
        )
      );
    }

    return {
      // The sources are the array's items (`combineLatest([a, b])`), the
      // object's values (`combineLatest({ a, b })`) or the arguments; every
      // store select after the first is reported.
      [`CallExpression[callee.name='combineLatest']`](
        node: TSESTree.CallExpression
      ) {
        const [first] = node.arguments;
        const sources =
          node.arguments.length === 1 &&
          first.type === AST_NODE_TYPES.ArrayExpression
            ? first.elements
            : node.arguments.length === 1 &&
                first.type === AST_NODE_TYPES.ObjectExpression
              ? first.properties.map((property) =>
                  property.type === AST_NODE_TYPES.Property
                    ? property.value
                    : null
                )
              : node.arguments;
        const selects = sources.filter((source) =>
          isStoreSelect(source as TSESTree.Node | null)
        ) as TSESTree.CallExpression[];
        for (const select of selects.slice(1)) {
          context.report({
            node: select,
            messageId,
          });
        }
      },
    };
  },
});
