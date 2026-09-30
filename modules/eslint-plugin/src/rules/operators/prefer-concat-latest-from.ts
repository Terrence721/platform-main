import {
  AST_NODE_TYPES,
  type TSESLint,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  asPattern,
  createEffectExpression,
  getImportAddFix,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getNgRxEffectActions,
  isVariableOfClass,
  namedExpression,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const messageId = 'preferConcatLatestFrom';

type MessageIds = typeof messageId;
type Options = readonly [{ readonly strict: boolean }];
type WithLatestFromIdentifier = TSESTree.Identifier & {
  parent: TSESTree.CallExpression;
};

const defaultOptions: Options[number] = { strict: false };
const concatLatestFromKeyword = 'concatLatestFrom';
const withLatestFromKeyword = 'withLatestFrom';

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description: `Use \`${concatLatestFromKeyword}\` instead of \`${withLatestFromKeyword}\` to prevent the selector from firing until the correct \`Action\` is dispatched.`,
      ngrxModule: 'operators',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          strict: {
            type: 'boolean',
            default: defaultOptions.strict,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      [messageId]: `Use \`${concatLatestFromKeyword}\` instead of \`${withLatestFromKeyword}\`.`,
    },
  },
  defaultOptions: [defaultOptions],
  create: (context, [options]) => {
    // Only a single-source call is fixed. With more arguments it is either
    // several sources (`withLatestFrom(a$, b$)`) or the deprecated projector,
    // whose `(action, latest)` parameters `map` would not receive; both are
    // reported without a fix.
    // A constructor's `actions$: Actions` parameter matches both the class
    // path and the variable path: report each call once.
    const reported = new WeakSet<WithLatestFromIdentifier>();
    function report(node: WithLatestFromIdentifier) {
      if (reported.has(node)) {
        return;
      }
      reported.add(node);
      context.report({
        node,
        messageId,
        ...(node.parent.arguments.length === 1 && {
          fix: (fixer: TSESLint.RuleFixer) => getFixes(fixer, node),
        }),
      });
    }

    const withLatestFromCall = `CallExpression > Identifier.callee[name='${withLatestFromKeyword}']`;

    if (options.strict) {
      return {
        [`${createEffectExpression} ${withLatestFromCall}`]: report,
      };
    }

    const { identifiers = [] } = getNgRxEffectActions(context);
    const actionsNames = identifiers.length > 0 ? asPattern(identifiers) : null;
    // The local name Actions is imported as, for functional effects.
    const { importSpecifier } =
      getImportDeclarationSpecifier(
        getImportDeclarations(
          context.sourceCode.ast,
          NGRX_MODULE_PATHS.effects
        ) ?? [],
        'Actions'
      ) ?? {};
    const actionsImportName = importSpecifier?.local.name;

    // A variable is the actions stream when it is typed `Actions` or set to
    // `inject(Actions)`: a functional effect's parameter default
    // (`actions$ = inject(Actions)`) or a `const` in its body.
    function isActionsVariable(identifier: TSESTree.Identifier): boolean {
      return isVariableOfClass(
        context.sourceCode,
        identifier,
        actionsImportName
      );
    }

    return {
      ...(actionsNames && {
        [`${createEffectExpression} ${namedExpression(
          actionsNames
        )} > ${withLatestFromCall}`]: report,
      }),
      ...(actionsImportName && {
        [`${createEffectExpression} CallExpression[callee.property.name='pipe'][callee.object.type='Identifier'] > ${withLatestFromCall}`](
          node: WithLatestFromIdentifier
        ) {
          const pipe = node.parent.parent as TSESTree.CallExpression;
          const { object } = pipe.callee as TSESTree.MemberExpression;
          if (isActionsVariable(object as TSESTree.Identifier)) {
            report(node);
          }
        },
      }),
    };
  },
});

function getFixes(fixer: TSESLint.RuleFixer, node: WithLatestFromIdentifier) {
  const [firstArgument] = node.parent.arguments;
  return [
    fixer.replaceText(node, concatLatestFromKeyword),
    ...(firstArgument.type == AST_NODE_TYPES.ArrowFunctionExpression
      ? []
      : [fixer.insertTextBefore(firstArgument, '() => ')]),
  ].concat(
    getImportAddFix({
      fixer,
      importName: concatLatestFromKeyword,
      moduleName: NGRX_MODULE_PATHS.operators,
      node,
    })
  );
}
