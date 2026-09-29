import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import { actionReducerMap, getRawText } from '../../utils';

export const noReducerInKeyNames = 'noReducerInKeyNames';
export const noReducerInKeyNamesSuggest = 'noReducerInKeyNamesSuggest';

type MessageIds =
  typeof noReducerInKeyNames | typeof noReducerInKeyNamesSuggest;
type Options = readonly [];

const reducerKeyword = 'reducer';

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: `Avoid the word "${reducerKeyword}" in the key names.`,
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [noReducerInKeyNames]: `Avoid the word "${reducerKeyword}" in the key names to better represent the state.`,
      [noReducerInKeyNamesSuggest]: `Remove the word "${reducerKeyword}".`,
    },
  },
  defaultOptions: [],
  create: (context) => {
    function reportKey(node: TSESTree.Property['key']) {
      const keyName = getRawText(node);
      const newKeyName = keyName?.replace(new RegExp(reducerKeyword, 'i'), '');
      // A key that is only the word (`reducer: ...`) has no name left, so
      // there is nothing to suggest.
      const hasNameLeft =
        !!newKeyName && newKeyName.replace(/['"`]/g, '').length > 0;
      context.report({
        node,
        messageId: noReducerInKeyNames,
        suggest: hasNameLeft
          ? [
              {
                messageId: noReducerInKeyNamesSuggest,
                fix: (fixer) => fixer.replaceText(node, newKeyName),
              },
            ]
          : [],
      });
    }

    function checkReducerMap(map: TSESTree.Node | undefined) {
      if (map?.type !== AST_NODE_TYPES.ObjectExpression) {
        return;
      }
      for (const property of map.properties) {
        if (property.type !== AST_NODE_TYPES.Property) {
          continue;
        }
        const keyName = getRawText(property.key);
        if (keyName && /reducer/i.test(keyName)) {
          reportKey(property.key);
        }
      }
    }

    // A feature slice, `{ name, reducer }`, whose `reducer` key is required.
    function isFeatureSlice(node: TSESTree.Node | undefined): boolean {
      if (node?.type !== AST_NODE_TYPES.ObjectExpression) {
        return false;
      }
      const keys = node.properties.map((property) =>
        property.type === AST_NODE_TYPES.Property
          ? getRawText(property.key)?.replace(/['"`]/g, '')
          : undefined
      );
      return keys.includes('name') && keys.includes('reducer');
    }

    // The reducer map is the first argument of `StoreModule.forRoot` and
    // `provideStore`, and the second of `StoreModule.forFeature` and
    // `provideState`; a first-argument map is checked too, as before, unless
    // it is a `{ name, reducer }` feature slice. A config argument's
    // `metaReducers` is not a key name.
    return {
      [`${actionReducerMap}`](node: TSESTree.ObjectExpression) {
        checkReducerMap(node);
      },
      [`CallExpression[callee.object.name='StoreModule'][callee.property.name='forRoot'], CallExpression[callee.name='provideStore']`](
        node: TSESTree.CallExpression
      ) {
        checkReducerMap(node.arguments[0]);
      },
      [`CallExpression[callee.object.name='StoreModule'][callee.property.name='forFeature'], CallExpression[callee.name='provideState']`](
        node: TSESTree.CallExpression
      ) {
        const [first, second] = node.arguments;
        if (!isFeatureSlice(first)) {
          checkReducerMap(first);
        }
        checkReducerMap(second);
      },
    };
  },
});
