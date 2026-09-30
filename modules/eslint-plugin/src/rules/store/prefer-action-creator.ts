import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';

export const messageId = 'preferActionCreator';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Using `action creator` is preferred over `Action class`.',
      ngrxModule: 'store',
    },
    schema: [],
    messages: {
      [messageId]:
        'Using `Action class` is forbidden. Use `action creator` instead.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // `Action`, and the local names it is imported as from @ngrx/store.
    const actionNames = new Set<string>(['Action']);

    function isAction(implemented: TSESTree.TSClassImplements): boolean {
      const { expression } = implemented;
      return (
        (expression.type === AST_NODE_TYPES.Identifier &&
          actionNames.has(expression.name)) ||
        (expression.type === AST_NODE_TYPES.MemberExpression &&
          expression.property.type === AST_NODE_TYPES.Identifier &&
          expression.property.name === 'Action')
      );
    }

    // The class's own `implements` and members: a class nested inside it is
    // checked on its own, not as part of the outer class.
    function checkClass(
      node: TSESTree.ClassDeclaration | TSESTree.ClassExpression
    ) {
      const hasTypeProperty = node.body.body.some(
        (member) =>
          member.type === AST_NODE_TYPES.PropertyDefinition &&
          !member.static &&
          !member.computed &&
          member.key.type === AST_NODE_TYPES.Identifier &&
          member.key.name === 'type'
      );
      if (node.implements.some(isAction) && hasTypeProperty) {
        context.report({
          node,
          messageId,
        });
      }
    }

    return {
      [`ImportDeclaration[source.value='@ngrx/store'] ImportSpecifier[imported.name='Action']`](
        node: TSESTree.ImportSpecifier
      ) {
        actionNames.add(node.local.name);
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
  },
});
