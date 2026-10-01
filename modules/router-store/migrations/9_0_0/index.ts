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
  insertImport,
  Change,
  containsProperty,
} from '../../../schematics-core';

const MODULE_NAME = 'StoreRouterConnectingModule';
const SERIALIZER_NAME = 'DefaultRouterStateSerializer';

function addDefaultSerializer(): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    visitTSSourceFiles(tree, (sourceFile) => {
      const names = findLocalNames(sourceFile);
      const changes: Change[] = [];
      let needsSerializerImport = false;

      // Every StoreRouterConnectingModule.forRoot(...) call: NgModule or
      // Component imports, TestBed, a shared constant, ...
      const visit = (node: ts.Node) => {
        const target = ts.isCallExpression(node)
          ? forRootTarget(node, names)
          : undefined;
        if (target) {
          const call = node as ts.CallExpression;
          const serializer = serializerName(target, names);
          const property = `serializer: ${serializer}`;
          const [config] = call.arguments;

          if (config === undefined) {
            // StoreRouterConnectingModule.forRoot()
            changes.push(
              new InsertChange(
                sourceFile.fileName,
                call.getEnd() - 1,
                `{ ${property} }`
              )
            );
            needsSerializerImport ||= serializer === SERIALIZER_NAME;
          } else if (ts.isObjectLiteralExpression(config)) {
            // StoreRouterConnectingModule.forRoot({ key: 'router' })
            if (
              !containsProperty(config, 'serializer') &&
              !containsProperty(config, 'routerState')
            ) {
              changes.push(
                new InsertChange(
                  sourceFile.fileName,
                  config.getStart() + 1,
                  ` ${property},`
                )
              );
              needsSerializerImport ||= serializer === SERIALIZER_NAME;
            }
          } else {
            // A variable or call: its value cannot be updated here.
            ctx.logger.warn(
              `[@ngrx/router-store] ${sourceFile.fileName}: set serializer: ${SERIALIZER_NAME} in the config passed as '${config.getText(sourceFile)}' to keep the v8 router state`
            );
          }
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(sourceFile, visit);

      if (needsSerializerImport && !names.serializer) {
        changes.push(
          insertImport(
            sourceFile,
            sourceFile.fileName,
            SERIALIZER_NAME,
            '@ngrx/router-store'
          )
        );
      }

      commitChanges(tree, sourceFile.fileName, changes);

      if (changes.length) {
        ctx.logger.info(
          `[@ngrx/router-store] Updated StoreRouterConnectingModule's configuration, see the migration guide (https://ngrx.io/guide/migration/v9#ngrxrouter-store) for more info`
        );
      }
    });
  };
}

interface LocalNames {
  module: string[];
  // The name DefaultRouterStateSerializer is already imported under.
  serializer?: string;
  namespaces: string[];
}

// The names imported from '@ngrx/router-store', so aliases and namespace
// imports count too; the bare module name when the file does not import it.
function findLocalNames(sourceFile: ts.SourceFile): LocalNames {
  const names: LocalNames = { module: [], namespaces: [] };
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@ngrx/router-store'
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) {
      names.namespaces.push(bindings.name.text);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        if (importedName === MODULE_NAME) {
          names.module.push(element.name.text);
        } else if (importedName === SERIALIZER_NAME) {
          names.serializer = element.name.text;
        }
      }
    }
  }
  if (!names.module.length && !names.namespaces.length) {
    names.module.push(MODULE_NAME);
  }
  return names;
}

// The expression `forRoot` is called on, when it is the router-store module
// (`StoreRouterConnectingModule`, an alias, or `ns.StoreRouterConnectingModule`).
function forRootTarget(
  call: ts.CallExpression,
  names: LocalNames
): ts.Expression | undefined {
  const callee = call.expression;
  if (
    !ts.isPropertyAccessExpression(callee) ||
    callee.name.text !== 'forRoot'
  ) {
    return undefined;
  }
  const target = callee.expression;
  const isModule =
    (ts.isIdentifier(target) && names.module.includes(target.text)) ||
    (ts.isPropertyAccessExpression(target) &&
      ts.isIdentifier(target.expression) &&
      names.namespaces.includes(target.expression.text) &&
      target.name.text === MODULE_NAME);
  return isModule ? target : undefined;
}

// `ns.DefaultRouterStateSerializer` through a namespace, an existing import's
// local name, or the bare name (then imported).
function serializerName(target: ts.Expression, names: LocalNames): string {
  if (ts.isPropertyAccessExpression(target)) {
    return `${target.expression.getText()}.${SERIALIZER_NAME}`;
  }
  return names.serializer ?? SERIALIZER_NAME;
}

export default function (): Rule {
  return chain([addDefaultSerializer()]);
}
