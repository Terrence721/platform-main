import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES, ASTUtils } from '@typescript-eslint/utils';
import {
  isCallExpression,
  isIdentifier,
  isIdentifierOrMemberExpression,
  isImportDeclaration,
  isImportDefaultSpecifier,
  isImportNamespaceSpecifier,
  isImportSpecifier,
  isLiteral,
  isMethodDefinition,
  isProgram,
  isProperty,
  isPropertyDefinition,
  isTSTypeAnnotation,
  isTSTypeReference,
  isTemplateElement,
  isTemplateLiteral,
  isTSInstantiationExpression,
} from './guards';
import { NGRX_MODULE_PATHS } from './ngrx-modules';

type ConstructorFunctionExpression = TSESTree.FunctionExpression & {
  parent: TSESTree.MethodDefinition & { kind: 'constructor' };
};
type InjectedParameter = TSESTree.Identifier & {
  typeAnnotation: TSESTree.TSTypeAnnotation;
  parent:
    | ConstructorFunctionExpression
    | (TSESTree.TSParameterProperty & {
        parent: ConstructorFunctionExpression;
      })
    | TSESTree.PropertyDefinition;
};
type InjectedParameterWithSourceCode = Readonly<{
  identifiers?: readonly InjectedParameter[];
  sourceCode: Readonly<TSESLint.SourceCode>;
}>;

export function getImportDeclarationSpecifier(
  importDeclarations: readonly TSESTree.ImportDeclaration[],
  importName: string
) {
  for (const importDeclaration of importDeclarations) {
    const importSpecifier = importDeclaration.specifiers.find(
      (importClause): importClause is TSESTree.ImportSpecifier => {
        return (
          isImportSpecifier(importClause) &&
          isIdentifier(importClause.imported) &&
          importClause.imported.name === importName
        );
      }
    );

    if (importSpecifier) {
      return { importDeclaration, importSpecifier } as const;
    }
  }

  return undefined;
}

export function getImportDeclarations(
  node: TSESTree.Node,
  moduleName: string
): readonly TSESTree.ImportDeclaration[] | undefined {
  let parentNode: TSESTree.Node | undefined = node;

  while (parentNode && !isProgram(parentNode)) {
    parentNode = parentNode.parent;
  }

  return parentNode?.body.filter((node): node is TSESTree.ImportDeclaration => {
    return isImportDeclaration(node) && node.source.value === moduleName;
  });
}

function getCorrespondentImportClause(
  importDeclarations: readonly TSESTree.ImportDeclaration[],
  compatibleWithTypeOnlyImport = false
) {
  let importClause: TSESTree.ImportClause | undefined;

  for (const { importKind, specifiers } of importDeclarations) {
    const lastImportSpecifier = getLast(specifiers);

    if (
      (!compatibleWithTypeOnlyImport && importKind === 'type') ||
      isImportNamespaceSpecifier(lastImportSpecifier)
    ) {
      continue;
    }

    importClause = lastImportSpecifier;
  }

  return importClause;
}

export function getImportAddFix({
  compatibleWithTypeOnlyImport = false,
  fixer,
  importName,
  moduleName,
  node,
}: {
  compatibleWithTypeOnlyImport?: boolean;
  fixer: TSESLint.RuleFixer;
  importName: string;
  moduleName: string;
  node: TSESTree.Node;
}): TSESLint.RuleFix | TSESLint.RuleFix[] {
  // On its own line, ahead of whatever the file starts with.
  const fullImport = `import { ${importName} } from '${moduleName}';\n`;
  const importDeclarations = getImportDeclarations(node, moduleName);

  if (!importDeclarations?.length) {
    return fixer.insertTextAfterRange([0, 0], fullImport);
  }

  const importDeclarationSpecifier = getImportDeclarationSpecifier(
    importDeclarations,
    importName
  );

  if (importDeclarationSpecifier) {
    return [];
  }

  const importClause = getCorrespondentImportClause(
    importDeclarations,
    compatibleWithTypeOnlyImport
  );

  if (!importClause) {
    return fixer.insertTextAfterRange([0, 0], fullImport);
  }

  const replacementText = isImportDefaultSpecifier(importClause)
    ? `, { ${importName} }`
    : `, ${importName}`;
  return fixer.insertTextAfter(importClause, replacementText);
}

export function getImportRemoveFix(
  sourceCode: Readonly<TSESLint.SourceCode>,
  importDeclarations: readonly TSESTree.ImportDeclaration[],
  importedName: string,
  fixer: TSESLint.RuleFixer
): TSESLint.RuleFix | TSESLint.RuleFix[] {
  const { importDeclaration, importSpecifier } =
    getImportDeclarationSpecifier(importDeclarations, importedName) ?? {};

  if (!importDeclaration || !importSpecifier) {
    return [];
  }

  if (importDeclaration.specifiers.length === 1) {
    return fixer.remove(importDeclaration);
  }

  const tokenBeforeImportSpecifier = sourceCode.getTokenBefore(importSpecifier);

  // After another specifier: `, select`.
  if (tokenBeforeImportSpecifier?.value === ',') {
    return fixer.removeRange([
      tokenBeforeImportSpecifier.range[0],
      importSpecifier.range[1],
    ]);
  }

  const tokenAfterImportSpecifier = sourceCode.getTokenAfter(importSpecifier);

  // The first in the braces: `select, `.
  if (tokenAfterImportSpecifier?.value === ',') {
    return fixer.removeRange([
      importSpecifier.range[0],
      tokenAfterImportSpecifier.range[1],
    ]);
  }

  // The only one in the braces after a default import: `, { select }`.
  const commaBeforeBraces =
    tokenBeforeImportSpecifier &&
    sourceCode.getTokenBefore(tokenBeforeImportSpecifier);
  if (
    tokenBeforeImportSpecifier?.value === '{' &&
    commaBeforeBraces?.value === ',' &&
    tokenAfterImportSpecifier?.value === '}'
  ) {
    return fixer.removeRange([
      commaBeforeBraces.range[0],
      tokenAfterImportSpecifier.range[1],
    ]);
  }

  return [];
}

export function getNodeToCommaRemoveFix(
  sourceCode: Readonly<TSESLint.SourceCode>,
  fixer: TSESLint.RuleFixer,
  node: TSESTree.Node
) {
  const nextToken = sourceCode.getTokenAfter(node);
  const isNextTokenComma = nextToken && ASTUtils.isCommaToken(nextToken);
  return [
    fixer.remove(node),
    ...(isNextTokenComma ? [fixer.remove(nextToken)] : []),
  ] as const;
}

export function getInterfaceName(
  interfaceMember: TSESTree.Identifier | TSESTree.MemberExpression
): string | undefined {
  if (isIdentifier(interfaceMember)) {
    return interfaceMember.name;
  }

  return isIdentifier(interfaceMember.property)
    ? interfaceMember.property.name
    : undefined;
}

export function getInterfaces({
  implements: classImplements,
}: TSESTree.ClassDeclaration): readonly (
  TSESTree.Identifier | TSESTree.MemberExpression
)[] {
  return (classImplements ?? [])
    .map(({ expression }) => expression)
    .filter(isIdentifierOrMemberExpression);
}

export function getInterface(
  node: TSESTree.ClassDeclaration,
  interfaceName: string
): TSESTree.Identifier | TSESTree.MemberExpression | undefined {
  return getInterfaces(node).find(
    (interfaceMember) => getInterfaceName(interfaceMember) === interfaceName
  );
}

export function getImplementsSchemaFixer(
  { id, implements: classImplements }: TSESTree.ClassDeclaration,
  interfaceName: string
) {
  const [implementsNodeReplace, implementsTextReplace] =
    classImplements && classImplements.length
      ? [getLast(classImplements), `, ${interfaceName}`]
      : [id as TSESTree.Identifier, ` implements ${interfaceName}`];

  return { implementsNodeReplace, implementsTextReplace } as const;
}

export function getLast<T extends readonly unknown[]>(items: T): T[number] {
  return items.slice(-1)[0];
}

export function getRawText(node: TSESTree.Node): string | null {
  if (isIdentifier(node)) {
    return node.name;
  }

  if (
    isPropertyDefinition(node) ||
    isMethodDefinition(node) ||
    isProperty(node)
  ) {
    return getRawText(node.key);
  }

  if (isLiteral(node)) {
    return node.raw;
  }

  if (isTemplateElement(node)) {
    return `\`${node.value.raw}\``;
  }

  // Only without expressions: `${x}` has no text to read or rename.
  if (isTemplateLiteral(node) && node.expressions.length === 0) {
    return `\`${node.quasis[0].value.raw}\``;
  }

  return null;
}

export function capitalize<T extends string>(text: T): Capitalize<T> {
  return `${text[0].toUpperCase()}${text.slice(1)}` as Capitalize<T>;
}

function getInjectedParametersWithSourceCode(
  context: TSESLint.RuleContext<string, readonly unknown[]>,
  moduleName: string,
  importName: string
): InjectedParameterWithSourceCode {
  const sourceCode = context.sourceCode;
  const importDeclarations =
    getImportDeclarations(sourceCode.ast, moduleName) ?? [];
  const { importSpecifier } =
    getImportDeclarationSpecifier(importDeclarations, importName) ?? {};

  const injectImportDeclarations =
    getImportDeclarations(sourceCode.ast, '@angular/core') ?? [];

  const { importSpecifier: injectImportSpecifier } =
    getImportDeclarationSpecifier(injectImportDeclarations, 'inject') ?? {};

  if (!importSpecifier) {
    return { sourceCode };
  }

  // The import's own variable, under its local name (`Store as AppStore` too).
  const [typedVariable] = sourceCode.getDeclaredVariables(importSpecifier);
  const identifiers = typedVariable?.references?.reduce<
    readonly InjectedParameter[]
  >((identifiers, { identifier: { parent } }) => {
    if (!parent) {
      return identifiers;
    }

    if (
      isTSTypeReference(parent) &&
      parent.parent &&
      isTSTypeAnnotation(parent.parent) &&
      parent.parent.parent &&
      isIdentifier(parent.parent.parent)
    ) {
      return identifiers.concat(parent.parent.parent as InjectedParameter);
    }

    const parentToCheck = isTSInstantiationExpression(parent)
      ? parent.parent
      : parent;

    if (
      parentToCheck &&
      isCallExpression(parentToCheck) &&
      isIdentifier(parentToCheck.callee) &&
      parentToCheck.callee.name === injectImportSpecifier?.local.name &&
      parentToCheck.parent &&
      isPropertyDefinition(parentToCheck.parent) &&
      isIdentifier(parentToCheck.parent.key)
    ) {
      return identifiers.concat(parentToCheck.parent.key as InjectedParameter);
    }

    return identifiers;
  }, []);
  return { identifiers, sourceCode };
}

export function getNgRxEffectActions(
  context: TSESLint.RuleContext<string, readonly unknown[]>
): InjectedParameterWithSourceCode {
  return getInjectedParametersWithSourceCode(
    context,
    NGRX_MODULE_PATHS.effects,
    'Actions'
  );
}

export function getNgRxComponentStores(
  context: TSESLint.RuleContext<string, readonly unknown[]>
): InjectedParameterWithSourceCode {
  return getInjectedParametersWithSourceCode(
    context,
    NGRX_MODULE_PATHS['component-store'],
    'ComponentStore'
  );
}

export function getNgRxStores(
  context: TSESLint.RuleContext<string, readonly unknown[]>
): InjectedParameterWithSourceCode {
  return getInjectedParametersWithSourceCode(
    context,
    NGRX_MODULE_PATHS.store,
    'Store'
  );
}

// Whether a variable holds an instance of `className` (the local name its
// class is imported as, e.g. `Store`): it is typed with it (a parameter
// too) or set to `inject(className)` (a variable or a parameter default).
export function isVariableOfClass(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
  className: string | undefined
): boolean {
  if (!className) {
    return false;
  }
  const variable = ASTUtils.findVariable(
    sourceCode.getScope(identifier),
    identifier
  );
  const name = variable?.defs[0]?.name;
  if (!name || !isIdentifier(name)) {
    return false;
  }
  const annotation = name.typeAnnotation?.typeAnnotation;
  if (
    annotation &&
    isTSTypeReference(annotation) &&
    isIdentifier(annotation.typeName) &&
    annotation.typeName.name === className
  ) {
    return true;
  }
  const { parent } = name;
  const initializer =
    parent?.type === AST_NODE_TYPES.AssignmentPattern && parent.left === name
      ? parent.right
      : parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id === name
        ? parent.init
        : null;
  return (
    !!initializer &&
    isCallExpression(initializer) &&
    isIdentifier(initializer.callee) &&
    initializer.callee.name === 'inject' &&
    !!initializer.arguments[0] &&
    isIdentifier(initializer.arguments[0]) &&
    initializer.arguments[0].name === className
  );
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeText(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function asPattern(identifiers: readonly InjectedParameter[]): RegExp {
  const escapedNames = identifiers.map(({ name }) => escapeText(name));
  return new RegExp(`^(${escapedNames.join('|')})$`);
}

// A class that extends ComponentStore: under any name it is imported as
// (`ComponentStore as Base`), or, without type information, a superclass
// named like a store (a store subclassing another store, e.g. from another
// file).
export function componentStoreClass(
  context: TSESLint.RuleContext<string, readonly unknown[]>
): string {
  const importDeclarations =
    getImportDeclarations(
      context.sourceCode.ast,
      NGRX_MODULE_PATHS['component-store']
    ) ?? [];
  const localNames = importDeclarations
    .flatMap(({ specifiers }) => specifiers)
    .filter(
      (specifier): specifier is TSESTree.ImportSpecifier =>
        isImportSpecifier(specifier) &&
        isIdentifier(specifier.imported) &&
        specifier.imported.name === 'ComponentStore'
    )
    .map(({ local }) => escapeText(local.name));
  const superClassName =
    localNames.length > 0 ? `/Store|^(${localNames.join('|')})$/` : '/Store/';
  return `ClassDeclaration[superClass.name=${superClassName}]`;
}

export function getNgrxComponentStoreNames(
  context: TSESLint.RuleContext<string, readonly unknown[]>
): RegExp | null {
  const { identifiers = [] } = getNgRxComponentStores(context);
  return identifiers.length > 0 ? asPattern(identifiers) : null;
}
