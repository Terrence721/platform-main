import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import ts from 'typescript';

const isNodeOfType =
  <NodeType extends AST_NODE_TYPES>(nodeType: NodeType) =>
  (node: TSESTree.Node): node is TSESTree.Node & { type: NodeType } =>
    node.type === nodeType;

export const isArrowFunctionExpression = isNodeOfType(
  AST_NODE_TYPES.ArrowFunctionExpression
);
export const isReturnStatement = isNodeOfType(AST_NODE_TYPES.ReturnStatement);
export const isMethodDefinition = isNodeOfType(AST_NODE_TYPES.MethodDefinition);
export const isCallExpression = isNodeOfType(AST_NODE_TYPES.CallExpression);
export const isPropertyDefinition = isNodeOfType(
  AST_NODE_TYPES.PropertyDefinition
);
export const isFunctionExpression = isNodeOfType(
  AST_NODE_TYPES.FunctionExpression
);
export const isFunctionDeclaration = isNodeOfType(
  AST_NODE_TYPES.FunctionDeclaration
);
export const isIdentifier = isNodeOfType(AST_NODE_TYPES.Identifier);
export const isImportDeclaration = isNodeOfType(
  AST_NODE_TYPES.ImportDeclaration
);
export const isImportDefaultSpecifier = isNodeOfType(
  AST_NODE_TYPES.ImportDefaultSpecifier
);
export const isImportNamespaceSpecifier = isNodeOfType(
  AST_NODE_TYPES.ImportNamespaceSpecifier
);
export const isImportSpecifier = isNodeOfType(AST_NODE_TYPES.ImportSpecifier);
export const isLiteral = isNodeOfType(AST_NODE_TYPES.Literal);
export const isTemplateElement = isNodeOfType(AST_NODE_TYPES.TemplateElement);
export const isTemplateLiteral = isNodeOfType(AST_NODE_TYPES.TemplateLiteral);
export const isMemberExpression = isNodeOfType(AST_NODE_TYPES.MemberExpression);
export const isProgram = isNodeOfType(AST_NODE_TYPES.Program);
export const isTSParameterProperty = isNodeOfType(
  AST_NODE_TYPES.TSParameterProperty
);
export const isTSTypeAnnotation = isNodeOfType(AST_NODE_TYPES.TSTypeAnnotation);
export const isTSTypeReference = isNodeOfType(AST_NODE_TYPES.TSTypeReference);
export const isTSInstantiationExpression = isNodeOfType(
  AST_NODE_TYPES.TSInstantiationExpression
);
export const isProperty = isNodeOfType(AST_NODE_TYPES.Property);
export const isArrayExpression = isNodeOfType(AST_NODE_TYPES.ArrayExpression);
export const isBlockStatement = isNodeOfType(AST_NODE_TYPES.BlockStatement);
export function isIdentifierOrMemberExpression(
  node: TSESTree.Node
): node is TSESTree.Identifier | TSESTree.MemberExpression {
  return isIdentifier(node) || isMemberExpression(node);
}

// A generic class, interface or tuple instance (`Observable<Action>`), whose
// type arguments `getTypeArguments` reads. An own `target` is not enough: an
// instantiated type alias or mapped type has one too.
export function isTypeReference(type: ts.Type): type is ts.TypeReference {
  return (
    (type.flags & ts.TypeFlags.Object) !== 0 &&
    ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) !== 0
  );
}
