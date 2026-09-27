import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
  chain,
  externalSchematic,
  apply,
  applyTemplates,
  url,
  move,
  mergeWith,
} from '@angular-devkit/schematics';
import ts from 'typescript';
import {
  stringUtils,
  buildRelativePath,
  insertImport,
  NoopChange,
  ReplaceChange,
  InsertChange,
  getProjectPath,
  omit,
  parseName,
} from '../../../schematics-core';
import { Schema as ContainerOptions } from './schema';

/**
 * The file `@schematics/angular` generated the component into: `foo.ts` by
 * default, or `foo.component.ts` in a workspace that sets the component type.
 */
function getComponentPath(
  host: Tree,
  options: Partial<ContainerOptions>
): string {
  const basePath =
    `/${options.path}/` +
    (options.flat ? '' : stringUtils.dasherize(options.name) + '/') +
    stringUtils.dasherize(options.name);

  const componentPath = `${basePath}.component.ts`;
  if (host.exists(componentPath)) {
    return componentPath;
  }

  if (!host.exists(`${basePath}.ts`)) {
    throw new SchematicsException(`File ${basePath}.ts does not exist.`);
  }
  return `${basePath}.ts`;
}

function readComponent(host: Tree, componentPath: string) {
  const text = host.read(componentPath);
  if (text === null) {
    throw new SchematicsException(
      `File content ${componentPath} does not exist.`
    );
  }

  const source = ts.createSourceFile(
    componentPath,
    text.toString('utf-8'),
    ts.ScriptTarget.Latest,
    true
  );
  const componentClass = source.statements.find(
    (stm) => stm.kind === ts.SyntaxKind.ClassDeclaration
  ) as ts.ClassDeclaration;

  return { source, componentClass };
}

/**
 * `@schematics/angular` writes `standalone: false` for a non-standalone
 * component and leaves the property out for a standalone one.
 */
function isStandalone(componentClass: ts.ClassDeclaration): boolean {
  const decorator = ts
    .getDecorators(componentClass)
    ?.find(
      ({ expression }) =>
        ts.isCallExpression(expression) &&
        expression.expression.getText() === 'Component'
    );
  const [metadata] = decorator
    ? (decorator.expression as ts.CallExpression).arguments
    : [];
  const standalone =
    metadata && ts.isObjectLiteralExpression(metadata)
      ? metadata.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            property.name.getText() === 'standalone'
        )
      : undefined;

  return standalone?.initializer.kind !== ts.SyntaxKind.FalseKeyword;
}

/**
 * The spec has to import the component by the file and class names
 * `@schematics/angular` actually gave it, and to import or declare it
 * depending on whether it is standalone, so it is rendered after the
 * component exists.
 */
function addComponentSpec(options: ContainerOptions): Rule {
  return (host: Tree) => {
    if (options.skipTests) {
      return host;
    }

    const componentPath = getComponentPath(host, options);
    const { componentClass } = readComponent(host, componentPath);
    const componentDirectory = componentPath.slice(
      0,
      componentPath.lastIndexOf('/')
    );

    const templateSource = apply(
      url(options.testDepth === 'unit' ? './files' : './integration-files'),
      [
        applyTemplates({
          ...stringUtils,
          componentFile: componentPath
            .slice(componentDirectory.length + 1)
            .replace(/\.ts$/, ''),
          componentClass: componentClass.name?.text,
          standalone: isStandalone(componentClass),
        }),
        move(componentDirectory),
      ]
    );

    return mergeWith(templateSource);
  };
}

function addStateToComponent(options: Partial<ContainerOptions>) {
  return (host: Tree) => {
    if (!options.state && !options.stateInterface) {
      return host;
    }

    const statePath = `/${options.path}/${options.state}`;

    if (options.state) {
      if (!host.exists(statePath)) {
        throw new Error(`The Specified state path ${statePath} does not exist`);
      }
    }

    const componentPath = getComponentPath(host, options);
    const { source, componentClass } = readComponent(host, componentPath);

    const stateImportPath = buildRelativePath(componentPath, statePath);
    const storeImport = insertImport(
      source,
      componentPath,
      'Store',
      '@ngrx/store'
    );
    const stateImport = options.state
      ? insertImport(
          source,
          componentPath,
          `* as fromStore`,
          stateImportPath,
          true
        )
      : new NoopChange();

    const membersPos = componentClass.members.pos;
    // The class was just generated, so everything between its braces is the
    // empty body. How many line terminators @schematics/angular puts there has
    // changed between versions (`{\n\n}` before 22.2, `{\n}` from 22.2), and
    // each one can be `\r\n` or `\n` depending on how the template got
    // materialized. Replacing the whole body, rather than removing a fixed
    // number of characters from it, always leaves the constructor on its own
    // line with the closing brace on the next one.
    const emptyBody = source
      .getFullText()
      .slice(membersPos, componentClass.end - 1);
    const lineEnding = emptyBody.includes('\r\n') ? '\r\n' : '\n';
    // With a state file, the store is typed by the interface it exports.
    const storeType =
      options.state && options.stateInterface
        ? `Store<fromStore.${options.stateInterface}>`
        : 'Store';
    const constructorUpdate = new ReplaceChange(
      componentPath,
      membersPos,
      emptyBody,
      `\n  constructor(private store: ${storeType}) {}${lineEnding}`
    );

    const changes = [storeImport, stateImport, constructorUpdate];
    const recorder = host.beginUpdate(componentPath);

    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      } else if (change instanceof ReplaceChange) {
        recorder.remove(change.pos, change.oldText.length);
        recorder.insertLeft(change.order, change.newText);
      }
    }

    host.commitUpdate(recorder);

    return host;
  };
}

export default function (options: ContainerOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    options.path = getProjectPath(host, options);

    const parsedPath = parseName(options.path, options.name);
    options.name = parsedPath.name;
    options.path = parsedPath.path;

    const opts = ['state', 'stateInterface', 'testDepth'].reduce(
      (current: Partial<ContainerOptions>, key) => {
        return omit(current, key as any);
      },
      options
    );

    // Remove all undefined values to use the schematic defaults (in angular.json or the Angular schema)
    (Object.keys(opts) as (keyof ContainerOptions)[]).forEach((key) =>
      opts[key] === undefined ? delete opts[key] : {}
    );

    return chain([
      externalSchematic('@schematics/angular', 'component', {
        ...opts,
        skipTests: true,
      }),
      addStateToComponent(options),
      addComponentSpec(options),
    ])(host, context);
  };
}
