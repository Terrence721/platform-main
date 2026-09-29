import * as path from 'path';
import { createRule } from '../../rule-creator';
import { TSESTree } from '@typescript-eslint/types';

export const messageId = 'requireSuperOnDestroy';
type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Overridden ngOnDestroy method in component stores require a call to super.ngOnDestroy().',
      ngrxModule: 'component-store',
    },
    schema: [],
    messages: {
      [messageId]:
        "Call super.ngOnDestroy() inside a component store's ngOnDestroy method.",
    },
  },
  defaultOptions: [],
  create: (context) => {
    // A method or an arrow-function property: either replaces the store's own
    // ngOnDestroy. Only the class's own non-static members with a body count.
    const ngOnDestroyMemberSelector = `ClassBody > :matches(MethodDefinition[value.type!='TSEmptyBodyFunctionExpression'], PropertyDefinition)[static=false][computed=false][key.name='ngOnDestroy']`;
    const componentStoreClassName = 'ComponentStore';

    // The local names ComponentStore is imported as (it may be aliased).
    const componentStoreNames = new Set<string>();

    return {
      [`ImportDeclaration[source.value='@ngrx/component-store'] ImportSpecifier[imported.name='${componentStoreClassName}']`](
        node: TSESTree.ImportSpecifier
      ) {
        componentStoreNames.add(node.local.name);
      },
      [`${ngOnDestroyMemberSelector}:not(:has(CallExpression[callee.object.type='Super'][callee.property.name='ngOnDestroy'])) > .key`](
        node: TSESTree.Identifier
      ) {
        const classNode = node.parent.parent?.parent;
        const superClass =
          classNode &&
          (classNode.type === 'ClassDeclaration' ||
            classNode.type === 'ClassExpression')
            ? classNode.superClass
            : null;
        if (
          superClass?.type !== 'Identifier' ||
          !componentStoreNames.has(superClass.name)
        ) {
          return;
        }

        context.report({
          node,
          messageId,
        });
      },
    };
  },
});
