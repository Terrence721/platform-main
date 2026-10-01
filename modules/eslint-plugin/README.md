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

## Which modules have rules

A lint rule can only check the code in an app that calls a library, so a module gets rules only where code that compiles can still be wrong in a way a static check can find.

Rules exist for `store`, `effects`, `component-store`, `operators` and `signals`, plus the template rules for `component` above. These have patterns that compile but are wrong: dispatching in effects, cyclic effects, mapping selectors instead of combining them.

The other modules have none, on purpose:

| Module                             | Why no rules                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schematics-core`                  | Internal helpers shared by the other packages' generators and migrations. It is not published and no app imports it, so there is nothing to lint.                                                                                                                            |
| `schematics`                       | `ng generate` / `ng add` tooling that runs from the CLI and writes files; apps never import it. The code it generates is ordinary store, effects or entity code, which the existing rules already cover, and its output is checked by its specs.                             |
| `router-store`                     | App code is mostly setup (`provideRouterStore()`, `StoreRouterConnectingModule.forRoot()`, `getRouterSelectors()`). Those APIs are small and fully typed, so misuse fails to compile; the real pitfalls, such as serializing the full router state, only show up at runtime. |
| `entity`, `data`, `store-devtools` | Their APIs are typed configuration and adapter calls, with no misuse a static check can find beyond what TypeScript and the `store` rules already catch.                                                                                                                     |

This was decided during the eslint-plugin review ([#45](https://github.com/Terrence721/platform-main/issues/45)) and recorded in [#767](https://github.com/Terrence721/platform-main/issues/767). It is worth revisiting only for a concrete misuse pattern a static check can find; propose that as its own rule and link it from #767.

License: MIT
