import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESTree,
} from '@typescript-eslint/utils';
import * as path from 'path';
import ts from 'typescript';
import { createRule } from '../../rule-creator';
import {
  createEffectExpression,
  isCallExpression,
  isIdentifier,
  isTypeReference,
} from '../../utils';

export const messageId = 'avoidCyclicEffects';

type MessageIds = typeof messageId;
type Options = readonly [];

// This rule is a modified version (to support dispatch: false) from the eslint-plugin-rxjs plugin.
// The original implementation can be found at https://github.com/cartant/eslint-plugin-rxjs/blob/main/source/rules/no-cyclic-action.ts
// Thank you Nicholas Jamieson (@cartant).

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description: 'Avoid `Effect` that re-emit filtered actions.',
      ngrxModule: 'effects',
      requiresTypeChecking: true,
    },
    schema: [],
    messages: {
      [messageId]: '`Effect` that re-emit filtered actions are forbidden.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const services = ESLintUtils.getParserServices(context);
    const typeChecker = services.program.getTypeChecker();

    function checkNode(pipeCallExpression: TSESTree.CallExpression) {
      const operatorCallExpression = pipeCallExpression.arguments.find(
        (arg) =>
          isCallExpression(arg) &&
          isIdentifier(arg.callee) &&
          arg.callee.name === 'ofType'
      );
      if (!operatorCallExpression) {
        return;
      }
      const operatorType = services.getTypeAtLocation(operatorCallExpression);
      const [signature] = typeChecker.getSignaturesOfType(
        operatorType,
        ts.SignatureKind.Call
      );

      if (!signature) {
        return;
      }
      const operatorReturnType =
        typeChecker.getReturnTypeOfSignature(signature);
      if (!isTypeReference(operatorReturnType)) {
        return;
      }
      const [operatorElementType] =
        typeChecker.getTypeArguments(operatorReturnType);
      if (!operatorElementType) {
        return;
      }

      const pipeType = services.getTypeAtLocation(pipeCallExpression);
      if (!isTypeReference(pipeType)) {
        return;
      }
      const [pipeElementType] = typeChecker.getTypeArguments(pipeType);
      if (!pipeElementType) {
        return;
      }

      const operatorActionTypes = getActionTypes(operatorElementType);
      const pipeActionTypes = getActionTypes(pipeElementType);

      for (const actionType of operatorActionTypes) {
        if (pipeActionTypes.includes(actionType)) {
          context.report({
            node: pipeCallExpression.callee,
            messageId,
          });
          return;
        }
      }
    }

    function getActionType(symbol: ts.Symbol): ts.Type | null {
      const { valueDeclaration } = symbol;

      if (!valueDeclaration) {
        return null;
      }

      if (valueDeclaration.kind === ts.SyntaxKind.PropertyDeclaration) {
        const { parent } = symbol as typeof symbol & { parent: ts.Symbol };
        return parent.valueDeclaration
          ? typeChecker.getTypeOfSymbolAtLocation(
              parent,
              parent.valueDeclaration
            )
          : null;
      }

      return typeChecker.getTypeOfSymbolAtLocation(symbol, valueDeclaration);
    }

    function getActionTypes(type: ts.Type): string[] {
      if (type.isUnion()) {
        const memberActionTypes: string[] = [];
        for (const memberType of type.types) {
          memberActionTypes.push(...getActionTypes(memberType));
        }
        return memberActionTypes;
      }

      const symbol = typeChecker.getPropertyOfType(type, 'type');

      if (!symbol) {
        return [];
      }

      const actionType = getActionType(symbol);

      if (!actionType) {
        return [];
      }

      // TODO: support "dynamic" types
      // e.g. const genericFoo = createAction(`${subject} FOO`); (resolves to 'string')
      if (typeChecker.typeToString(actionType) === 'string') {
        return [];
      }
      return [typeChecker.typeToString(actionType)];
    }

    // The Actions stream is recognized by its type, so `this.actions$`, a
    // functional effect's `actions$ = inject(Actions)` parameter and any other
    // name all count. The class must come from @ngrx/effects (an `effects`
    // folder: node_modules/@ngrx/effects, or modules/effects in this repo).
    function isActionsStream(node: TSESTree.Node): boolean {
      const symbol = services.getTypeAtLocation(node).getSymbol();
      return (
        symbol?.getName() === 'Actions' &&
        (symbol.declarations ?? []).some((declaration) =>
          /[\\/]effects[\\/]/.test(declaration.getSourceFile().fileName)
        )
      );
    }

    // `createEffect(..., { dispatch: false })`: the effect emits nothing.
    function dispatchesNothing(effect: TSESTree.CallExpression): boolean {
      const config = effect.arguments[1];
      return (
        config?.type === AST_NODE_TYPES.ObjectExpression &&
        config.properties.some(
          (property) =>
            property.type === AST_NODE_TYPES.Property &&
            !property.computed &&
            isIdentifier(property.key) &&
            property.key.name === 'dispatch' &&
            property.value.type === AST_NODE_TYPES.Literal &&
            property.value.value === false
        )
      );
    }

    // Only an effect's outermost Actions pipe is its output; an Actions pipe
    // nested inside it (e.g. in switchMap) is not checked.
    const checkedPipes = new WeakSet<TSESTree.Node>();

    return {
      [`${createEffectExpression} CallExpression[callee.property.name='pipe']`](
        node: TSESTree.CallExpression
      ) {
        if (
          node.callee.type !== AST_NODE_TYPES.MemberExpression ||
          !isActionsStream(node.callee.object)
        ) {
          return;
        }

        let effect: TSESTree.Node | undefined = node.parent;
        while (
          effect &&
          !(
            isCallExpression(effect) &&
            isIdentifier(effect.callee) &&
            effect.callee.name === 'createEffect'
          )
        ) {
          if (checkedPipes.has(effect)) {
            return;
          }
          effect = effect.parent;
        }
        if (!effect || !isCallExpression(effect) || dispatchesNothing(effect)) {
          return;
        }

        checkedPipes.add(node);
        checkNode(node);
      },
    };
  },
});
