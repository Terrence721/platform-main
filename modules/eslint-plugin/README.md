# @ngrx/eslint-plugin

Added from the real [NgRx](https://github.com/Terrence721/platform-main) project into this demo workspace. Not affiliated with, and not published by, the upstream project — see the root [README.md](../../README.md).

## Template rules for `@ngrx/component`

The `component` config lints Angular templates — the `ngrxLet` directive and the `ngrxPush` pipe — rather than TypeScript. It needs `@angular-eslint/template-parser`, an optional peer dependency (install it as a dev dependency; `angular-eslint` includes it). The other configs, `all` included, do not load it, so they work without it.

```js
// eslint.config.mjs
import ngrx from '@ngrx/eslint-plugin';
import angular from 'angular-eslint';

export default [
  ...ngrx.configs.all, // TypeScript rules
  ...ngrx.configs.component, // template rules, for **/*.html
  // Inline templates (`template:` in @Component) are linted as HTML too:
  { files: ['**/*.ts'], processor: angular.processInlineTemplates },
];
```

| Rule                        | What it reports                                                            | Fix           |
| --------------------------- | -------------------------------------------------------------------------- | ------------- |
| `no-async-pipe-in-ngrx-let` | `*ngrxLet="items$ \| async as items"`: `ngrxLet` already subscribes itself | drops `async` |
| `no-async-with-ngrx-push`   | `items$ \| async \| ngrxPush` (either order): both pipes subscribe         | drops `async` |
| `prefer-ngrx-push` (opt-in) | any other `async` pipe: prefer `ngrxPush`                                  | none          |

`prefer-ngrx-push` is a style choice rather than a fix — Angular's `async` pipe works in zoneless apps too — so it is in no config. Enable it by name, after the `component` config:

```js
{ files: ['**/*.html'], rules: { '@ngrx/prefer-ngrx-push': 'error' } },
```

It has no autofix: switching to `ngrxPush` also means adding `PushPipe` to the component's `imports`.

License: MIT
