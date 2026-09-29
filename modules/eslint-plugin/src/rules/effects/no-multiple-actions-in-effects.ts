import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import ts from 'typescript';
import { createRule } from '../../rule-creator';
import {
  createEffectExpression,
  isBlockStatement,
  isReturnStatement,
  mapLikeOperatorCallExpressions,
} from '../../utils';

export const messageId = 'noMultipleActionsInEffects';

type MessageIds = typeof messageId;
type Options = readonly unknown[];
type EffectsMapLikeOperatorsReturn =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.CallExpression
  | TSESTree.FunctionExpression
  | TSESTree.ReturnStatement;

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description: '`Effect` should not return multiple actions.',
      ngrxModule: 'effects',
      requiresTypeChecking: true,
    },
    schema: [],
    messages: {
      [messageId]: '`Effect` should return a single action.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const services = ESLintUtils.getParserServices(context);
    const typeChecker = services.program.getTypeChecker();

    // An array or tuple whose items can be actions: one with items known not
    // to be actions (no `type` property, e.g. ids to flatten) is not.
    function isActionArray(type: ts.Type): boolean {
      if (!typeChecker.isArrayType(type) && !typeChecker.isTupleType(type)) {
        return false;
      }
      const itemType = typeChecker.getIndexTypeOfType(
        type,
        ts.IndexKind.Number
      );
      if (!itemType) {
        return true;
      }
      const itemTypes = itemType.isUnion() ? itemType.types : [itemType];
      return itemTypes.some(
        (item) =>
          (item.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0 ||
          !!typeChecker.getPropertyOfType(item, 'type')
      );
    }

    return {
      [`${createEffectExpression} ${mapLikeOperatorCallExpressions}`](
        node: EffectsMapLikeOperatorsReturn
      ) {
        for (const nodeToReport of getNodesToReport(node)) {
          const type = services.getTypeAtLocation(nodeToReport);
          const types = type.isUnion() ? type.types : [type];
          if (types.some(isActionArray)) {
            context.report({
              node: nodeToReport,
              messageId,
            });
          }
        }
      },
    };
  },
});

function getNodesToReport(
  node: EffectsMapLikeOperatorsReturn
): TSESTree.Node[] {
  switch (node.type) {
    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.FunctionExpression:
      return isBlockStatement(node.body)
        ? findReturnedValues(node.body)
        : [node.body];
    case AST_NODE_TYPES.CallExpression:
      return node.arguments.slice(0, 1);
    default:
      return node.argument ? [node.argument] : [];
  }
}

// Every value the function returns, in any branch, but not the returns of
// functions nested inside it.
function findReturnedValues(node: TSESTree.Node): TSESTree.Node[] {
  if (isReturnStatement(node)) {
    return node.argument ? [node.argument] : [];
  }
  const values: TSESTree.Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') {
      continue;
    }
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (
        child &&
        typeof child === 'object' &&
        typeof (child as TSESTree.Node).type === 'string' &&
        !isFunctionNode(child as TSESTree.Node)
      ) {
        values.push(...findReturnedValues(child as TSESTree.Node));
      }
    }
  }
  return values;
}

function isFunctionNode(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration
  );
}
