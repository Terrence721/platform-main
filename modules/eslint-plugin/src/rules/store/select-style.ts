import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESLint,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  getImportAddFix,
  getImportDeclarations,
  getImportDeclarationSpecifier,
  getImportRemoveFix,
  getNgRxStores,
  NGRX_MODULE_PATHS,
} from '../../utils';

export const selectMethod = 'selectMethod';
export const selectOperator = 'selectOperator';

export const enum SelectStyle {
  Method = 'method',
  Operator = 'operator',
}

type MessageIds = `${SelectStyle}`;
type Options = readonly [MessageIds];
type MemberExpressionWithProperty = Omit<
  TSESTree.MemberExpression,
  'property'
> & {
  property: TSESTree.Identifier;
};
type CallExpression = TSESTree.CallExpression & {
  callee: MemberExpressionWithProperty;
};

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Selector can be used either with `select` as a pipeable operator or as a method.',
      ngrxModule: 'store',
    },
    fixable: 'code',
    schema: [
      {
        type: 'string',
        enum: [SelectStyle.Method, SelectStyle.Operator],
      },
    ],
    messages: {
      [SelectStyle.Method]:
        'Selector should be used with select method: `this.store.select(selector)`.',
      [SelectStyle.Operator]:
        'Selector should be used with the pipeable operator: `this.store.pipe(select(selector))`.',
    },
  },
  defaultOptions: [SelectStyle.Method],
  create: (context, [mode]) => {
    const { identifiers = [], sourceCode } = getNgRxStores(context);
    const storeNames = new Set(identifiers.map(({ name }) => name));
    const storeImports =
      getImportDeclarations(sourceCode.ast, NGRX_MODULE_PATHS.store) ?? [];
    const storeImportName = getImportDeclarationSpecifier(storeImports, 'Store')
      ?.importSpecifier.local.name;

    if (!storeImportName) {
      return {};
    }

    // A variable is a store when it is typed `Store` (a constructor or
    // function parameter too) or set to `inject(Store)`.
    function isStoreVariable(identifier: TSESTree.Identifier): boolean {
      const variable = ASTUtils.findVariable(
        sourceCode.getScope(identifier),
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

    // `this.store` (a class's injected store) or a store held in a variable.
    function isStore(node: TSESTree.Node): boolean {
      if (node.type === AST_NODE_TYPES.Identifier) {
        return isStoreVariable(node);
      }
      return (
        node.type === AST_NODE_TYPES.MemberExpression &&
        node.object.type === AST_NODE_TYPES.ThisExpression &&
        !node.computed &&
        node.property.type === AST_NODE_TYPES.Identifier &&
        storeNames.has(node.property.name)
      );
    }

    const selectImport = getImportDeclarationSpecifier(storeImports, 'select');

    if (mode === SelectStyle.Operator) {
      // The operator's local name: the existing import (an alias too), or
      // `select`, added to the imports, when nothing else takes that name.
      const operatorName = selectImport?.importSpecifier.local.name ?? 'select';
      return {
        [`CallExpression[callee.type='MemberExpression'][callee.computed=false][callee.property.name='select']`](
          node: CallExpression
        ) {
          if (!isStore(node.callee.object)) {
            return;
          }
          const nameTaken =
            !selectImport &&
            !!ASTUtils.findVariable(sourceCode.getScope(node), 'select');
          context.report({
            node: node.callee.property,
            messageId: SelectStyle.Operator,
            // The method's type parameter isn't the operator's.
            ...(!node.typeArguments &&
              !nameTaken && {
                fix: (fixer) => [
                  fixer.replaceText(
                    node.callee.property,
                    `pipe(${operatorName}`
                  ),
                  fixer.insertTextAfter(node, ')'),
                  ...[
                    getImportAddFix({
                      fixer,
                      importName: 'select',
                      moduleName: NGRX_MODULE_PATHS.store,
                      node,
                    }),
                  ].flat(),
                ],
              }),
          });
        },
      };
    }

    if (!selectImport) {
      return {};
    }

    return {
      Program() {
        const { importDeclaration, importSpecifier } = selectImport;
        const [{ references }] =
          sourceCode.getDeclaredVariables(importSpecifier);
        // Only a store's first operator is the same as the method:
        // `store.pipe(filter(f), select(s))` filters before it selects.
        const firstOperators = references.map(({ identifier }) => {
          const call = identifier.parent;
          const pipe = call?.parent;
          return call?.type === AST_NODE_TYPES.CallExpression &&
            call.callee === identifier &&
            pipe?.type === AST_NODE_TYPES.CallExpression &&
            pipe.arguments[0] === call &&
            pipe.callee.type === AST_NODE_TYPES.MemberExpression &&
            !pipe.callee.computed &&
            pipe.callee.property.type === AST_NODE_TYPES.Identifier &&
            pipe.callee.property.name === 'pipe' &&
            isStore(pipe.callee.object)
            ? { identifier, call, pipe: pipe as CallExpression }
            : null;
        });

        for (const operator of firstOperators) {
          if (!operator) {
            continue;
          }
          const { identifier, call, pipe } = operator;
          context.report({
            node: identifier,
            messageId: SelectStyle.Method,
            ...(!call.typeArguments && {
              fix: (fixer) =>
                getOperatorToMethodFixes(
                  identifier,
                  call,
                  pipe,
                  sourceCode,
                  fixer
                ),
            }),
          });
        }

        // The import goes once every use of it is a store's select.
        if (
          firstOperators.length > 0 &&
          firstOperators.every(
            (operator) => operator && !operator.call.typeArguments
          )
        ) {
          context.report({
            node: importSpecifier,
            messageId: SelectStyle.Method,
            fix: (fixer) =>
              getImportRemoveFix(
                sourceCode,
                [importDeclaration],
                'select',
                fixer
              ),
          });
        }
      },
    };
  },
});

// `store.pipe(select(s))` to `store.select(s)`, and
// `store.pipe(select(s), map(m))` to `store.select(s).pipe(map(m))`.
function getOperatorToMethodFixes(
  identifier: TSESTree.Identifier,
  call: TSESTree.CallExpression,
  pipe: TSESTree.CallExpression & { callee: TSESTree.MemberExpression },
  sourceCode: Readonly<TSESLint.SourceCode>,
  fixer: TSESLint.RuleFixer
): readonly TSESLint.RuleFix[] {
  // The method in place of the operator (which may be an alias), with the
  // arguments as written.
  const method = `select${sourceCode.text.slice(
    identifier.range[1],
    call.range[1]
  )}`;
  const [, nextOperator] = pipe.arguments;

  if (!nextOperator) {
    // The whole `pipe(...)`, a trailing comma included.
    return [
      fixer.replaceTextRange(
        [pipe.callee.property.range[0], pipe.range[1]],
        method
      ),
    ];
  }
  return [
    fixer.insertTextAfter(pipe.callee.object, `.${method}`),
    fixer.removeRange([call.range[0], nextOperator.range[0]]),
  ];
}
