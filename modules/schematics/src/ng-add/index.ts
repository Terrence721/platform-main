import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { getWorkspace, getWorkspacePath } from '../../../schematics-core';

function updateSchematicCollections(host: Tree) {
  const workspace = getWorkspace(host);
  const path = getWorkspacePath(host);

  workspace.cli = workspace.cli || {};
  const collections: string[] = (workspace.cli.schematicCollections =
    workspace.cli.schematicCollections || []);
  // Each collection is added once, so running ng-add again changes nothing.
  const addCollection = (collection: string) => {
    if (!collections.includes(collection)) {
      collections.push(collection);
    }
  };

  if (workspace.cli.defaultCollection) {
    addCollection(workspace.cli.defaultCollection);
    delete workspace.cli.defaultCollection;
  }
  addCollection('@ngrx/schematics');

  host.overwrite(path, JSON.stringify(workspace, null, 2));
}

function updateWorkspaceCli() {
  return (host: Tree) => {
    updateSchematicCollections(host);
    return host;
  };
}

export default function (): Rule {
  return (host: Tree, context: SchematicContext) => {
    return chain([updateWorkspaceCli()])(host, context);
  };
}
