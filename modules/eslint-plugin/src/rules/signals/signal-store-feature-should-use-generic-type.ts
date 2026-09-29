import {
  AST_NODE_TYPES,
  type TSESLint,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  isArrowFunctionExpression,
  isCallExpression,
  isFunctionDeclaration,
  isIdentifier,
} from '../../utils';

export const messageId = 'signalStoreFeatureShouldUseGenericType';

type MessageIds = typeof messageId;
type Options = readonly [];
type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description: `A custom Signal Store feature that accepts an input should define a generic type.`,
      ngrxModule: 'signals',
    },
    fixable: 'code',
    schema: [],
    messages: {
      [messageId]: `Add an unused generic type to the function creating the signal store feature.`,
    },
  },
  defaultOptions: [],
  create: (context) => {
    const { sourceCode } = context;

    function hasInputAsArgument(node: TSESTree.CallExpression) {
      const [inputArg] = node.arguments;
      return (
        !isCallExpression(inputArg) ||
        (isIdentifier(inputArg.callee) && inputArg.callee.name === 'type')
      );
    }

    // `<_>` goes right before the parameter list, after any `async`,
    // `function` or name; an arrow's single unparenthesized parameter gets
    // parentheses (`x => ...` becomes `<_>(x) => ...`).
    function addGeneric(fixer: TSESLint.RuleFixer, func: FunctionNode) {
      const [firstParam] = func.params;
      if (
        isArrowFunctionExpression(func) &&
        func.params.length === 1 &&
        sourceCode.getTokenBefore(firstParam)?.value !== '('
      ) {
        return fixer.replaceText(
          firstParam,
          `<_>(${sourceCode.getText(firstParam)})`
        );
      }
      const openParen = sourceCode.getFirstToken(func, {
        filter: (token) => token.value === '(',
      });
      return openParen
        ? fixer.insertTextBefore(openParen, '<_>')
        : fixer.insertTextBefore(func, '<_>');
    }

    // The function that creates the feature is the nearest one around the
    // call, whatever its kind; each call is reported once.
    return {
      [`CallExpression[callee.name=signalStoreFeature]`](
        node: TSESTree.CallExpression
      ) {
        if (!hasInputAsArgument(node)) {
          return;
        }
        let func: TSESTree.Node | undefined = node.parent;
        while (
          func &&
          !isArrowFunctionExpression(func) &&
          !isFunctionDeclaration(func) &&
          func.type !== AST_NODE_TYPES.FunctionExpression
        ) {
          func = func.parent;
        }
        if (!func || (func.typeParameters?.params.length ?? 0) > 0) {
          return;
        }
        const featureFunction = func as FunctionNode;
        context.report({
          node: node.callee,
          messageId,
          fix: (fixer) => addGeneric(fixer, featureFunction),
        });
      },
    };
  },
});
