import ts from 'typescript';
import { isTypeReference } from '../../src/utils';

// The types of the variables declared in `code`, by name.
function getTypes(
  code: string
): Map<string, { type: ts.Type; checker: ts.TypeChecker }> {
  const host = ts.createCompilerHost({});
  const getSourceFile = host.getSourceFile;
  host.getSourceFile = (fileName, languageVersion) =>
    fileName === 'types.ts'
      ? ts.createSourceFile(fileName, code, languageVersion)
      : getSourceFile(fileName, languageVersion);
  const program = ts.createProgram(['types.ts'], { noLib: true }, host);
  const checker = program.getTypeChecker();
  const types = new Map<string, { type: ts.Type; checker: ts.TypeChecker }>();
  program.getSourceFile('types.ts')?.forEachChild((statement) => {
    if (ts.isVariableStatement(statement)) {
      const [{ name }] = statement.declarationList.declarations;
      types.set(name.getText(), {
        type: checker.getTypeAtLocation(name),
        checker,
      });
    }
  });
  return types;
}

describe('isTypeReference', () => {
  const types = getTypes(`
    interface Observable<T> { value: T }
    type Box<T> = { value: T };
    type Mapped<T> = { [K in keyof T]: T[K] };
    declare const observable: Observable<boolean>;
    declare const tuple: [number, string];
    declare const box: Box<number>;
    declare const mapped: Mapped<{ a: 1 }>;
    declare const plain: { a: 1 };
    declare const union: Observable<1> | Observable<2>;
  `);
  function getType(name: string) {
    const entry = types.get(name);
    if (!entry) {
      throw new Error(`No variable named ${name}`);
    }
    return entry;
  }

  it.each(['observable', 'tuple'])(
    'is true for %s, a generic instance',
    (name) => {
      const { type, checker } = getType(name);

      expect(isTypeReference(type)).toBe(true);
      if (isTypeReference(type)) {
        expect(checker.getTypeArguments(type).length).toBeGreaterThan(0);
      }
    }
  );

  // An instantiated type alias and a mapped type have an own `target` too.
  it.each(['box', 'mapped', 'plain', 'union'])('is false for %s', (name) => {
    expect(isTypeReference(getType(name).type)).toBe(false);
  });
});
