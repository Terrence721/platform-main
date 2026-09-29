import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  asPattern,
  dispatchExpression,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxStores,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const messageId = 'avoidDispatchingMultipleActionsSequentially';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'It is recommended to only dispatch one `Action` at a time.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]:
        'Avoid dispatching many actions in a row to accomplish a larger conceptual "transaction".',
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
      const variable = ASTUtils.findVariable(
        context.sourceCode.getScope(identifier),
        identifier
      );
      const name = variable?.defs[0]?.name;
      if (!name || name.type !== AST_NODE_TYPES.Identifier) {
        return false;
      }
      const annotation = name.typeAnnotation?.typeAnnotation;
      if (
        annotation?.type === AST_NODE_TYPES.TSTypeReference &&
        annotation.typeName.type === AST_NODE_TYPES.Identifier &&
        annotation.typeName.name === storeImportName
      ) {
        return true;
      }
      const { parent } = name;
      const initializer =
        parent?.type === AST_NODE_TYPES.AssignmentPattern &&
        parent.left === name
          ? parent.right
          : parent?.type === AST_NODE_TYPES.VariableDeclarator &&
              parent.id === name
            ? parent.init
            : null;
      return (
        initializer?.type === AST_NODE_TYPES.CallExpression &&
        initializer.callee.type === AST_NODE_TYPES.Identifier &&
        initializer.callee.name === 'inject' &&
        initializer.arguments[0]?.type === AST_NODE_TYPES.Identifier &&
        initializer.arguments[0].name === storeImportName
      );
    }

    // Each block's own dispatch statements: a nested block ending does not
    // drop the dispatches of the block around it.
    const dispatchesByBlock = new Map<
      TSESTree.Node,
      Set<TSESTree.CallExpression>
    >();
    function collect(node: TSESTree.CallExpression) {
      const block = node.parent?.parent;
      if (!block) {
        return;
      }
      const dispatches = dispatchesByBlock.get(block) ?? new Set();
      dispatches.add(node);
      dispatchesByBlock.set(block, dispatches);
    }

    return {
      ...(storeNames && {
        [`BlockStatement > ExpressionStatement > ${dispatchExpression(
          storeNames
        )}`]: collect,
      }),
      ...(storeImportName && {
        [`BlockStatement > ExpressionStatement > CallExpression[callee.property.name='dispatch'][callee.object.type='Identifier']`](
          node: TSESTree.CallExpression
        ) {
          const { object } = node.callee as TSESTree.MemberExpression;
          if (isStoreVariable(object as TSESTree.Identifier)) {
            collect(node);
          }
        },
      }),
      'BlockStatement:exit'(block: TSESTree.BlockStatement) {
        const dispatches = dispatchesByBlock.get(block);
        dispatchesByBlock.delete(block);
        if (dispatches && dispatches.size > 1) {
          for (const node of dispatches) {
            context.report({
              node,
              messageId,
            });
          }
        }
      },
    };
  },
});
