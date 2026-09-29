import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import { isCallExpression, isIdentifier } from '../../utils';

export const enforceTypeCall = 'enforceTypeCall';

type MessageIds = typeof enforceTypeCall;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description: 'The `type` function must be called.',
      ngrxModule: 'signals',
    },
    fixable: 'code',
    schema: [],
    messages: {
      [enforceTypeCall]: 'The `{{name}}` function must be called.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // It's possible that we have multiple type import aliases, so we need to track them all.
    const typeNames = new Set<string>();
    // `import * as signals from '@ngrx/signals'` makes `signals.type` the function.
    const namespaceNames = new Set<string>();

    function isTypeFunction(expression: TSESTree.Expression): boolean {
      if (isIdentifier(expression)) {
        return typeNames.has(expression.name);
      }
      return (
        expression.type === AST_NODE_TYPES.MemberExpression &&
        !expression.computed &&
        isIdentifier(expression.object) &&
        namespaceNames.has(expression.object.name) &&
        isIdentifier(expression.property) &&
        expression.property.name === 'type'
      );
    }

    return {
      [`ImportDeclaration[source.value='@ngrx/signals'] ImportSpecifier[imported.name='type']`](
        node: TSESTree.ImportSpecifier
      ) {
        typeNames.add(node.local.name);
      },
      [`ImportDeclaration[source.value='@ngrx/signals'] ImportNamespaceSpecifier`](
        node: TSESTree.ImportNamespaceSpecifier
      ) {
        namespaceNames.add(node.local.name);
      },

      TSInstantiationExpression(node: TSESTree.TSInstantiationExpression) {
        const expression = node.expression;
        // Called only when it is the callee: as an argument (`feature(type<T>)`)
        // its parent is a call too, but it is not called.
        const isCalled =
          isCallExpression(node.parent) && node.parent.callee === node;
        if (isTypeFunction(expression) && !isCalled) {
          context.report({
            node: expression,
            messageId: enforceTypeCall,
            data: { name: context.sourceCode.getText(expression) },
            fix: (fixer) => fixer.insertTextAfter(node, '()'),
          });
        }
      },
    };
  },
});
