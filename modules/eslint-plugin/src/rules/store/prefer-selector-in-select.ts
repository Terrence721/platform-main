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
  isArrowFunctionExpression,
  isFunctionExpression,
  isLiteral,
  pipeableSelect,
  selectExpression,
} from '../../utils';

export const messageId = 'preferSelectorInSelect';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Using a selector in the `select` is preferred over `string` or `props drilling`.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]:
        'Using `string` or `props drilling` is forbidden. Use a selector instead.',
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

    // The leading strings (template literals too) and inline functions a
    // select is given. A select matched by both paths is checked once.
    const checked = new WeakSet<TSESTree.CallExpression>();
    function checkSelect(node: TSESTree.CallExpression) {
      if (checked.has(node)) {
        return;
      }
      checked.add(node);
      for (const argument of node.arguments) {
        if (
          !isLiteral(argument) &&
          argument.type !== AST_NODE_TYPES.TemplateLiteral &&
          !isArrowFunctionExpression(argument) &&
          !isFunctionExpression(argument)
        ) {
          break;
        }

        context.report({
          node: argument,
          messageId,
        });
      }
    }

    return {
      ...(storeNames && {
        [`${pipeableSelect(storeNames)}, ${selectExpression(storeNames)}`]:
          checkSelect,
      }),
      // A store held in a variable: `store.select(...)`, or the `select(...)`
      // operators of `store.pipe(...)`.
      ...(storeImportName && {
        [`CallExpression[callee.property.name=/^(select|pipe)$/][callee.object.type='Identifier']`](
          node: TSESTree.CallExpression
        ) {
          const callee = node.callee as TSESTree.MemberExpression;
          if (!isStoreVariable(callee.object as TSESTree.Identifier)) {
            return;
          }
          if ((callee.property as TSESTree.Identifier).name === 'select') {
            checkSelect(node);
            return;
          }
          for (const operator of node.arguments) {
            if (
              operator.type === AST_NODE_TYPES.CallExpression &&
              operator.callee.type === AST_NODE_TYPES.Identifier &&
              operator.callee.name === 'select'
            ) {
              checkSelect(operator);
            }
          }
        },
      }),
    };
  },
});
