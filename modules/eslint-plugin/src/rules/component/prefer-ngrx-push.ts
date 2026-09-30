import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  type BindingPipe,
  getEnclosingBoundAttribute,
  getTemplateLoc,
  isBindingPipe,
  unwrapParentheses,
} from '../../utils';

export const messageId = 'preferNgrxPush';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer the `ngrxPush` pipe to `async`. A style choice, not a fix: `async` also works in zoneless apps, so this rule is in no config.',
      ngrxModule: 'component',
      template: true,
      optIn: true,
    },
    schema: [],
    messages: {
      [messageId]: 'Use the `ngrxPush` pipe instead of `async`.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    // Chained with `ngrxPush`, or in an `ngrxLet` binding, the `async` pipe
    // is already reported (with a fix) by `no-async-with-ngrx-push` or
    // `no-async-pipe-in-ngrx-let`: neither pipe belongs there.
    function isReportedElsewhere(pipe: BindingPipe): boolean {
      const { parent } = pipe;
      const outer =
        parent?.type === 'ParenthesizedExpression' ? parent.parent : parent;
      return (
        isBindingPipe(outer, 'ngrxPush') ||
        isBindingPipe(unwrapParentheses(pipe.exp), 'ngrxPush') ||
        getEnclosingBoundAttribute(pipe)?.name === 'ngrxLet'
      );
    }

    return {
      // No fix or suggestion: `ngrxPush` also needs `PushPipe` in the
      // component's imports, which a template edit cannot add.
      'BindingPipe[name="async"]'(node: never) {
        const pipe = node as BindingPipe;
        if (isReportedElsewhere(pipe)) {
          return;
        }
        context.report({
          loc: getTemplateLoc(context.sourceCode, pipe),
          messageId,
        });
      },
    };
  },
});
