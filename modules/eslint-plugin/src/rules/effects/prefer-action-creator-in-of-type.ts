import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';

export const messageId = 'preferActionCreatorInOfType';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Using `action creator` in `ofType` is preferred over `string`.',
      ngrxModule: 'effects',
    },
    schema: [],
    messages: {
      [messageId]: 'Using `string` is forbidden. Use `action creator` instead.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // The strings an argument can evaluate to: the argument itself, or a
    // branch of a conditional or of `||`/`??`. A literal used as an index, a
    // key or a call argument is not an action type.
    function findStrings(
      node: TSESTree.Node
    ): (TSESTree.Literal | TSESTree.TemplateLiteral)[] {
      switch (node.type) {
        case AST_NODE_TYPES.Literal:
          return typeof node.value === 'string' ? [node] : [];
        case AST_NODE_TYPES.TemplateLiteral:
          return [node];
        case AST_NODE_TYPES.ConditionalExpression:
          return [
            ...findStrings(node.consequent),
            ...findStrings(node.alternate),
          ];
        case AST_NODE_TYPES.LogicalExpression:
          return [...findStrings(node.left), ...findStrings(node.right)];
        default:
          return [];
      }
    }

    return {
      [`CallExpression[callee.name='ofType']`](node: TSESTree.CallExpression) {
        for (const argument of node.arguments) {
          for (const literal of findStrings(argument)) {
            context.report({
              node: literal,
              messageId,
            });
          }
        }
      },
    };
  },
});
