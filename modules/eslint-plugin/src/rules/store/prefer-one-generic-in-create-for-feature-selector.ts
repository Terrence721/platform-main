import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';

export const preferOneGenericInCreateForFeatureSelector =
  'preferOneGenericInCreateForFeatureSelector';
export const preferOneGenericInCreateForFeatureSelectorSuggest =
  'preferOneGenericInCreateForFeatureSelectorSuggest';

type MessageIds =
  | typeof preferOneGenericInCreateForFeatureSelector
  | typeof preferOneGenericInCreateForFeatureSelectorSuggest;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: 'Prefer using a single generic to define the feature state.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [preferOneGenericInCreateForFeatureSelector]:
        'Use a single generic to define the feature state.',
      [preferOneGenericInCreateForFeatureSelectorSuggest]:
        'Remove the global state generic.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // Namespace imports of @ngrx/store: `ngrx.createFeatureSelector<...>()`.
    const namespaceNames = new Set<string>();

    return {
      [`ImportDeclaration[source.value='@ngrx/store'] ImportNamespaceSpecifier`](
        node: TSESTree.ImportNamespaceSpecifier
      ) {
        namespaceNames.add(node.local.name);
      },
      [`CallExpression:matches([callee.name='createFeatureSelector'], [callee.property.name='createFeatureSelector']) > TSTypeParameterInstantiation[params.length>1]`](
        node: TSESTree.TSTypeParameterInstantiation
      ) {
        const { callee } = node.parent as TSESTree.CallExpression;
        if (
          callee.type === AST_NODE_TYPES.MemberExpression &&
          !(
            callee.object.type === AST_NODE_TYPES.Identifier &&
            namespaceNames.has(callee.object.name)
          )
        ) {
          return;
        }
        context.report({
          node,
          messageId: preferOneGenericInCreateForFeatureSelector,
          suggest: [
            {
              messageId: preferOneGenericInCreateForFeatureSelectorSuggest,
              fix: (fixer) => {
                const [globalState] = node.params;
                const nextToken = context.sourceCode.getTokenAfter(globalState);
                return fixer.removeRange([
                  globalState.range[0],
                  nextToken?.range[1] ?? globalState.range[1] + 1,
                ]);
              },
            },
          ],
        });
      },
    };
  },
});
