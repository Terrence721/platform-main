import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  asPattern,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxStores,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const messageId = 'noStoreSubscription';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Using the `async` pipe is preferred over `store` subscription.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]:
        '`Store` subscription is forbidden. Use the `async` pipe instead.',
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

    return {
      // `store.subscribe(...)`, or a subscription at the end of any chain of
      // calls on the store: `store.select(x).pipe(...).subscribe(...)`.
      [`CallExpression > MemberExpression.callee[property.name='subscribe']`](
        node: TSESTree.MemberExpression
      ) {
        let source: TSESTree.Node = node.object;
        while (
          source.type === AST_NODE_TYPES.CallExpression &&
          source.callee.type === AST_NODE_TYPES.MemberExpression
        ) {
          source = source.callee.object;
        }
        if (isStore(source)) {
          context.report({
            node: node.property,
            messageId,
          });
        }
      },
    };
  },
});
