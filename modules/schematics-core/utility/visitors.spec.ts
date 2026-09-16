import * as ts from 'typescript';
import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import {
  visitDecorator,
  visitComponents,
  visitNgModules,
  visitNgModuleImports,
  visitNgModuleExports,
  visitImportDeclaration,
  visitImportSpecifier,
  visitTypeReference,
  visitTypeLiteral,
  visitCallExpression,
  visitTemplates,
  visitTSSourceFiles,
} from './visitors';

function parse(source: string) {
  return ts.createSourceFile(
    'test.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

describe('visitors', () => {
  describe('visitDecorator / visitComponents / visitNgModules', () => {
    it('matches a real decorated class declaration', () => {
      const source = parse(`
        @Component({ selector: 'app-foo' })
        export class FooComponent {}
      `);

      let matched: ts.ClassDeclaration | undefined;
      visitComponents(source, (node) => {
        matched = node;
      });

      expect(matched?.name?.text).toBe('FooComponent');
    });

    it('does not match an undecorated class', () => {
      const source = parse(`export class FooComponent {}`);

      let calls = 0;
      visitComponents(source, () => calls++);

      expect(calls).toBe(0);
    });

    it('does not match a class decorated with an unrelated decorator', () => {
      const source = parse(`
        @Injectable()
        export class FooService {}
      `);

      let calls = 0;
      visitComponents(source, () => calls++);

      expect(calls).toBe(0);
    });

    it('matches an @NgModule-decorated class via visitNgModules, not visitComponents', () => {
      const source = parse(`
        @NgModule({ declarations: [] })
        export class FooModule {}
      `);

      let componentCalls = 0;
      visitComponents(source, () => componentCalls++);
      let moduleMatched: ts.ClassDeclaration | undefined;
      visitNgModules(source, (node) => {
        moduleMatched = node;
      });

      expect(componentCalls).toBe(0);
      expect(moduleMatched?.name?.text).toBe('FooModule');
    });

    it('regression: does not match a decorated class EXPRESSION as if it were a class declaration', () => {
      // Real, constructible shape (valid TC39 decorator syntax on a class
      // expression) that previously slipped through visitDecorator's
      // findClassDeclaration: the recursive call for a non-class-declaration
      // node fell through into the match-check below it instead of
      // returning, so a decorated ClassExpression (which does not have a
      // `.name`, unlike ClassDeclaration) could be handed to the callback
      // typed as a ts.ClassDeclaration.
      const source = parse(`
        const Foo = @Component({ selector: 'wrong-node-kind' }) class {
          bar = 1;
        };
      `);

      let calls = 0;
      visitDecorator(source, 'Component', () => calls++);

      expect(calls).toBe(0);
    });
  });

  describe('visitNgModuleImports / visitNgModuleExports', () => {
    it('finds the imports array elements of an @NgModule class', () => {
      const source = parse(`
        @NgModule({ imports: [CommonModule, FooModule] })
        export class BarModule {}
      `);

      let elements: readonly ts.Expression[] | undefined;
      visitNgModuleImports(source, (_, elementExpressions) => {
        elements = elementExpressions;
      });

      expect(elements?.map((e) => e.getText())).toEqual([
        'CommonModule',
        'FooModule',
      ]);
    });

    it('finds the exports array elements of an @NgModule class', () => {
      const source = parse(`
        @NgModule({ exports: [FooComponent] })
        export class BarModule {}
      `);

      let elements: readonly ts.Expression[] | undefined;
      visitNgModuleExports(source, (_, elementExpressions) => {
        elements = elementExpressions;
      });

      expect(elements?.map((e) => e.getText())).toEqual(['FooComponent']);
    });
  });

  describe('visitImportDeclaration', () => {
    it('finds import declarations and strips quotes from the module specifier', () => {
      const source = parse(`import { Foo } from '@ngrx/store';`);

      const moduleNames: (string | undefined)[] = [];
      visitImportDeclaration(source, (_, moduleName) => {
        moduleNames.push(moduleName);
      });

      expect(moduleNames).toEqual(['@ngrx/store']);
    });
  });

  describe('visitImportSpecifier', () => {
    it('finds each named import specifier', () => {
      const source = parse(`import { Foo, Bar } from '@ngrx/store';`);
      const importDeclaration = source.statements[0] as ts.ImportDeclaration;

      const names: string[] = [];
      visitImportSpecifier(importDeclaration, (specifier) => {
        names.push(specifier.name.text);
      });

      expect(names).toEqual(['Foo', 'Bar']);
    });
  });

  describe('visitTypeReference / visitTypeLiteral / visitCallExpression', () => {
    it('finds nested type references, not just a top-level one', () => {
      const source = parse(`type X = Foo<Bar<Baz>>;`);

      const names: string[] = [];
      visitTypeReference(source, (ref) => {
        if (ts.isIdentifier(ref.typeName)) {
          names.push(ref.typeName.text);
        }
      });

      expect(names).toEqual(['Foo', 'Bar', 'Baz']);
    });

    it('finds a type literal', () => {
      const source = parse(`type X = { foo: string };`);

      let calls = 0;
      visitTypeLiteral(source, () => calls++);

      expect(calls).toBe(1);
    });

    it('finds nested call expressions', () => {
      const source = parse(`foo(bar(1));`);

      const calls: string[] = [];
      visitCallExpression(source, (callExpression) => {
        if (ts.isIdentifier(callExpression.expression)) {
          calls.push(callExpression.expression.text);
        }
      });

      expect(calls).toEqual(['foo', 'bar']);
    });
  });

  describe('visitTemplates', () => {
    it('finds an inline template', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create(
        '/foo.component.ts',
        `
          @Component({ template: '<p>hi</p>' })
          export class FooComponent {}
        `
      );

      const templates: { content: string; inline: boolean }[] = [];
      visitTemplates(tree, (template) => {
        templates.push({
          content: template.content,
          inline: template.inline,
        });
      });

      expect(templates).toEqual([{ content: '<p>hi</p>', inline: true }]);
    });

    it('resolves and reads an external templateUrl relative to the component file', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create(
        '/foo/foo.component.ts',
        `
          @Component({ templateUrl: './foo.component.html' })
          export class FooComponent {}
        `
      );
      tree.create('/foo/foo.component.html', '<p>hi</p>');

      const templates: { content: string; inline: boolean }[] = [];
      visitTemplates(tree, (template) => {
        templates.push({
          content: template.content,
          inline: template.inline,
        });
      });

      expect(templates).toEqual([{ content: '<p>hi</p>', inline: false }]);
    });

    it('skips a templateUrl that does not resolve to a real file', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create(
        '/foo/foo.component.ts',
        `
          @Component({ templateUrl: './missing.html' })
          export class FooComponent {}
        `
      );

      let calls = 0;
      visitTemplates(tree, () => calls++);

      expect(calls).toBe(0);
    });
  });

  describe('visitTSSourceFiles', () => {
    it('visits .ts files but skips .d.ts and node_modules', () => {
      const tree = new UnitTestTree(Tree.empty());
      tree.create('/foo.ts', 'export const foo = 1;');
      tree.create('/foo.d.ts', 'export declare const foo: number;');
      tree.create('/node_modules/bar/index.ts', 'export const bar = 1;');

      const visited: string[] = [];
      visitTSSourceFiles(tree, (sourceFile) => {
        visited.push(sourceFile.fileName);
      });

      expect(visited).toEqual(['/foo.ts']);
    });
  });
});
