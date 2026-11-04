import type { TSESLint } from '@typescript-eslint/utils';
import {
  getBoundAttribute,
  getEnclosingBoundAttribute,
  getTemplateLoc,
  getTemplateText,
  isBindingPipe,
  isBoundAttribute,
  isLiteralMap,
  unwrapParentheses,
} from '../../src/utils';

describe('template helpers', () => {
  it('unwrapParentheses unwraps successive ParenthesizedExpression nodes', () => {
    const inner = { type: 'Identifier', sourceSpan: { start: 1, end: 2 } };
    const wrapped = {
      type: 'ParenthesizedExpression',
      sourceSpan: { start: 0, end: 4 },
      expression: inner,
    };
    const twice = {
      type: 'ParenthesizedExpression',
      sourceSpan: { start: 0, end: 6 },
      expression: wrapped,
    };

    expect(unwrapParentheses(twice)).toBe(inner);
  });

  it('unwrapParentheses returns the node unchanged when it is not parenthesised', () => {
    const node = { type: 'Identifier', sourceSpan: { start: 1, end: 2 } };

    expect(unwrapParentheses(node)).toBe(node);
  });

  it('isBoundAttribute checks the bound attribute name', () => {
    const node = {
      type: 'BoundAttribute',
      name: 'input',
      sourceSpan: { start: 0, end: 4 },
    };

    expect(isBoundAttribute(node, 'input')).toBe(true);
    expect(isBoundAttribute(node, 'other')).toBe(false);
    expect(isBoundAttribute(undefined, 'input')).toBe(false);
  });

  it('isBindingPipe checks the pipe name', () => {
    const node = {
      type: 'BindingPipe',
      name: 'async',
      exp: { type: 'Identifier', sourceSpan: { start: 0, end: 1 } },
      args: [],
      sourceSpan: { start: 0, end: 5 },
    };

    expect(isBindingPipe(node, 'async')).toBe(true);
    expect(isBindingPipe(node, 'json')).toBe(false);
    expect(isBindingPipe(undefined, 'async')).toBe(false);
  });

  it('isLiteralMap checks the node type', () => {
    const node = {
      type: 'LiteralMap',
      values: [],
      sourceSpan: { start: 0, end: 2 },
    };

    expect(isLiteralMap(node)).toBe(true);
    expect(isLiteralMap(undefined)).toBe(false);
  });

  it('getBoundAttribute reads an ASTWithSource wrapped by a BoundAttribute', () => {
    const attribute = {
      type: 'BoundAttribute',
      name: 'input',
      sourceSpan: { start: 0, end: 10 },
    };
    const withSource = {
      type: 'ASTWithSource',
      sourceSpan: { start: 0, end: 5 },
      parent: attribute,
    };
    const node = {
      type: 'Identifier',
      sourceSpan: { start: 1, end: 2 },
      parent: withSource,
    };

    expect(getBoundAttribute(node)).toBe(attribute);
  });

  it('getBoundAttribute returns undefined for nodes without that shape', () => {
    const node = {
      type: 'Identifier',
      sourceSpan: { start: 1, end: 2 },
    };

    expect(getBoundAttribute(node)).toBeUndefined();
  });

  it('getEnclosingBoundAttribute finds the nearest BoundAttribute', () => {
    const attribute = {
      type: 'BoundAttribute',
      name: 'input',
      sourceSpan: { start: 0, end: 10 },
    };
    const deep = {
      type: 'Identifier',
      sourceSpan: { start: 2, end: 3 },
      parent: {
        type: 'PropertyRead',
        sourceSpan: { start: 1, end: 4 },
        parent: attribute,
      },
    };

    expect(getEnclosingBoundAttribute(deep)).toBe(attribute);
  });

  it('getEnclosingBoundAttribute stops at Element or Template boundaries', () => {
    const attribute = {
      type: 'BoundAttribute',
      name: 'input',
      sourceSpan: { start: 0, end: 10 },
    };
    const deep = {
      type: 'Identifier',
      sourceSpan: { start: 2, end: 3 },
      parent: {
        type: 'Element',
        sourceSpan: { start: 1, end: 4 },
        parent: attribute,
      },
    };

    expect(getEnclosingBoundAttribute(deep)).toBeUndefined();
  });

  it('getTemplateText slices the source text with the node span', () => {
    const sourceCode = {
      text: 'abcde',
      getLocFromIndex: (index: number) => ({
        line: 1,
        column: index,
      }),
    } as unknown as TSESLint.SourceCode;
    const node = { type: 'Identifier', sourceSpan: { start: 1, end: 4 } };

    expect(getTemplateText(sourceCode, node)).toBe('bcd');
  });

  it('getTemplateLoc converts absolute offsets to source locations', () => {
    const sourceCode = {
      text: 'abcde',
      getLocFromIndex: (index: number) => ({
        line: 1,
        column: index,
      }),
    } as unknown as TSESLint.SourceCode;
    const node = { type: 'Identifier', sourceSpan: { start: 1, end: 4 } };

    expect(getTemplateLoc(sourceCode, node)).toEqual({
      start: { line: 1, column: 1 },
      end: { line: 1, column: 4 },
    });
  });
});
