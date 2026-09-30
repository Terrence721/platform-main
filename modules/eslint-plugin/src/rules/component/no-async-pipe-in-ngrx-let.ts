import * as path from 'path';
import { createRule } from '../../rule-creator';
import {
  type BindingPipe,
  getBoundAttribute,
  getTemplateLoc,
  getTemplateText,
  isBoundAttribute,
  isLiteralMap,
} from '../../utils';

export const messageId = 'noAsyncPipeInNgrxLet';

type MessageIds = typeof messageId;
type Options = readonly [];

export default createRule<Options, MessageIds>({
  name: path.parse(__filename).name,
  meta: {
    type: 'problem',
    docs: {
      description:
        '`ngrxLet` subscribes to its observable itself, so an `async` pipe in its binding subscribes a second time.',
      ngrxModule: 'component',
      template: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      [messageId]:
        'Remove the `async` pipe: `ngrxLet` already subscribes to the observable.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const { sourceCode } = context;

    // `ngrxLet` takes an observable or a dictionary of observables, so the
    // pipe is reported as the whole binding or as a dictionary value, where
    // removing it hands `ngrxLet` the observable instead. An `async` deeper in
    // the expression (`(items$ | async)?.length`) is left alone.
    function isNgrxLetInput(pipe: BindingPipe): boolean {
      const { parent } = pipe;
      if (isLiteralMap(parent) && parent.values.includes(pipe)) {
        return isNgrxLetBinding(parent);
      }
      return isNgrxLetBinding(pipe);
    }

    function isNgrxLetBinding(node: BindingPipe['exp']): boolean {
      return isBoundAttribute(getBoundAttribute(node), 'ngrxLet');
    }

    return {
      'BindingPipe[name="async"]'(node: never) {
        const pipe = node as BindingPipe;
        if (!isNgrxLetInput(pipe)) {
          return;
        }
        context.report({
          loc: getTemplateLoc(sourceCode, pipe),
          messageId,
          // `items$ | async` becomes `items$`.
          ...(pipe.args.length === 0 && {
            fix: (fixer) =>
              fixer.replaceTextRange(
                [pipe.sourceSpan.start, pipe.sourceSpan.end],
                getTemplateText(sourceCode, pipe.exp)
              ),
          }),
        });
      },
    };
  },
});
