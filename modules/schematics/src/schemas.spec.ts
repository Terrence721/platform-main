import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

// Every generator reads its options through the `Schema` type in schema.ts,
// and the CLI validates them against schema.json: the two must describe the
// same options, or an option the CLI accepts is never read (#162). The
// generators under src/ also have a per-folder schema.spec.ts.
const root = path.join(__dirname, '..');

function schemaFolders(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (
      !entry.isDirectory() ||
      ['node_modules', 'files'].includes(entry.name) ||
      entry.name.startsWith('__')
    ) {
      return [];
    }
    const folder = path.join(dir, entry.name);
    const own = fs.existsSync(path.join(folder, 'schema.json')) ? [folder] : [];
    return [...own, ...schemaFolders(folder)];
  });
}

const folders = [
  ...schemaFolders(path.join(root, 'src')),
  ...schemaFolders(path.join(root, 'ng-add')),
].map((folder) => path.relative(root, folder).split(path.sep).join('/'));

interface JsonSchema {
  properties?: Record<string, { default?: unknown }>;
  required?: string[];
}

function read(folder: string) {
  const json = JSON.parse(
    fs.readFileSync(path.join(root, folder, 'schema.json'), 'utf8')
  ) as JsonSchema;
  const source = ts.createSourceFile(
    'schema.ts',
    fs.readFileSync(path.join(root, folder, 'schema.ts'), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const schema = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === 'Schema'
  );
  // A generator without options declares `type Schema = Record<string, never>`.
  // Typed first, so the filter below narrows to PropertySignature.
  const list: readonly ts.TypeElement[] = schema?.members ?? [];
  const members = list.filter(ts.isPropertySignature);
  return { json, members };
}

const name = (member: ts.PropertySignature) =>
  member.name.getText().replace(/['"]/g, '');

describe('generator schemas', () => {
  it('finds every generator', () => {
    expect(folders.length).toBe(23);
  });

  describe.each(folders)('%s', (folder) => {
    it('declares the options schema.json defines', () => {
      const { json, members } = read(folder);
      expect(members.map(name).sort()).toEqual(
        Object.keys(json.properties ?? {}).sort()
      );
    });

    it('only makes an option non-optional when the CLI always sets it', () => {
      const { json, members } = read(folder);
      const alwaysSet = Object.entries(json.properties ?? {})
        .filter(
          ([option, property]) =>
            (json.required ?? []).includes(option) ||
            property.default !== undefined
        )
        .map(([option]) => option);
      const nonOptional = members
        .filter((member) => !member.questionToken)
        .map(name);
      expect(alwaysSet).toEqual(expect.arrayContaining(nonOptional));
    });
  });
});
