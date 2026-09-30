import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  asPattern,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxStores,
  isCallExpression,
  isIdentifier,
  isVariableOfClass,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const messageId = 'avoidMappingSelectors';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Avoid mapping logic outside the selector level.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]: 'Map logic at the selector level instead.',
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

    // A variable is a store when it is typed `Store` or set to
    // `inject(Store)` (a parameter default or a variable).
    function isStoreVariable(identifier: TSESTree.Identifier): boolean {
      return isVariableOfClass(context.sourceCode, identifier, storeImportName);
    }

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
    // constructor, as before) an injected store's name.
    function isStore(node: TSESTree.Node): boolean {
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

    function isCallTo(node: TSESTree.Node, name: string): boolean {
      return (
        isCallExpression(node) &&
        isIdentifier(node.callee) &&
        node.callee.name === name
      );
    }

    // Whether the node uses `this`: arrow functions share it, other
    // functions have their own.
    function usesThis(node: TSESTree.Node): boolean {
      if (node.type === AST_NODE_TYPES.ThisExpression) {
        return true;
      }
      if (
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.FunctionDeclaration
      ) {
        return false;
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'parent') {
          continue;
        }
        for (const child of Array.isArray(value) ? value : [value]) {
          if (
            child &&
            typeof child === 'object' &&
            typeof (child as TSESTree.Node).type === 'string' &&
            usesThis(child as TSESTree.Node)
          ) {
            return true;
          }
        }
      }
      return false;
    }

    function isInCreateEffect(node: TSESTree.CallExpression) {
      let parent: TSESTree.Node | undefined = node.parent;
      while (parent) {
        if (
          isCallExpression(parent) &&
          isIdentifier(parent.callee) &&
          parent.callee.name === 'createEffect'
        ) {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      // `store.select(x).pipe(..., map(...))`, or
      // `store.pipe(..., select(x), ..., map(...))`. A `map` whose callback
      // uses `this` (component state) is not reported; other operators using
      // `this` (e.g. `takeUntil(this.destroy$)`) do not matter.
      [`CallExpression[callee.property.name='pipe']`](
        node: TSESTree.CallExpression
      ) {
        const { object } = node.callee as TSESTree.MemberExpression;
        const operators = node.arguments;
        let firstCandidate: number;
        if (
          isCallExpression(object) &&
          object.callee.type === AST_NODE_TYPES.MemberExpression &&
          object.callee.property.type === AST_NODE_TYPES.Identifier &&
          object.callee.property.name === 'select' &&
          isStore(object.callee.object)
        ) {
          firstCandidate = 0;
        } else if (isStore(object)) {
          const selectIndex = operators.findIndex((operator) =>
            isCallTo(operator, 'select')
          );
          if (selectIndex < 0) {
            return;
          }
          firstCandidate = selectIndex + 1;
        } else {
          return;
        }

        if (isInCreateEffect(node)) {
          return;
        }

        const mapOperator = operators
          .slice(firstCandidate)
          .find((operator) => isCallTo(operator, 'map'));
        if (mapOperator && !usesThis(mapOperator)) {
          context.report({
            node: mapOperator,
            messageId,
          });
        }
      },
    };
  },
});
