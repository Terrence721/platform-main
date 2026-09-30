import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  asPattern,
  dispatchExpression,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxStores,
  isVariableOfClass,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const messageId = 'preferActionCreatorInDispatch';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Using `action creator` in `dispatch` is preferred over `object` or old `Action`.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]:
        'Using `object` or old `Action` is forbidden. Use `action creator` instead.',
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

    // The values the dispatched argument can be: itself, or the branches of a
    // conditional or of `||`/`??`, through a type assertion. An object nested
    // inside the action (a payload) is not the action.
    function findDispatchedValues(node: TSESTree.Node): TSESTree.Node[] {
      switch (node.type) {
        case AST_NODE_TYPES.ConditionalExpression:
          return [
            ...findDispatchedValues(node.consequent),
            ...findDispatchedValues(node.alternate),
          ];
        case AST_NODE_TYPES.LogicalExpression:
          return [
            ...findDispatchedValues(node.left),
            ...findDispatchedValues(node.right),
          ];
        case AST_NODE_TYPES.TSAsExpression:
        case AST_NODE_TYPES.TSSatisfiesExpression:
        case AST_NODE_TYPES.TSNonNullExpression:
          return findDispatchedValues(node.expression);
        default:
          return [node];
      }
    }

    // A constructor's store parameter matches both paths: check a call once.
    const checked = new WeakSet<TSESTree.CallExpression>();
    function checkDispatch(node: TSESTree.CallExpression) {
      if (checked.has(node)) {
        return;
      }
      checked.add(node);
      const [action] = node.arguments;
      if (!action) {
        return;
      }
      for (const value of findDispatchedValues(action)) {
        if (
          value.type === AST_NODE_TYPES.ObjectExpression ||
          value.type === AST_NODE_TYPES.NewExpression
        ) {
          context.report({
            node: value,
            messageId,
          });
        }
      }
    }

    return {
      ...(storeNames && {
        [dispatchExpression(storeNames)]: checkDispatch,
      }),
      ...(storeImportName && {
        [`CallExpression[callee.property.name='dispatch'][callee.object.type='Identifier']`](
          node: TSESTree.CallExpression
        ) {
          const { object } = node.callee as TSESTree.MemberExpression;
          if (isStoreVariable(object as TSESTree.Identifier)) {
            checkDispatch(node);
          }
        },
      }),
    };
  },
});
