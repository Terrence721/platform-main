import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxStores,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const useConsistentGlobalStoreName = 'useConsistentGlobalStoreName';
export const useConsistentGlobalStoreNameSuggest =
  'useConsistentGlobalStoreNameSuggest';

type MessageIds =
  | typeof useConsistentGlobalStoreName
  | typeof useConsistentGlobalStoreNameSuggest;
type Options = readonly [string];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    hasSuggestions: true,
    docs: {
      description: 'Use a consistent name for the global store.',
      ngrxModule: 'store',
    },
    schema: [
      {
        type: 'string',
      },
    ],
    messages: {
      [useConsistentGlobalStoreName]:
        'Global store should be named as `{{ storeName }}`.',
      [useConsistentGlobalStoreNameSuggest]: 'Rename it to `{{ storeName }}`.',
    },
  },
  defaultOptions: ['store'],
  create: (context, [storeName]) => {
    const { sourceCode } = context;
    const storeImport = getImportDeclarationSpecifier(
      getImportDeclarations(sourceCode.ast, NGRX_MODULE_PATHS.store) ?? [],
      'Store'
    )?.importSpecifier;
    // Every `this.name` read or write, to rename a class's store with.
    const thisMembers: TSESTree.MemberExpression[] = [];

    // Stores typed `Store` (from getNgRxStores), plus variables and parameter
    // defaults set to `inject(Store)`.
    function getStores(): TSESTree.Identifier[] {
      const { identifiers = [] } = getNgRxStores(context);
      const stores = new Set<TSESTree.Identifier>(identifiers);
      const [storeVariable] = storeImport
        ? sourceCode.getDeclaredVariables(storeImport)
        : [];
      for (const { identifier } of storeVariable?.references ?? []) {
        const inject = identifier.parent;
        const holder = inject?.parent;
        if (
          inject?.type !== AST_NODE_TYPES.CallExpression ||
          inject.arguments[0] !== identifier ||
          inject.callee.type !== AST_NODE_TYPES.Identifier ||
          inject.callee.name !== 'inject'
        ) {
          continue;
        }
        if (
          holder?.type === AST_NODE_TYPES.VariableDeclarator &&
          holder.init === inject &&
          holder.id.type === AST_NODE_TYPES.Identifier
        ) {
          stores.add(holder.id);
        } else if (
          holder?.type === AST_NODE_TYPES.AssignmentPattern &&
          holder.right === inject &&
          holder.left.type === AST_NODE_TYPES.Identifier
        ) {
          stores.add(holder.left);
        }
      }
      return [...stores];
    }

    return {
      'MemberExpression[object.type="ThisExpression"][computed=false]'(
        node: TSESTree.MemberExpression
      ) {
        thisMembers.push(node);
      },
      'Program:exit'() {
        // Every store is checked, not only those before the first well-named one.
        for (const store of getStores()) {
          if (store.name === storeName) {
            continue;
          }

          const renames = getRenames(store);
          const data = { storeName };
          context.report({
            loc: {
              start: store.loc.start,
              end: {
                ...store.loc.start,
                column: store.loc.start.column + store.name.length,
              },
            },
            messageId: useConsistentGlobalStoreName,
            data,
            // No suggestion when the new name is already taken.
            suggest: renames
              ? [
                  {
                    messageId: useConsistentGlobalStoreNameSuggest,
                    data,
                    fix: (fixer) =>
                      renames.map((identifier) =>
                        isShorthandValue(identifier)
                          ? fixer.replaceText(
                              identifier,
                              `${identifier.name}: ${storeName}`
                            )
                          : // Only the name: a type annotation stays.
                            fixer.replaceTextRange(
                              [
                                identifier.range[0],
                                identifier.range[0] + identifier.name.length,
                              ],
                              storeName
                            )
                      ),
                  },
                ]
              : [],
          });
        }
      },
    };

    // The declaration and every use of it: `this.name` in its class for a
    // class member (a constructor parameter property is both), the variable's
    // references otherwise. `null` when `storeName` is already in use.
    function getRenames(
      store: TSESTree.Identifier
    ): TSESTree.Identifier[] | null {
      const renames = new Set<TSESTree.Identifier>([store]);
      const { parent } = store;
      const isProperty =
        parent?.type === AST_NODE_TYPES.PropertyDefinition &&
        parent.key === store &&
        !parent.computed;
      const isParameterProperty =
        parent?.type === AST_NODE_TYPES.TSParameterProperty;

      if (isProperty || isParameterProperty) {
        const classBody = getClassBody(store);
        if (!classBody || hasMember(classBody, storeName)) {
          return null;
        }
        for (const member of thisMembers) {
          if (
            member.property.type === AST_NODE_TYPES.Identifier &&
            member.property.name === store.name &&
            getClassBody(member) === classBody
          ) {
            renames.add(member.property);
          }
        }
      }

      if (!isProperty) {
        const variable = ASTUtils.findVariable(
          sourceCode.getScope(store),
          store
        );
        const scopes = [
          sourceCode.getScope(store),
          ...(variable?.references ?? []).map(({ identifier }) =>
            sourceCode.getScope(identifier)
          ),
        ];
        if (scopes.some((scope) => ASTUtils.findVariable(scope, storeName))) {
          return null;
        }
        for (const { identifier } of variable?.references ?? []) {
          renames.add(identifier as TSESTree.Identifier);
        }
      }
      return [...renames];
    }
  },
});

function getClassBody(node: TSESTree.Node): TSESTree.ClassBody | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === AST_NODE_TYPES.ClassBody) {
      return current;
    }
  }
  return undefined;
}

// A property, method, accessor or constructor parameter property by that name.
function hasMember(classBody: TSESTree.ClassBody, name: string): boolean {
  return classBody.body.some((member) => {
    if (
      'key' in member &&
      !member.computed &&
      member.key.type === AST_NODE_TYPES.Identifier &&
      member.key.name === name
    ) {
      return true;
    }
    return (
      member.type === AST_NODE_TYPES.MethodDefinition &&
      member.kind === 'constructor' &&
      member.value.params.some(
        (param) =>
          param.type === AST_NODE_TYPES.TSParameterProperty &&
          ((param.parameter.type === AST_NODE_TYPES.Identifier &&
            param.parameter.name === name) ||
            (param.parameter.type === AST_NODE_TYPES.AssignmentPattern &&
              param.parameter.left.type === AST_NODE_TYPES.Identifier &&
              param.parameter.left.name === name))
      )
    );
  });
}

// `{ store }` in an object or a destructuring keeps its key.
function isShorthandValue(identifier: TSESTree.Identifier): boolean {
  const { parent } = identifier;
  return (
    parent?.type === AST_NODE_TYPES.Property &&
    parent.shorthand &&
    parent.value === identifier
  );
}
