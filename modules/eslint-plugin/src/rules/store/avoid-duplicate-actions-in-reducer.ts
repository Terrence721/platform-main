import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import { createReducer, getNodeToCommaRemoveFix } from '../../utils';

export const avoidDuplicateActionsInReducer = 'avoidDuplicateActionsInReducer';
export const avoidDuplicateActionsInReducerSuggest =
  'avoidDuplicateActionsInReducerSuggest';

type MessageIds =
  | typeof avoidDuplicateActionsInReducer
  | typeof avoidDuplicateActionsInReducerSuggest;
type Options = readonly [];
type Action = (TSESTree.Identifier | TSESTree.MemberExpression) & {
  parent: TSESTree.CallExpression;
};

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: 'A `Reducer` should handle an `Action` once.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [avoidDuplicateActionsInReducer]:
        'The `Reducer` handles a duplicate `Action` `{{ actionName }}`.',
      [avoidDuplicateActionsInReducerSuggest]: 'Remove this duplication.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const collectedActions = new Map<string, Action[]>();

    // An action creator by name: `load` or `BooksActions.load`.
    function isActionReference(node: TSESTree.Node): boolean {
      return (
        node.type === AST_NODE_TYPES.Identifier ||
        (node.type === AST_NODE_TYPES.MemberExpression &&
          !node.computed &&
          isActionReference(node.object))
      );
    }

    return {
      // `on(a, b, reducer)`: every argument but the last (the reducer) is an
      // action it handles.
      [`${createReducer} > CallExpression[callee.name='on']`](
        node: TSESTree.CallExpression
      ) {
        for (const action of node.arguments.slice(0, -1)) {
          if (!isActionReference(action)) {
            continue;
          }
          const actionName = context.sourceCode
            .getText(action)
            .replace(/\s/g, '');
          const actions = collectedActions.get(actionName) ?? [];
          collectedActions.set(actionName, [...actions, action as Action]);
        }
      },
      [`${createReducer}:exit`]() {
        for (const [actionName, actions] of collectedActions) {
          if (actions.length <= 1) {
            continue;
          }

          for (const node of actions) {
            // Remove just this action when the `on` handles others too,
            // otherwise the whole `on(...)`.
            const handlesOtherActions = node.parent.arguments.length > 2;
            context.report({
              node,
              messageId: avoidDuplicateActionsInReducer,
              data: {
                actionName,
              },
              suggest: [
                {
                  messageId: avoidDuplicateActionsInReducerSuggest,
                  fix: (fixer) =>
                    getNodeToCommaRemoveFix(
                      context.sourceCode,
                      fixer,
                      handlesOtherActions ? node : node.parent
                    ),
                },
              ],
            });
          }
        }

        collectedActions.clear();
      },
    };
  },
});
