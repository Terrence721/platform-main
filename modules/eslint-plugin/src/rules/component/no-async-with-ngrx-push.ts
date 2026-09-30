import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  type BindingPipe,
  getTemplateLoc,
  getTemplateText,
  isBindingPipe,
  type TemplateNode,
  unwrapParentheses,
} from '../../utils';

export const messageId = 'noAsyncWithNgrxPush';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description:
        '`async` and `ngrxPush` both subscribe, so chaining them subscribes twice and hands the second pipe a plain value.',
      ngrxModule: 'component',
      template: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      [messageId]:
        'Use one pipe: `async` and `ngrxPush` both subscribe to the observable.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const { sourceCode } = context;

    function report(
      outer: BindingPipe,
      replaced: TemplateNode,
      replacement: string,
      async: BindingPipe
    ) {
      context.report({
        loc: getTemplateLoc(sourceCode, outer),
        messageId,
        // `ngrxPush` is kept: it is the pipe added on purpose, and `async`
        // after it throws on the plain value it receives.
        ...(async.args.length === 0 && {
          fix: (fixer) =>
            fixer.replaceTextRange(
              [replaced.sourceSpan.start, replaced.sourceSpan.end],
              replacement
            ),
        }),
      });
    }

    return {
      // `x$ | async | ngrxPush`: `x$ | async` becomes `x$`, keeping
      // `ngrxPush` and its arguments.
      'BindingPipe[name="ngrxPush"]'(node: never) {
        const push = node as BindingPipe;
        const inner = unwrapParentheses(push.exp);
        if (isBindingPipe(inner, 'async')) {
          report(push, push.exp, getTemplateText(sourceCode, inner.exp), inner);
        }
      },
      // `x$ | ngrxPush | async`: the whole binding becomes `x$ | ngrxPush`.
      'BindingPipe[name="async"]'(node: never) {
        const async = node as BindingPipe;
        const inner = unwrapParentheses(async.exp);
        if (isBindingPipe(inner, 'ngrxPush')) {
          report(async, async, getTemplateText(sourceCode, inner), async);
        }
      },
    };
  },
});
