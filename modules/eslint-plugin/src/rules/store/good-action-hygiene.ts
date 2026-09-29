import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import { actionCreator } from '../../utils';

export const messageId = 'goodActionHygiene';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensures the use of good action hygiene.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]:
        'Action type `{{ actionType }}` does not follow the good action hygiene practice, use "[Source] {{ actionType }}" to define action types.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // "[Source] Event": a non-empty source in brackets at the start, then the
    // event.
    const sourceEventPattern = /^\[[^\]]+\]\s+\S/;

    return {
      [actionCreator]({ arguments: [node] }: TSESTree.CallExpression) {
        // A string in any quotes, or a template literal without expressions
        // (one with expressions is only known at runtime).
        const actionType =
          node?.type === AST_NODE_TYPES.Literal &&
          typeof node.value === 'string'
            ? node.value
            : node?.type === AST_NODE_TYPES.TemplateLiteral &&
                node.expressions.length === 0
              ? node.quasis[0].value.cooked
              : null;

        if (actionType === null || sourceEventPattern.test(actionType)) {
          return;
        }

        context.report({
          node,
          messageId,
          data: {
            actionType,
          },
        });
      },
    };
  },
});
