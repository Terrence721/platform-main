import ts from 'typescript';
import {
  Rule,
  chain,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';
import {
  visitTSSourceFiles,
  commitChanges,
  InsertChange,
  Change,
  createReplaceChange,
} from '../../../schematics-core';

function migrate() {
  return (tree: Tree, context: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const devtoolsImports = sourceFile.statements
        .filter(ts.isImportDeclaration)
        .filter(
          ({ moduleSpecifier }) =>
            ts.isStringLiteral(moduleSpecifier) &&
            moduleSpecifier.text === '@ngrx/store-devtools'
        );

      if (devtoolsImports.length === 0) {
        return;
      }

      const names = findLocalNames(devtoolsImports);
      const changes: Change[] = [];
      const warn = (message: string) =>
        context.logger.warn(
          `[@ngrx/store-devtools] ${sourceFile.fileName}: ${message}`
        );

      findDevtoolsCalls(sourceFile, names, (call) => {
        const [devtoolsConfig] = call.arguments;
        if (!devtoolsConfig) {
          createDevtoolsConfig(sourceFile, call, changes);
        } else if (ts.isObjectLiteralExpression(devtoolsConfig)) {
          updateConfig(sourceFile, devtoolsConfig, changes, warn);
        } else {
          // A variable or a call: its value cannot be updated here.
          warn(
            `set connectInZone: true in the devtools config passed as '${devtoolsConfig.getText(sourceFile)}' to keep connecting inside the Angular zone`
          );
        }
      });

      commitChanges(tree, sourceFile.fileName, changes);
    });
  };
}

interface LocalNames {
  storeDevtoolsModule: string[];
  provideStoreDevtools: string[];
  namespaces: string[];
}

// The names the file imports them by, so aliases count too.
function findLocalNames(imports: ts.ImportDeclaration[]): LocalNames {
  const names: LocalNames = {
    storeDevtoolsModule: [],
    provideStoreDevtools: [],
    namespaces: [],
  };
  for (const declaration of imports) {
    const bindings = declaration.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      names.namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        if (importedName === 'StoreDevtoolsModule') {
          names.storeDevtoolsModule.push(element.name.text);
        } else if (importedName === 'provideStoreDevtools') {
          names.provideStoreDevtools.push(element.name.text);
        }
      }
    }
  }
  return names;
}

// `StoreDevtoolsModule.instrument(...)` and `provideStoreDevtools(...)`,
// also through their aliases or a namespace import.
function findDevtoolsCalls(
  sourceFile: ts.SourceFile,
  names: LocalNames,
  onCall: (call: ts.CallExpression) => void
) {
  const isName = (
    node: ts.Expression,
    localNames: string[],
    importedName: string
  ) =>
    (ts.isIdentifier(node) && localNames.includes(node.text)) ||
    (ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      names.namespaces.includes(node.expression.text) &&
      node.name.text === importedName);

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        isName(callee, names.provideStoreDevtools, 'provideStoreDevtools') ||
        (ts.isPropertyAccessExpression(callee) &&
          callee.name.text === 'instrument' &&
          isName(
            callee.expression,
            names.storeDevtoolsModule,
            'StoreDevtoolsModule'
          ))
      ) {
        onCall(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}

function updateConfig(
  sourceFile: ts.SourceFile,
  devtoolsConfig: ts.ObjectLiteralExpression,
  changes: Change[],
  warn: (message: string) => void
) {
  const findProperty = (name: string) =>
    devtoolsConfig.properties.find(
      (p) =>
        p.name &&
        (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
        p.name.text === name
    );
  const connectInZone = findProperty('connectInZone');
  const connectOutsideZone = findProperty('connectOutsideZone');

  // Already migrated by hand: adding it again would be a duplicate property.
  if (connectInZone) {
    return;
  }

  if (!connectOutsideZone) {
    if (devtoolsConfig.properties.some(ts.isSpreadAssignment)) {
      warn(
        'the devtools config spreads another object; if that object sets connectOutsideZone, replace it with connectInZone'
      );
    }
    addConnectInZoneProperty(sourceFile, devtoolsConfig, changes);
  } else if (ts.isPropertyAssignment(connectOutsideZone)) {
    changes.push(
      createReplaceChange(
        sourceFile,
        connectOutsideZone.name,
        connectOutsideZone.name.getText(sourceFile),
        'connectInZone'
      ),
      createReplaceChange(
        sourceFile,
        connectOutsideZone.initializer,
        connectOutsideZone.initializer.getText(sourceFile),
        negate(connectOutsideZone.initializer, sourceFile)
      )
    );
  } else if (ts.isShorthandPropertyAssignment(connectOutsideZone)) {
    // `{ connectOutsideZone }` names a variable of the same name.
    changes.push(
      createReplaceChange(
        sourceFile,
        connectOutsideZone,
        connectOutsideZone.getText(sourceFile),
        'connectInZone: !connectOutsideZone'
      )
    );
  } else {
    warn('replace connectOutsideZone with connectInZone');
  }
}

// The opposite of the old value. Anything but a simple operand is wrapped,
// so `a || b` becomes `!(a || b)`, not `!a || b`.
function negate(value: ts.Expression, sourceFile: ts.SourceFile): string {
  const text = value.getText(sourceFile);
  if (value.kind === ts.SyntaxKind.TrueKeyword) {
    return 'false';
  }
  if (value.kind === ts.SyntaxKind.FalseKeyword) {
    return 'true';
  }
  const simple =
    ts.isIdentifier(value) ||
    ts.isPropertyAccessExpression(value) ||
    ts.isElementAccessExpression(value) ||
    ts.isCallExpression(value) ||
    ts.isParenthesizedExpression(value) ||
    ts.isPrefixUnaryExpression(value);
  return simple ? `!${text}` : `!(${text})`;
}

// Added after the last property, on a line of its own when the properties
// are on their own lines, and after a trailing comma and comment.
function addConnectInZoneProperty(
  sourceFile: ts.SourceFile,
  devtoolsConfig: ts.ObjectLiteralExpression,
  changes: Change[]
) {
  const text = sourceFile.getFullText();
  const properties = devtoolsConfig.properties;
  const insert = (pos: number, toAdd: string) =>
    changes.push(new InsertChange(sourceFile.fileName, pos, toAdd));

  if (!properties.length) {
    insert(devtoolsConfig.getEnd() - 1, 'connectInZone: true');
    return;
  }

  const last = properties[properties.length - 1];
  const closeBrace = devtoolsConfig.getEnd() - 1;
  const lineEnd = text.indexOf('\n', last.getEnd());
  const multiline =
    text
      .slice(devtoolsConfig.getStart(sourceFile) + 1, properties[0].getStart())
      .includes('\n') &&
    lineEnd !== -1 &&
    lineEnd < closeBrace;

  if (!multiline) {
    insert(last.getEnd(), ', connectInZone: true');
    return;
  }

  const lineBreak = text[lineEnd - 1] === '\r' ? '\r\n' : '\n';
  const lineStart = text.lastIndexOf('\n', last.getStart(sourceFile)) + 1;
  const indent = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
  const trailingComma = properties.hasTrailingComma;
  if (!trailingComma) {
    insert(last.getEnd(), ',');
  }
  insert(
    lineEnd - (lineBreak.length - 1),
    `${lineBreak}${indent}connectInZone: true${trailingComma ? ',' : ''}`
  );
}

function createDevtoolsConfig(
  sourceFile: ts.SourceFile,
  callExpression: ts.CallExpression,
  changes: Change[]
) {
  changes.push(
    new InsertChange(
      sourceFile.fileName,
      callExpression.getEnd() - 1,
      `{connectInZone: true}`
    )
  );
}

export default function (): Rule {
  return chain([migrate()]);
}
