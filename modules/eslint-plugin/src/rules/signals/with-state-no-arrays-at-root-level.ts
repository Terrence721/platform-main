import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import ts from 'typescript';
import { createRule } from '../../rule-creator';
import { isArrayExpression } from '../../utils';

export const messageId = 'withStateNoArraysAtRootLevel';

type MessageIds = typeof messageId;
type Options = readonly [];

const NON_RECORD_TYPES = [
  'Array',
  'Set',
  'Map',
  'WeakSet',
  'WeakMap',
  'Date',
  'Error',
  'RegExp',
  'ArrayBuffer',
  'DataView',
  'Promise',
  'Function',
];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description: `withState should accept a record or dictionary as an input argument.`,
      ngrxModule: 'signals',
      requiresTypeChecking: true,
    },
    schema: [],
    messages: {
      [messageId]:
        'The property type `{{ property }}` is forbidden as the initial state argument, wrap the property in a record or dictionary.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // `withState`, and the local names it is imported as (it may be aliased),
    // plus namespace imports of @ngrx/signals.
    const withStateNames = new Set<string>(['withState']);
    const namespaceNames = new Set<string>();

    function isWithState(callee: TSESTree.Expression): boolean {
      if (callee.type === AST_NODE_TYPES.Identifier) {
        return withStateNames.has(callee.name);
      }
      return (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        !callee.computed &&
        callee.object.type === AST_NODE_TYPES.Identifier &&
        namespaceNames.has(callee.object.name) &&
        callee.property.type === AST_NODE_TYPES.Identifier &&
        callee.property.name === 'withState'
      );
    }

    return {
      [`ImportDeclaration[source.value='@ngrx/signals'] ImportSpecifier[imported.name='withState']`](
        node: TSESTree.ImportSpecifier
      ) {
        withStateNames.add(node.local.name);
      },
      [`ImportDeclaration[source.value='@ngrx/signals'] ImportNamespaceSpecifier`](
        node: TSESTree.ImportNamespaceSpecifier
      ) {
        namespaceNames.add(node.local.name);
      },
      CallExpression(node: TSESTree.CallExpression) {
        if (!isWithState(node.callee)) {
          return;
        }
        const [argument] = node.arguments;
        if (isArrayExpression(argument)) {
          context.report({
            node: argument,
            messageId,
            data: { property: 'Array' },
          });
        } else if (argument) {
          const services = ESLintUtils.getParserServices(context);
          const typeChecker = services.program.getTypeChecker();

          // withState also takes a factory: check what it returns.
          let type = services.getTypeAtLocation(argument);
          const callSignatures = type.getCallSignatures();
          if (callSignatures.length > 0) {
            type = typeChecker.getReturnTypeOfSignature(callSignatures[0]);
          }

          // The name of the non-record kind a type is, if any.
          const nonRecordName = (t: ts.Type): string | null => {
            if (typeChecker.isArrayType(t) || typeChecker.isTupleType(t)) {
              return 'Array';
            }
            const symbol = t.getSymbol();
            if (symbol && NON_RECORD_TYPES.includes(symbol.getName())) {
              return symbol.getName();
            }
            if (t.getCallSignatures().length > 0) {
              return 'Function';
            }
            const typeString = typeChecker.typeToString(t);
            if (typeString === 'void') {
              return 'Function';
            }
            return (
              NON_RECORD_TYPES.find((name) =>
                typeString.startsWith(`${name}<`)
              ) ?? null
            );
          };

          // A union (e.g. `Book[] | null`) counts when any member other than
          // null or undefined is not a record.
          const members = type.isUnion()
            ? type.types.filter(
                (member) =>
                  !(member.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))
              )
            : [type];
          for (const member of members) {
            const property = nonRecordName(member);
            if (property) {
              context.report({
                node: argument,
                messageId,
                data: { property },
              });
              return;
            }
          }
        }
      },
    };
  },
});
