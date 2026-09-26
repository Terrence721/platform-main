import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// `Schema` is the type `index.ts` reads the options through, `schema.json` is
// what the options are validated against; the two must describe the same
// options, with the same ones required.
describe('Component Store Schema', () => {
  const read = (file: string) =>
    fs.readFileSync(path.join(__dirname, file), 'utf8');

  const members = () => {
    const sourceFile = ts.createSourceFile(
      'schema.ts',
      read('schema.ts'),
      ts.ScriptTarget.Latest,
      true
    );
    const schema = sourceFile.statements.find(
      (statement): statement is ts.InterfaceDeclaration =>
        ts.isInterfaceDeclaration(statement) && statement.name.text === 'Schema'
    );

    const list: readonly ts.TypeElement[] = schema?.members ?? [];

    return list.filter(ts.isPropertySignature);
  };

  const json = JSON.parse(read('schema.json')) as {
    properties: Record<string, unknown>;
    required: string[];
  };

  const names = (list: ts.PropertySignature[]) =>
    list.map((member) => member.name.getText()).sort();

  it('should declare the options that schema.json defines', () => {
    expect(names(members())).toEqual(Object.keys(json.properties).sort());
  });

  it('should only make the options schema.json requires non-optional', () => {
    expect(names(members().filter((member) => !member.questionToken))).toEqual(
      [...json.required].sort()
    );
  });
});
