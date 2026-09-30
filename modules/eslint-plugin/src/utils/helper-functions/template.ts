import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

// The parts of `@angular-eslint/template-parser`'s AST the template rules
// read. Its expression nodes carry absolute offsets in `sourceSpan` rather
// than `range`/`loc`, and a `parent` link.
export interface TemplateSpan {
  start: number;
  end: number;
}

export interface TemplateNode {
  type: string;
  sourceSpan: TemplateSpan;
  parent?: TemplateNode;
}

export interface BindingPipe extends TemplateNode {
  type: 'BindingPipe';
  name: string;
  exp: TemplateNode;
  args: TemplateNode[];
}

export interface BoundAttribute extends TemplateNode {
  type: 'BoundAttribute';
  name: string;
}

export interface LiteralMap extends TemplateNode {
  type: 'LiteralMap';
  values: TemplateNode[];
}

export function isBoundAttribute(
  node: TemplateNode | undefined,
  name: string
): node is BoundAttribute {
  return (
    node?.type === 'BoundAttribute' && (node as BoundAttribute).name === name
  );
}

export function isLiteralMap(
  node: TemplateNode | undefined
): node is LiteralMap {
  return node?.type === 'LiteralMap';
}

// The binding a pipe belongs to (`[input]="..."` or `*directive="..."`):
// its expression is wrapped in an `ASTWithSource` under the attribute.
export function getBoundAttribute(
  node: TemplateNode
): BoundAttribute | undefined {
  const withSource = node.parent;
  const attribute = withSource?.parent;
  return withSource?.type === 'ASTWithSource' &&
    attribute?.type === 'BoundAttribute'
    ? (attribute as BoundAttribute)
    : undefined;
}

export function getTemplateText(
  sourceCode: Readonly<TSESLint.SourceCode>,
  { sourceSpan }: TemplateNode
): string {
  return sourceCode.text.slice(sourceSpan.start, sourceSpan.end);
}

// The parser's own `convertNodeSourceSpanToLoc` does not take an expression
// node's absolute span, so the location is computed from the offsets.
export function getTemplateLoc(
  sourceCode: Readonly<TSESLint.SourceCode>,
  { sourceSpan }: TemplateNode
): TSESTree.SourceLocation {
  return {
    start: sourceCode.getLocFromIndex(sourceSpan.start),
    end: sourceCode.getLocFromIndex(sourceSpan.end),
  };
}
