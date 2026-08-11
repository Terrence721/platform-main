# Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: August 11, 2026**

> [!CAUTION]
> This is a simulation of real-world code review.

Every finding below went through a real GitHub Pull Request: a branch, an issue documenting the finding, and a real merge — see [issue #32](https://github.com/Terrence721/platform-main/issues/32) for the live parent tracking card, and its 13 sub-issues (one per module, [#33](https://github.com/Terrence721/platform-main/issues/33)–[#45](https://github.com/Terrence721/platform-main/issues/45)) for the per-module cards. This page is a readable historical index, not the live mechanism.

**Process**: review one module at a time, not in parallel. Within a module, every non-spec `.ts` source file under `src/` gets its own row in [todo.md](../todo.md)'s per-module table (file path + last commit SHA at time of review), its own sub-issue nested under that module's tracking issue documenting findings, and its own PR — every file gets a PR, whether it carries a real fix or just records a clean review. The repo owner (Senior) reviews and merges every PR. Check todo.md for which module/file is next.

**Severity/category** follow the same scheme used on this author's other projects (see [coolify-full](https://github.com/Terrence721/coolify-full)): severity is `critical`/`high`/`medium`/`low`, category is one of `Security`, `Reliability`, `Correctness`, `Maintainability`.

---

## Findings

### [`action_creator.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/action_creator.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #46](https://github.com/Terrence721/platform-main/issues/46))

Real, unmodified upstream `@ngrx/store` source (adapted from the `ts-action` library per the file's own attribution comment) — nothing in this repo's composition-over-inheritance redesign or de-affiliation work touched it. Read through `createAction`'s three overloads, the runtime dispatch logic, `props()`, `union()` (a type-level-only helper — its `undefined!` return is intentional, never executed at runtime), and `defineType()`. Logic is internally consistent and matches the documented JSDoc usage examples.

---

### [`action_group_creator.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/action_group_creator.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #48](https://github.com/Terrence721/platform-main/issues/48))

Real, unmodified upstream `@ngrx/store` source — the `createActionGroup` type-level machinery plus its runtime counterparts `toActionName()`/`toActionType()`. Traced the runtime path end to end and verified `toActionName`'s camelCase logic matches the compile-time `ActionName<EventName>` type computation, and that `emptyProps()` correctly resolves through `createAction`'s `'props'` case (not `'empty'`) since spreading `undefined` is a documented-safe no-op.

---

### [`actions_subject.ts`](https://github.com/Terrence721/platform-main/blob/7ae77817174db2fed53f150ee47240d0e4180b6b/modules/store/src/actions_subject.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #50](https://github.com/Terrence721/platform-main/issues/50))

This repo's own composition-over-inheritance redesign (`ActionsSubject` composes a `BehaviorSubject` instead of extending it) — traced every in-repo consumer (`Store.dispatch()`, `ReducerManagerDispatcher`, `state.ts`, `store_module.ts`) for the "ripple" bug class already found and fixed in `router-store`/`store-devtools`/`data` (a consumer relying on inherited `BehaviorSubject` surface that composition dropped). Grepped the whole `store` tree for `.pipe(`/`.lift(`/`.toPromise(`/`.forEach(`/`.value` on an actions-subject-typed variable — no matches. `complete()`'s intentional no-op matches the documented contract and `ScannedActionsSubject`'s sibling design.

---

### [`feature_creator.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/feature_creator.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #52](https://github.com/Terrence721/platform-main/issues/52))

Real, unmodified upstream `@ngrx/store` source — `createFeature()`'s selector-generation logic. Traced the runtime path: `featureSelector` via `createFeatureSelector(name)`, per-property `nestedSelectors` derived from `getInitialState(reducer)` (guarded by `isPlainObject()`), merged into `{ name, reducer, ...baseSelectors, ...extraSelectors }` — matches the compile-time `Feature`/`FeatureWithExtraSelectors` types. `NotAllowedFeatureStateCheck` is a compile-time-only guard, same pattern as `action_group_creator.ts`'s `UniqueEventNameCheck`.

---

_More findings are appended here as each file's PR merges. Review of the `store` module is in progress — see [todo.md](../todo.md) for the full per-file table._
