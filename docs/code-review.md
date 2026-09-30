# Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: September 30, 2026** (audit COMPLETE — all 13 modules; `schematics-core` module COMPLETE — 16/16 files; `signals` module COMPLETE — 18/18 files; `schematics` module COMPLETE — 25/25 files; `data` module COMPLETE — 61/61 files; `eslint-plugin` module COMPLETE — 55/55 files)

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

### [`flags.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/flags.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #54](https://github.com/Terrence721/platform-main/issues/54))

Real, unmodified upstream `@ngrx/store` source — a trivial module-level mutable boolean (`_ngrxMockEnvironment`) with a getter/setter pair, used to flag a mock testing environment. 8 lines, no branching, nothing to get wrong.

---

### [`globals.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/globals.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #56](https://github.com/Terrence721/platform-main/issues/56))

Real, unmodified upstream `@ngrx/store` source — `REGISTERED_ACTION_TYPES` (written by `action_creator.ts`, read by `runtime_checks.ts` for duplicate-action-type detection) plus `resetRegisteredActionTypes()`. The reset loop snapshots `Object.keys()` before `delete`-ing each key, so mutating mid-loop is safe.

---

### [`helpers.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/helpers.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #58](https://github.com/Terrence721/platform-main/issues/58))

Real, unmodified upstream `@ngrx/store` source — `capitalize()`/`uncapitalize()` and `assertDefined()`. Checked the empty-string edge case on the capitalize helpers: degrades to `''` unchanged, matching `Capitalize<''>`/`Uncapitalize<''>` at the type level.

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/index.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #60](https://github.com/Terrence721/platform-main/issues/60))

The package's public API barrel. Cross-checked against `private_export.ts` (internal cross-module surface) and `meta-reducers/index.ts`: the three runtime-check meta-reducers are deliberately not re-exported here, since `runtime_checks.ts` wires them in internally via `provideRuntimeChecks()`'s `META_REDUCERS` multi-provider — matches real `@ngrx/store`'s public API, where runtime checks are configured declaratively through `provideStore()` rather than importing meta-reducers directly.

---

### [`meta-reducers/immutability_reducer.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/meta-reducers/immutability_reducer.ts)

**medium · Reliability** — Fixed via [PR #63](https://github.com/Terrence721/platform-main/pull/63) ([issue #62](https://github.com/Terrence721/platform-main/issues/62))

`freeze()`'s top-level entry point crashed on `null`/`undefined` — inherited from the original upstream import. `Object.freeze` is a safe no-op on non-objects, but the following `Object.getOwnPropertyNames(target)` call throws `TypeError: Cannot convert undefined or null to object` for `null`/`undefined`. The function's own _recursive_ calls already guarded against this (`isObjectLike(propValue) || isFunction(propValue)` before recursing) — only the top-level entry point was missing the same guard.

Reachable whenever `strictStateImmutability` is on (the dev-mode default): any reducer with legitimately nullable state — a common, valid pattern (`createReducer(null, ...)` for "not yet loaded" state) — throws an uncaught `TypeError` on every dispatch. Reproduced empirically: added 2 regression tests, confirmed they fail against the unfixed source with exactly this error, confirmed they pass after the fix. Suggested fix: apply the same `isObjectLike(target) || isFunction(target)` guard the recursive call already uses, at the top of `freeze()`.

---

### [`meta-reducers/inNgZoneAssert_reducer.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/meta-reducers/inNgZoneAssert_reducer.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #64](https://github.com/Terrence721/platform-main/issues/64))

Real, unmodified upstream `@ngrx/store` source — throws if `checks.action(action)` is true and `NgZone.isInAngularZone()` is false, otherwise delegates to the wrapped reducer. No property traversal or freeze-style recursion (unlike `immutability_reducer.ts`), so that bug class doesn't apply here.

---

### [`meta-reducers/index.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/meta-reducers/index.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #66](https://github.com/Terrence721/platform-main/issues/66))

Real, unmodified upstream `@ngrx/store` source — a 3-line barrel re-exporting the three meta-reducers. Matches exactly what `runtime_checks.ts` imports from it.

---

### [`meta-reducers/serialization_reducer.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/meta-reducers/serialization_reducer.ts)

**low · Reliability** — Fixed via [PR #69](https://github.com/Terrence721/platform-main/pull/69) ([issue #68](https://github.com/Terrence721/platform-main/issues/68))

`getUnserializable()`'s root-level classification was weaker than what nested values get, inherited from the original upstream import — a variation on the same entry-point-vs-recursive-call asymmetry class as `immutability_reducer.ts`'s `freeze()` above, but a silent false-negative here rather than a crash. Nested values are classified via an explicit check set (component/number/boolean/string/array → serializable, plain object → recurse, else → flagged); the root only got a null/undefined guard before going straight to `Object.keys(target)`. A root state that's itself a `Map`/`Set`/class instance/function has no own enumerable keys, so nothing gets flagged even though `JSON.stringify` on it silently loses data — exactly what this check exists to catch. The existing test suite's `unSerializables` fixture was always exercised nested, never as the bare root, so the gap was untested. Added 5 regression tests (one per fixture entry, as root state); confirmed all 5 fail against the unfixed source and pass after the fix. Suggested fix: apply the same classification to the root that nested values already get.

---

### [`meta-reducers/utils.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/meta-reducers/utils.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #70](https://github.com/Terrence721/platform-main/issues/70))

Real, unmodified upstream `@ngrx/store` source — the type-predicate helpers already exercised heavily while investigating the two real bugs above. Every predicate matches its name exactly; `hasOwnProperty` safely goes through `Object.prototype.hasOwnProperty.call()`.

---

### [`models.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/models.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #72](https://github.com/Terrence721/platform-main/issues/72))

Real, unmodified upstream `@ngrx/store` source — pure type definitions plus a handful of literal error-message string constants. No runtime code paths beyond those literals. Cross-checked the key types against consumers already reviewed (`RuntimeChecks` vs. `runtime_checks.ts`, `ActionReducer`/`ActionReducerFactory` vs. `reducer_manager.ts`, `Prettify` vs. `feature_creator.ts`) — all consistent.

---

### [`private_export.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/private_export.ts)

**n/a · Maintainability** — Reviewed, no findings, structural note recorded ([issue #74](https://github.com/Terrence721/platform-main/issues/74))

Mirrors real upstream ngrx's monorepo-internal sharing mechanism — a second "private" entry point sibling packages import instead of the public one, for symbols deliberately excluded from `index.ts`. Every symbol it re-exports here is _also_ already public via `index.ts`, and nothing outside `store`'s own two integration specs imports from it, so its original gating purpose doesn't currently apply in this repo's per-package build. Not a defect — recorded as an observation, consistent with fidelity-to-upstream being a deliberate choice elsewhere in this repo.

---

### [`provide_store.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/provide_store.ts)

**n/a · Maintainability (test coverage)** — Fixed via [PR #77](https://github.com/Terrence721/platform-main/pull/77) ([issue #76](https://github.com/Terrence721/platform-main/issues/76))

No correctness bug — the code is right — but this repo had zero test coverage for `provideState()`, the primary modern API for registering feature state. `featureStateProviderFactory()`'s `featureReducers.shift()![index]` line looked like a real bug on first read (indexing what appeared to be a single per-feature `ActionReducerMap` with a numeric index). Wrote a throwaway reproduction before concluding anything: it passed. Traced why — `FEATURE_REDUCERS` is itself a `multi: true` token whose factory re-injects the _entire_ accumulated `_FEATURE_REDUCERS` array on every registration, so `featureReducers` is N duplicate full-length copies; `.shift()` pops one copy, `[index]` picks this feature's reducer out of it (_verified_, not just theorized). Convoluted (matches the upstream `TODO(#823)` marker on that line) but correct. Given the mechanism's subtlety and complete lack of coverage, added a permanent regression test exercising 2 simultaneously-registered features, asserting default state and that dispatching to each only changes its own slice.

---

### [`reducer_creator.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/reducer_creator.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #78](https://github.com/Terrence721/platform-main/issues/78))

Real, unmodified upstream `@ngrx/store` source — `on()`/`createReducer()`'s reducer-composition logic. Traced how multiple `on()` calls targeting the same action type chain (`const` inside the `for...of` loop gives each iteration its own binding, no closure-over-loop-variable bug); this exact scenario has direct test coverage, verified 5→6→7 across two chained `on()` calls.

---

### [`reducer_manager.ts`](https://github.com/Terrence721/platform-main/blob/ef21a62af044fd81efe94b31f75ee40e59c63ecb/modules/store/src/reducer_manager.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #80](https://github.com/Terrence721/platform-main/issues/80))

This repo's own composition-over-inheritance redesign — most consumer/DI-wiring consistency already verified while reviewing `actions_subject.ts`. This pass checked `addFeatures()`'s duplicate-key handling (ordinary last-wins object semantics), `removeReducers()`'s `omit()` helper (correctly builds a new object, no mutation), and confirmed the `TODO(#823)` marker here is the same upstream typing-debt annotation already investigated while reviewing `provide_store.ts`.

---

### [`runtime_checks.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/runtime_checks.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #82](https://github.com/Terrence721/platform-main/issues/82))

Already read and traced extensively while investigating the three real meta-reducer findings in this module. This pass checked one thing that looked suspicious on first read: `createActiveRuntimeChecks()`'s production branch never spreads `...runtimeChecks`, so user-configured overrides are silently ignored in production. Confirmed deliberate, not an oversight — a test is literally titled `'should disable runtime checks in production even if opted in to enable'`.

---

### [`scanned_actions_subject.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/store/src/scanned_actions_subject.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #84](https://github.com/Terrence721/platform-main/issues/84))

This repo's own composition-over-inheritance redesign, part of the same family as `ActionsSubject`/`ReducerManager`. Consumer check: `state.ts` calls `.next()` correctly; grepped `store` for the ripple-bug class (`.pipe`/`.lift`/`.toPromise`/`.forEach`) — no matches. `complete()` being a genuine terminator (not a no-op like `ActionsSubject`'s) is intentional and matches real upstream's design.

---

### [`selector.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/selector.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #86](https://github.com/Terrence721/platform-main/issues/86))

Real, unmodified upstream `@ngrx/store` source — `createSelector()`/`createSelectorFactory()`/`defaultMemoize()`, the largest and most heavily-used file reviewed in this module so far. Traced the reselect-style reference-preservation semantics in `defaultMemoize()` (returns the _old_ cached result when a newly-computed one is considered equal, not a bug), the three calling-convention dispatch paths in `createSelectorFactory()`, and the `.release()` cascade to parent memoized selectors. The empty-selectors-dictionary edge case (`createSelector({})`) has direct test coverage.

---

### [`state.ts`](https://github.com/Terrence721/platform-main/blob/ef21a62af044fd81efe94b31f75ee40e59c63ecb/modules/store/src/state.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #88](https://github.com/Terrence721/platform-main/issues/88))

This repo's own composition-over-inheritance redesign — per `todo.md` phase 24, this class already went through a second dedicated audit round before this review started. Traced the full RxJS orchestration in the constructor and the `toSignal({ manualCleanup: true })` + `ngOnDestroy()` cleanup interaction: `stateSubject.complete()` propagates completion to `toSignal`'s internal subscription, a deliberate substitute for Angular's DestroyRef-based auto-cleanup. No ripple-bug-class usage found.

---

### [`store.ts`](https://github.com/Terrence721/platform-main/blob/bb005ff51335f277079aceb67a177338a12c7948/modules/store/src/store.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #90](https://github.com/Terrence721/platform-main/issues/90))

This repo's own composition-over-inheritance redesign. `select()`/DI-wiring already checked while reviewing `index.ts`. This pass focused on `processDispatchFn()`/`getCallerInjector()` — the reactive `dispatch(() => action)` API. `assertDefined()` runs before the `?? this.injector` fallback chain, guaranteeing it's non-undefined by the time it's reached; `getCallerInjector()`'s try/catch around `inject(Injector)` is the standard Angular pattern for injection-context detection; the `effect()`/`untracked()` structure correctly scopes signal tracking. Has dedicated test coverage including the explicit `{ injector }` config override.

---

### [`store_config.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/store_config.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #92](https://github.com/Terrence721/platform-main/issues/92))

Real, unmodified upstream `@ngrx/store` source. The core feature-reducer distribution logic (`_createFeatureStore()`, `_createFeatureReducers()`) was already extensively traced and regression-tested while reviewing `provide_store.ts`. This pass covers `_initialStateFactory()` (lazy initial-state factory support), `_concatMetaReducers()` (order-preserving concat), and `_provideForRootGuard()` (`inject(Store, { skipSelf: true })` correctly detects an ancestor injector already providing `Store`, preventing double root-provisioning).

---

### [`store_module.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/store_module.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #94](https://github.com/Terrence721/platform-main/issues/94))

Real, unmodified upstream `@ngrx/store` source — the legacy `NgModule`-based (`StoreModule.forRoot`/`forFeature`) registration API. Uses the same `featureReducers.shift()![index]` mechanism already traced and confirmed correct while reviewing `provide_store.ts`. Unlike that file, this exact mechanism already has direct, pre-existing test coverage here — `modules.spec.ts`'s `'Nested'` suite registers 3 simultaneous features together under one root module.

---

### [`tokens.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/tokens.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #96](https://github.com/Terrence721/platform-main/issues/96))

Real, unmodified upstream `@ngrx/store` source — pure `InjectionToken` constant declarations, no runtime logic. Every token here was already cross-referenced against its real DI usage while reviewing `provide_store.ts`, `store_module.ts`, `runtime_checks.ts`, `reducer_manager.ts`, and `store_config.ts`. `InjectionToken` identity is reference-based, not string-based, so no "duplicate token" bug class is even possible here.

---

### [`utils.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/store/src/utils.ts)

**medium · Reliability** — Fixed via [issue #98](https://github.com/Terrence721/platform-main/issues/98) — **last file in the `store` module**

`combineReducers()`'s returned `combination()` function crashed with an uncaught `TypeError` when called with a `null` state — the third instance of the same "guards `undefined` but not `null`" bug class already found twice in this module (`immutability_reducer.ts`, `serialization_reducer.ts` above), but in a different function this time. `createReducerFactory()`'s wrapper only guards `undefined` too, so a root/feature explicitly configured with a map-shaped reducer and `initialState: null` (via either `provideStore()`/`provideState()` or the legacy `StoreModule.forRoot()`/`forFeature()` — both go through the same code path) crashes on the very first dispatch: the wrapper substitutes `null` for `undefined` state, then calls `combination(null, action)` directly, bypassing its own `undefined` check, and `state[key]` throws. Reproduced empirically, added a regression test mirroring the exact real-world call path (not just `combineReducers`'s own default), ran the full consumer-spec suite (93 tests, both registration APIs) — no regressions. Fix: widened the guard from `state === undefined` to `state == null`, matching `combineReducers`'s inherent contract as a dictionary-shaped state combiner (unlike a single-function reducer, where `null` state is legitimate and untouched by this fix).

---

**`store` module review complete — 27/27 files reviewed, 3 real bugs found and fixed, 1 test-coverage gap closed.** See [todo.md](../todo.md) for the full per-file table and the next module in the audit.

### `entity` module

### [`create_adapter.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/create_adapter.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #100](https://github.com/Terrence721/platform-main/issues/100))

`createEntityAdapter()` — the module's single public factory function. Five overload signatures handle the type-inference cases (default `{ id }` shape, explicit `string`/`number` `selectId`, generic `IdSelector`, no-args), all narrowing to one runtime implementation. Traced the runtime body: `selectId` defaults to `(entity: any) => entity.id` via `??`, `sortComparer` defaults to `false`, and the returned adapter is `createInitialStateFactory()` + `createSelectorsFactory()` + (`createSortedStateAdapter()`/`createUnsortedStateAdapter()` depending on `sortComparer`) object-spread together with no key collisions between the three factories. Real, effectively-unmodified upstream `@ngrx/entity` source — JSDoc has been expanded, runtime logic is untouched.

---

### [`entity_state.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/entity_state.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #102](https://github.com/Terrence721/platform-main/issues/102))

Two exports: `getInitialEntityState()` (returns a fresh `{ ids: [], entities: {} }` object literal on every call, no shared mutable reference between calls) and `createInitialStateFactory()`, whose returned `getInitialState()` is `Object.assign(getInitialEntityState(), additionalState)` — merges caller-supplied additional feature-state fields onto a fresh base object per call. Cross-checked against `create_adapter.ts`'s usage — consistent. Real, unmodified upstream `@ngrx/entity` source.

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/index.ts)

**n/a · Maintainability** — Reviewed, no findings, structural note recorded ([issue #104](https://github.com/Terrence721/platform-main/issues/104))

The package's public API barrel — re-exports `createEntityAdapter` plus 12 types from `models.ts`. Cross-checked against `models.ts`'s full export list: 8 types are deliberately not re-exported (`IdSelectorStr`/`IdSelectorNum`/`UpdateStr`/`UpdateNum` overload-resolution helpers behind their public union types, `EntityDefinition`/`EntityStateAdapter` internal composition types, `EntityMapOneNum`/`EntityMapOneStr` behind `EntityMapOne`) — matches real upstream `@ngrx/entity`'s public surface exactly, same pattern already noted for `store`'s `private_export.ts`/`index.ts` pairing.

---

### [`models.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/models.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #107](https://github.com/Terrence721/platform-main/issues/107))

Pure type definitions plus one runtime construct: `Dictionary<T>` is declared as an `abstract class` implementing `DictionaryNum<T>` with a `[id: string]: T | undefined` index signature — a real TypeScript trick to get both a string and number index signature satisfied simultaneously, used purely for typing, never instantiated at runtime. Cross-checked the type surface against every already-reviewed consumer (`EntityStateAdapter` vs. `unsorted_state_adapter.ts`/`sorted_state_adapter.ts`, `EntitySelectors`/`MemoizedEntitySelectors` vs. `state_selectors.ts`, `EntityAdapter`'s conditional `selectId` type vs. `create_adapter.ts`'s 5 overloads) — all consistent. Real, unmodified upstream `@ngrx/entity` source.

---

### [`sorted_state_adapter.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/sorted_state_adapter.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #109](https://github.com/Terrence721/platform-main/issues/109))

The CRUD operator set used whenever `createEntityAdapter()` is given a `sortComparer`. Delegates `removeOne`/`removeMany`/`removeAll` to `createUnsortedStateAdapter()` and implements the rest around a shared `merge()` helper (a standard two-pointer merge-sort merge step against the user's comparer). Traced `setOneMutably`'s re-sort-on-update path, `updateManyMutably`'s index-position heuristic for `DidMutate.EntitiesOnly` vs. `DidMutate.Both` (confirmed intentional, not a defect), and `upsertManyMutably`'s added/updated split. Checked for the "entry point vs. recursive/nested guard" bug class found in `store` — no recursion and no null/undefined state entry point here, all operations assume a valid pre-initialized `EntityState`; the asymmetry doesn't apply. Real, unmodified upstream `@ngrx/entity` source.

---

### [`state_adapter.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/state_adapter.ts)

**n/a · Maintainability** — Reviewed, no findings, structural note recorded ([issue #111](https://github.com/Terrence721/platform-main/issues/111))

The immutability wrapper every `*Mutably`-suffixed operation goes through: `createStateOperator(mutator)` clones `ids`/`entities`, runs the mutator against the clone, then branches on the returned `DidMutate` (`Both` merges both clone fields in, `EntitiesOnly` keeps the original `ids` reference, `None` returns the original `state` unchanged — preserving referential equality for downstream memoized selectors). Checked the store-style entry-point-guard bug class: `[...state.ids]` would throw on `null`/`undefined` state, but unlike `store`'s reducers, `entity`'s `EntityState` has no supported nullable-initial-state path — every adapter is only seeded via `getInitialState()`, which never returns `null`. Not a reachable defect, recorded as a structural observation. Real, unmodified upstream `@ngrx/entity` source.

---

### [`state_selectors.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/state_selectors.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #113](https://github.com/Terrence721/platform-main/issues/113))

`createSelectorsFactory().getSelectors(selectState?)` returns `selectIds`/`selectEntities`/`selectAll`/`selectTotal` either as plain functions operating directly on `EntityState<T>` (no `selectState` given) or wrapped in `@ngrx/store`'s `createSelector(selectState, ...)` for full memoization (when given). `selectAll`'s `ids.map((id) => entities[id])` denormalization assumes `ids`/`entities` stay in lockstep — cross-checked against every state-adapter operation already reviewed in `unsorted_state_adapter.ts`/`sorted_state_adapter.ts`, which always mutate both together. `createSelector` itself was already traced and confirmed correct during the `store` review (`selector.ts`, issue #86); this file is a straightforward consumer. Real, unmodified upstream `@ngrx/entity` source.

---

### [`unsorted_state_adapter.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/unsorted_state_adapter.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #115](https://github.com/Terrence721/platform-main/issues/115))

The CRUD operator set used whenever `createEntityAdapter()` has no `sortComparer` (insertion-order state) — also the base `sorted_state_adapter.ts` delegates `removeOne`/`removeMany`/`removeAll` to. Traced every operation: `addOneMutably`'s no-op-on-existing-key guard, `setAllMutably`'s always-`Both` reset, `removeManyMutably`'s unify-then-filter-to-present-keys pattern, `takeNewKey`/`updateManyMutably`'s id-change detection (checked the simultaneous-updates-racing-to-the-same-key edge case — last-write-wins, matches ordinary object-assignment semantics, not a data-loss bug), and `upsertManyMutably`'s added/updated split with its 3-way `DidMutate` combination. Checked for the store-style entry-point-guard bug class (same reasoning as `state_adapter.ts`, #111) — doesn't apply. Real, unmodified upstream `@ngrx/entity` source.

---

### [`utils.ts`](https://github.com/Terrence721/platform-main/blob/2208e987dda2f47373af3770d1ed6e790c34cd72/modules/entity/src/utils.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #117](https://github.com/Terrence721/platform-main/issues/117)) — **last file in the `entity` module**

`selectIdValue(entity, selectId)` — the single most-called helper in the module, already exercised extensively while reviewing `unsorted_state_adapter.ts`/`sorted_state_adapter.ts`. Calls the caller-supplied `selectId(entity)` and dev-mode-warns (never throws) if the key is `undefined`, still returning the key regardless — confirmed this matches real upstream `@ngrx/entity` behavior exactly, a diagnostic aid rather than a guard. Real, unmodified upstream source.

---

**`entity` module review complete — 9/9 files reviewed, 0 real bugs found, 2 structural observations recorded** (`index.ts`'s narrower public API matching upstream, `state_adapter.ts`'s not-reachable null-state guard gap). Unlike `store`, this module's CRUD surface didn't exhibit the entry-point-vs-recursive-call guard asymmetry that produced 3 real bugs there. See [todo.md](../todo.md) for the full per-file table and the next module in the audit.

### `effects` module

### [`actions.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/actions.ts)

**n/a · Maintainability** — Reviewed, no findings, structural note recorded ([issue #119](https://github.com/Terrence721/platform-main/issues/119))

`Actions<V>` genuinely extends `Observable<V>` (unlike `store`'s `ActionsSubject`/`ScannedActionsSubject`, which compose a `BehaviorSubject` instead) — checked why this is correct rather than a composition-over-inheritance gap: `Actions` is meant to be consumed directly as an RxJS source, and its `lift<R>()` override correctly ensures every operator applied via `.pipe()` produces a new `Actions<R>` (not a plain `Observable`), the standard pattern for subclassing `Observable`. `ofType()`'s 6 overloads narrow to one runtime `filter()` matching a literal action-type string or an `ActionCreator`'s `.type`. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effect_creator.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effect_creator.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #121](https://github.com/Terrence721/platform-main/issues/121))

`createEffect(source, config?)` traced end to end: `effect = config.functional ? source : source()` (functional effects keep the re-invokable source function; class-property effects invoke immediately), metadata attached via `Object.defineProperty` deliberately non-enumerable so it doesn't leak into `for...in`/`Object.keys()`/`JSON.stringify()` while staying discoverable via `hasOwnProperty()`. `getCreateEffectMetadata()`'s second defensive check against [ngrx/platform#2975](https://github.com/ngrx/platform/issues/2975) (observable-like objects with an overridden `hasOwnProperty` producing false positives) confirmed present and correct — a legitimate targeted upstream fix, not something broken here. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effect_notification.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effect_notification.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #123](https://github.com/Terrence721/platform-main/issues/123))

`reportInvalidActions()` only inspects `'N'` notifications (a correct no-op for error/complete), and `isAction()` rejects bare functions — the runtime counterpart to the compile-time "forgot to call the action creator" check elsewhere in the module. `getEffectName()` correctly distinguishes method-style vs. property-style class-effect naming via `typeof sourceInstance[propertyName] === 'function'`, and always appends `()` for functional effects (`sourceName` null). `stringify()`'s try/catch gracefully falls back on circular-reference `JSON.stringify` failures. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effect_sources.ts`](https://github.com/Terrence721/platform-main/blob/ef21a62af044fd81efe94b31f75ee40e59c63ecb/modules/effects/src/effect_sources.ts)

**n/a · Maintainability** — Reviewed, no findings — highest-risk file in the module, given the deepest scrutiny ([issue #125](https://github.com/Terrence721/platform-main/issues/125))

The core async orchestration — composes a private `Subject` (documented as the same `ActionsSubject`/`ReducerManager`-style design as its store-side counterparts). `toActions()`'s nested `groupBy` (by class prototype, then by `ngrxOnIdentifyEffects()` key) → `exhaustMap` (ignoring re-additions of an already-running instance) → per-group `init$` (`take(1)` scoped per class+identifier pair, not globally) pipeline traced end to end and cross-referenced against `spec/effect_sources.spec.ts`'s 30 test cases — every behavior traced independently (grouping, dedup, init-action timing, invalid-action reporting, error resubscription) has a directly corresponding passing test. `error()`'s genuine-terminator (not no-op) behavior confirmed via its own dedicated test. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effects_actions.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_actions.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #127](https://github.com/Terrence721/platform-main/issues/127))

`ROOT_EFFECTS_INIT`/`rootEffectsInit` — 4 lines, a single `createAction()` call. Dispatched once by `effects_root_module.ts`/`provide_effects.ts` after root effects registration, distinct from the per-effects-class `OnInitEffects` mechanism elsewhere in the module. `createAction` itself was already traced and confirmed correct during the `store` review (issue #46); this file is a trivial consumer. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effects_error_handler.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_error_handler.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #129](https://github.com/Terrence721/platform-main/issues/129))

`defaultEffectsErrorHandler()`'s recursive retry (report via `errorHandler.handleError()`, then either terminate on the last of 10 attempts or resubscribe with a fresh `catchError` wrapper) traced end to end and cross-checked against `spec/effect_sources.spec.ts`'s dedicated resubscribe-on-error/`dispatch: false`/`useEffectsErrorHandler: false` opt-out tests — all three directly confirm this file's behavior. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effects_feature_module.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_feature_module.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #131](https://github.com/Terrence721/platform-main/issues/131))

The legacy `NgModule`-based `EffectsModule.forFeature()` registration target. Constructor injects `EffectsRootModule` non-optionally (DI construction order enforces `forRoot()` ran first) plus the accumulated `_FEATURE_EFFECTS_INSTANCE_GROUPS` multi-provider array; `@Optional() storeRootModule`/`storeFeatureModule` are unused beyond forcing `@ngrx/store`'s own setup to construct first, the standard Angular DI ordering trick. Body flattens the nested instance groups and delegates to the same `addEffects()` already traced in `effects_root_module.ts`. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effects_metadata.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_metadata.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #133](https://github.com/Terrence721/platform-main/issues/133))

`getSourceMetadata()` thinly re-exports `effect_creator.ts`'s `getCreateEffectMetadata()` (issue #121). `getEffectsMetadata()`, the public introspection API, reduces the metadata array into a per-property-name dictionary but drops `functional` from each entry — checked whether this is a real gap: still type-valid since `functional` is optional on `EffectConfig`, and the omission fits the function's actual purpose (introspecting registered class-instance effects, where functional-vs-not isn't a meaningful per-property distinction). Not a defect. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effects_module.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_module.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #135](https://github.com/Terrence721/platform-main/issues/135))

`EffectsModule.forFeature()`/`forRoot()` traced: `forFeature()`'s tokens are `multi: true` (correctly allows multiple calls to contribute independently), `forRoot()`'s are deliberately not, with double-registration instead caught by `_provideForRootGuard()` — structurally the same pattern as `store`'s own `_provideForRootGuard()` in `store_config.ts` (issue #92), including the same constructor-parameter-ordering trick. `createEffectsInstances()`'s `isToken()`-gated `inject()` correctly leaves functional-effect records unresolved (already-instantiated values, not injectable references), and `getClasses()` correctly filters the `providers` array to only class-based effects. Real, unmodified upstream `@ngrx/effects` source.

---

### [`effects_resolver.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_resolver.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #137](https://github.com/Terrence721/platform-main/issues/137))

`mergeEffects()` turns one registered effects source into a single merged `Observable<EffectNotification>`. Checked specifically for the entry-point null-guard gap that's been the recurring bug class in this codebase's `store` review: `isClassBasedEffect`'s `!!source &&` short-circuit correctly handles a `null` prototype (an `Object.create(null)` source) before touching `.constructor` — no crash. Traced the `dispatch === false` branch: `ignoreElements()` runs before `materialize()`, so a non-dispatching effect's own errors still propagate normally rather than being silently absorbed by the opt-out. This file's own `spec/effects_resolver.spec.ts` is a placeholder with no real assertions, but every branch traced above (class vs. functional sources, `dispatch: false`, `useEffectsErrorHandler` on/off) is exercised by `effect_sources.spec.ts`'s 30 test cases (issue #125) — organized under a different file's spec, not a real coverage gap.

---

### [`effects_root_module.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_root_module.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #140](https://github.com/Terrence721/platform-main/issues/140))

`EffectsRootModule`'s constructor runs once, in order: `runner.start()`, then a loop registering every root effect via `sources.addEffects()`, then a single `ROOT_EFFECTS_INIT` dispatch. That order is correctness-critical, not incidental: `EffectSources` composes a plain `Subject` (issue #125), which drops any `next()` call made before a subscriber exists, so `runner.start()` has to subscribe before the loop pushes effects in, or every root effect would silently never fire. The public `addEffects()` method — the one `effects_feature_module.ts` (issue #131) calls for feature-level registration — just forwards to the same `EffectSources` call. The `@Optional()` DI-ordering params and the `_ROOT_EFFECTS_GUARD` injection are the same forced-construction-order and double-`forRoot()`-guard tricks already seen in `effects_module.ts` (issue #135) and `store`'s `store_config.ts` (issue #92).

---

### [`effects_runner.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/effects_runner.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #142](https://github.com/Terrence721/platform-main/issues/142))

`EffectsRunner.start()` subscribes to `EffectSources.toActions()` with no explicit `error` callback on the subscribe call - flagged a real hypothesis worth testing: could a thrown error inside `store.dispatch()` (a buggy reducer, a runtime-check violation) silently tear down the subscription forever, with `isStarted` continuing to falsely report `true`? Wrote a throwaway repro against this repo's real installed `rxjs` (7.8.2) instead of trusting the reasoning - a `Subject` whose subscriber throws on a sentinel value stays open (`closed: false`) and keeps delivering later emissions; the thrown error routes through RxJS's own `reportUnhandledError` path instead of tearing down the subscriber chain. The hypothesis was wrong, disproven by testing rather than by static reading alone.

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/index.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #144](https://github.com/Terrence721/platform-main/issues/144))

The module's public API barrel - 27 re-exports across 12 files, checked both directions against each source file's own export list, not just skimmed. Every excluded symbol traces to a real internal consumer: `models.ts`'s 5 unexported symbols are metadata-attachment plumbing for `createEffect()`, `tokens.ts`'s 5 underscore-prefixed tokens wire `effects_module.ts`/`provide_effects.ts` to `effects_root_module.ts`/`effects_feature_module.ts`, `lifecycle_hooks.ts`'s 3 type-guard functions are used only inside `effect_sources.ts`, and `effect_creator.ts`'s `getCreateEffectMetadata()`/`effect_notification.ts`'s `reportInvalidActions()` are both internal engines behind already-reviewed public wrappers. Same privacy-boundary-by-naming-convention pattern already confirmed clean in `store`'s and `entity`'s own `index.ts` reviews.

---

### [`lifecycle_hooks.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/lifecycle_hooks.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #146](https://github.com/Terrence721/platform-main/issues/146))

The 3 optional lifecycle-hook interfaces (`OnIdentifyEffects`/`OnRunEffects`/`OnInitEffects`) all delegate to one shared `isFunction()` guard. Its `instance &&` check is load-bearing (the `in` operator throws on `null`/`undefined`) and correctly ordered first. Checked one step further: `in` also throws on any non-object primitive, not just nullish values - traced every call path back to `EffectSources.addEffects()`, which only ever receives DI-resolved class instances or functional-effect records at every typed public entry point (`forRoot()`/`forFeature()`/`provideEffects()`). A primitive can't reach this function without forcing it with `as any`, so not a defect reachable under normal usage. One cosmetic naming inconsistency noted (the third key constant is `onInitEffects`, not `onInitEffectsKey` like its two siblings) - harmless, not a finding.

---

### [`models.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/models.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #148](https://github.com/Terrence721/platform-main/issues/148))

Pure types/interfaces/constants - `EffectConfig`, `DEFAULT_EFFECT_CONFIG`, `CREATE_EFFECT_METADATA_KEY`, `CreateEffectMetadata`/`FunctionalCreateEffectMetadata`, `FunctionalEffect`, `EffectPropertyKey`, `EffectMetadata`, `EffectsMetadata`. Checked for consistency against every already-reviewed consumer rather than in isolation: `DEFAULT_EFFECT_CONFIG` matches `effect_creator.ts`'s documented defaults and `effects_resolver.ts`'s actual branching (issue #137); `EffectMetadata<T> extends Required<EffectConfig>` matches what `getCreateEffectMetadata()` actually constructs at runtime (every field always filled via spread-over-defaults); `EffectsMetadata<T>`'s optional-field shape matches `getEffectsMetadata()`'s 2-of-3-field population, already confirmed not a defect (issue #133); `EffectPropertyKey<T>`'s `Object.prototype`-member exclusion aligns the compile-time type with `getCreateEffectMetadata()`'s runtime use of `Object.getOwnPropertyNames()`. No runtime logic beyond a plain object literal and a string constant, so a types-only file's correctness is enforced by the compiler at every consuming call site rather than by a dedicated spec.

---

### [`provide_effects.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/provide_effects.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #150](https://github.com/Terrence721/platform-main/issues/150))

The standalone-API equivalent of `effects_root_module.ts`/`effects_feature_module.ts` (issues #140/#131), via `provideEnvironmentInitializer()` instead of an NgModule constructor. Confirmed the same correctness-critical ordering from issue #140 is preserved in this style too: `effectsRunner.start()` runs before the `addEffects()` loop, gated on `shouldInitEffects = !effectsRunner.isStarted`. Worth naming as a real, deliberate design difference from the NgModule path, not a bug: `effects_module.ts`'s `_ROOT_EFFECTS_GUARD` (issue #135) _throws_ on a second `forRoot()` call, while `provideEffects()` uses `isStarted` to make repeat calls idempotent-safe instead - every call's effects still register, only the runner-start/init-dispatch is deduplicated. Confirmed intentional via `provide_effects.spec.ts`'s own test (`provideEffects()` called twice, `start()` fires exactly once, no thrown error). 7 test cases cover idempotency, a real thrown error when store isn't provided, class/functional/mixed effects running end-to-end, and effects registered _before_ `provideStore()`/`provideState()` in the providers array still resolving correctly - confirming the DI-ordering tricks aren't array-position-dependent.

---

### [`tokens.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/tokens.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #152](https://github.com/Terrence721/platform-main/issues/152))

7 `InjectionToken` declarations, each checked against its real registration (`effects_module.ts`) and injection sites, not read in isolation. A deliberate, well-reasoned asymmetry worth naming: `_ROOT_EFFECTS`'s strict 1-tuple type matches its **non-multi** provider (`forRoot()` is meant to be called exactly once - the guard exists specifically to reject a second call), while `_FEATURE_EFFECTS`'s plain array-of-arrays type matches its **multi** provider (`forFeature()` is legitimately called many times, once per feature module) - both type shapes are exactly right for their own cardinality, not copy-pasted from each other. `USER_PROVIDED_EFFECTS` is a real, tested extension point, not dead code - `integration.spec.ts`'s "runs user provided effects defined as injection token" test confirms a custom `InjectionToken`-backed effects source actually runs through it. One soft, non-defect note: `_ROOT_EFFECTS_GUARD: InjectionToken<void>`'s generic is effectively decorative (the factory returns `unknown`, the injection site declares `unknown`, neither relies on `void`) - a legitimate pattern for a presence-only guard token whose value is never read.

---

### [`utils.ts`](https://github.com/Terrence721/platform-main/blob/cd346bdb20794b8ba04cc885edd0c98a1aefccd8/modules/effects/src/utils.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #154](https://github.com/Terrence721/platform-main/issues/154)) — **last file in `effects`, 18/18**

Five small helpers plus a hand-rolled `ObservableNotification<T>` union. Traced `isClassInstance()`'s entry-point guard (`!!obj.constructor && ...`) - correctly short-circuits before `.name` is accessed, which matters for a prototype-less object where `.constructor` is `undefined`. The most thoroughly tested file in the module: `utils.spec.ts` directly exercises every function, including the exact prototype-less-object edge case (`{ __proto__: null }`) traced above - not just reasoned about, actually tested. The `ObservableNotification` TODO comment checked against the module's real `peerDependencies` (`rxjs ^6.5.3 || ^7.5.0`) - legitimate, documented technical debt tied to a real cross-version constraint, same category as `store`'s already-traced `TODO(#823)` marker.

---

### [`actions.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/actions.ts)

**low · Correctness** — Fixed via [PR #157](https://github.com/Terrence721/platform-main/pull/157) ([issue #156](https://github.com/Terrence721/platform-main/issues/156)) — first file in `router-store`

`routerCancelAction`/`routerErrorAction`'s exported `payload.storeState` was typed as `SerializedRouterStateSnapshot` (router-state shape, `.url`/`.root`) when it actually holds the application's own arbitrary store state - confirmed via `store_router_connecting.service.ts`'s own `private storeState: any` field, the real source of that value. Root cause: `RouterCancelPayload<T, V = SerializedRouterStateSnapshot>` takes two type parameters, but the action creators supplied only one (`RouterCancelPayload<SerializedRouterStateSnapshot>`), which binds positionally to `T` (storeState) instead of the intended `V` (routerState). Confirmed empirically with a throwaway type-check probe against the real action creators (not just read and reasoned about): before the fix, `.url`/`.root` access on `storeState` type-checked cleanly and a deliberately-nonexistent property correctly errored, proving it was locked to the wrong concrete type rather than loosely `any`; after the fix, `.url` access correctly errors, confirming `storeState` is now honestly `unknown`. Fixed by passing both type arguments explicitly and in the right order at both call sites - doesn't touch the type parameter declarations, so the public generic types and any code already parametrizing them explicitly (e.g. `integration.spec.ts`'s `RouterAction<any>`) are unaffected. Type-only, no runtime crash. Verified: `yarn nx build-package router-store` (clean), `yarn nx test router-store` (156/156, 1 pre-existing skip, 0 type errors), `yarn nx lint router-store` (0 errors, 1 pre-existing unrelated warning).

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/index.ts)

**low · Maintainability** — Fixed via [PR #159](https://github.com/Terrence721/platform-main/pull/159) ([issue #158](https://github.com/Terrence721/platform-main/issues/158))

The public API barrel was missing a real re-export: `models.ts`'s `RouterStateSelectors<V>` - the direct return-type of the already-public `getRouterSelectors<V>()` - had no way to reach a consumer through the package's normal entry point. Cross-checked every other file in the module against what's re-exported, not just this one gap: everything else matched exactly, including a correct exclusion (`store_router_connecting.service.ts`'s `StoreRouterConnectingService` class is genuinely internal wiring, confirmed by the module's own `router_store_module.spec.ts` importing it from the concrete path rather than the barrel). Fixed with one added line; verified clean build/test/lint.

---

### [`models.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/models.ts)

**low · Correctness** — Fixed via [PR #161](https://github.com/Terrence721/platform-main/pull/161) ([issue #160](https://github.com/Terrence721/platform-main/issues/160))

`RouterStateSelectors<V>`'s `selectFragment` field was typed `MemoizedSelector<V, string | undefined>`, missing `null` from the union - Angular's real `ActivatedRouteSnapshot.fragment` is `string | null`, confirmed directly against `@angular/router`'s `.d.ts`. Silently unenforced because the selector chain is `any`-typed by design (the router state's true shape depends on which serializer a consumer picks), so TypeScript never actually compared the real field type against the declared one. Checked `selectTitle` for the same class of gap - it's correct as-is, since `.title` is a getter Angular itself normalizes to `string | undefined`. The other selectors' shared `any`-typed intermediate chain is a deliberate architectural characteristic of the whole file, not a bug, so left alone - fix scoped to the one concretely-verified mismatch.

**Revisited, low · Correctness** — Fixed via [issue #184](https://github.com/Terrence721/platform-main/issues/184) — surfaced during `router_selectors.ts`'s review ([#182](https://github.com/Terrence721/platform-main/issues/182))

The "concretely-verified mismatch only" scoping above missed three siblings of the same bug class: `selectQueryParams`, `selectRouteParams`, and `selectRouteData` (plus `selectUrl`) were all also declared without `| undefined`, even though each one can genuinely return `undefined` at runtime - established once `reducer.ts`'s review (#180) confirmed the router feature slice is genuinely `undefined` before the first navigation completes. `createRouterSelector()`'s own return type doesn't carry `| undefined`, so TypeScript's inference through the whole chain never did either, which is why this didn't show up as a compile error the first time: the implementation's inferred type and the declared interface already agreed with each other, just both wrongly. Confirmed empirically (a throwaway runtime probe against `{ router: undefined }` returns `undefined` for all four) and against the type system (`spec/types/router_selectors.types.spec.ts`'s existing, passing assertions literally locked in the wrong type). Fix: widened all 4 fields to include `| undefined`, updated the corresponding type-spec assertions. Same narrow scoping as before - `createRouterSelector()`'s own signature and the broader `RouterReducerState<any>`-without-undefined convention deliberately left alone.

---

### [`provide_router_store.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/provide_router_store.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #176](https://github.com/Terrence721/platform-main/issues/176))

Builds the four `provideRouterStore<T>()` providers: `_ROUTER_CONFIG` (raw value), `ROUTER_CONFIG` (defaults filled via `_createRouterConfig`), `RouterStateSerializer` (`useClass` picked from `config.serializer`/`config.routerState`), and an eager `provideEnvironmentInitializer(() => inject(StoreRouterConnectingService))` alongside the service class. Checked for this audit's recurring guard-asymmetry class - no recursion here, doesn't apply. Checked provider-order sensitivity (the `EffectSources`/`ROOT_EFFECTS_INIT` ordering class from `effects`) - doesn't apply either, since `provideEnvironmentInitializer(...)` and `StoreRouterConnectingService` are independent non-multi provider entries and Angular collects the full provider list before running any `ENVIRONMENT_INITIALIZER`. `router_store_module.ts`'s `StoreRouterConnectingModule.forRoot()` is a thin passthrough with no drift. `RouterState.Full` is enum value `0`, so the `===` check against it correctly handles the falsy-zero case. No dedicated spec file, but exercised thoroughly through `spec/utils.ts`'s `createTestModule()` across `router_store_module.spec.ts` and `integration.spec.ts`.

No bug in this file - but tracing `config.serializer`'s type to understand the generic flow surfaced a real bug one file over in `router_store_config.ts` (`StoreRouterConfig<T>.serializer` isn't parameterized by `T`, so a mismatched serializer compiles with no error). That fix is tracked as this module's next sub-issue, reviewed out of file order since the context was already loaded.

---

### [`router_store_config.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/router_store_config.ts)

**low · Correctness** — Fixed via [issue #178](https://github.com/Terrence721/platform-main/issues/178) — reviewed out of file order, surfaced during `provide_router_store.ts`'s review

`StoreRouterConfig<T>.serializer` was typed `new (...args: any[]) => RouterStateSerializer` - not parameterized by `T` - even though `RouterStateSerializer<T>` is itself generic, so `provideRouterStore<T>({ serializer: SomeSerializer })` accepted any serializer regardless of whether it actually produced `T`, with no compile error. Confirmed empirically with a throwaway type probe (a serializer producing a weaker shape than a custom `T` compiled cleanly before the fix, correctly errored after). Parameterizing the field alone broke `_createRouterConfig`'s own default-fill object literal (`MinimalRouterStateSerializer` doesn't satisfy the interface's default `T = SerializedRouterStateSnapshot`) - rather than widen that public default (a much larger change rippling through `provideRouterStore()`, `StoreRouterConnectingModule.forRoot()`, and `StateKeyOrSelector<T>`), scoped `_createRouterConfig`'s own parameter/return type to `StoreRouterConfig<BaseRouterStoreState>` instead, since it's only ever called as a bare DI factory reference with no generic argument supplied anywhere. Running the real suite with the fix applied surfaced a second live instance of the same gap in `spec/integration.spec.ts`'s custom-serializer test, silently relying on the same unparameterized hole - fixed by making the shared `createTestModule()` test helper generic to match.

---

### [`reducer.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/reducer.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #180](https://github.com/Terrence721/platform-main/issues/180))

`routerReducer()` handles `ROUTER_NAVIGATION`/`ROUTER_ERROR`/`ROUTER_CANCEL` identically - all three commit `payload.routerState` and `payload.event.id`. Traced whether that's actually correct for cancel/error rather than assuming it: `store_router_connecting.service.ts`'s `dispatchRouterAction()` only overrides `routerState` in the payloads for navigation, not cancel/error, so `this.routerState` (set once, on `NavigationStart`, before the attempt) is what those two commit - correctly reverting store state to match the router, which never left the old URL, while `navigationId` still advances to the failed event's own `id`. Confirmed against `@angular/router`'s real `.d.ts` that `NavigationCancel`/`NavigationError`/`RoutesRecognized` all extend `RouterEvent`, whose `id: number` is non-optional, so `payload.event.id` can't be `undefined` for any case this switch handles. The `Result` generic's unconstrained default and double-cast through `unknown` is a documented `strictFunctionTypes` escape hatch (`ref: #1344`), not the same class of gap as `router_store_config.ts`'s missing parameterization - no call site in this repo supplies a `Result` inconsistent with `RouterState`. No dedicated spec file, but exercised extensively through `integration.spec.ts` and `router_store_module.spec.ts`.

---

### [`router_selectors.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/router_selectors.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #182](https://github.com/Terrence721/platform-main/issues/182)) — real bug surfaced in the already-closed `models.ts`, filed separately

`createRouterSelector()`/`getRouterSelectors()`'s own logic is correct - every derived selector short-circuits to `undefined` when its upstream value is missing, matching `store_router_connecting.service.ts`'s established defensive pattern. But tracing that chain surfaced that `models.ts`'s `RouterStateSelectors<V>` (already reviewed and closed via #160/PR #161) is honestly wrong for 4 fields - `selectQueryParams`, `selectRouteParams`, `selectRouteData`, `selectUrl` are all declared without `| undefined`, the same bug class #160 caught for `selectFragment`, just missed then. Confirmed empirically (a throwaway runtime probe against `{ router: undefined }` returns `undefined` for all four) and against the type system (the existing, passing `spec/types/router_selectors.types.spec.ts` literally asserts the wrong type). Deliberately not touching `createRouterSelector()`'s own return type or the broader `RouterReducerState<any>`-without-undefined convention this module's public API uses throughout - same "concretely-verified mismatch only" scoping as `router_store_config.ts` (#178). Fix tracked as a new sub-issue against `models.ts` + its type-spec.

---

### [`router_store_module.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/router_store_module.ts)

**low · Maintainability** — Fixed via [issue #186](https://github.com/Terrence721/platform-main/issues/186)

`StoreRouterConnectingModule.forRoot()` itself is a correct thin passthrough to `provideRouterStore()` - `EnvironmentProviders` inside `ModuleWithProviders.providers` is a supported Angular pattern (confirmed against `@angular/core`'s real `.d.ts`), and the generic `T` flows through by ordinary inference. But the class's JSDoc claimed "if the invoked reducer throws, the navigation will be canceled" - false. The one test that would prove it (`integration.spec.ts`'s `should support preventing navigation`) is `test.skip`'d, inherited already-skipped from the original upstream import. Didn't take the skip at face value: un-skipped it and ran it in isolation - it fails with a 30s timeout, not the assertion it expects. The reducer's throw surfaces as an uncaught exception deep in the store's reduce pipeline, never as a rejection the navigation promise's `.catch()` sees, so the promise never settles. Root cause: Angular Router's guard/error pipeline (which correctly handles guard-based `ROUTER_CANCEL` and guard/resolver-thrown `ROUTER_ERROR` - both separately tested and passing) has no visibility into `store_router_connecting.service.ts`'s independent `router.events` subscription, so a reducer throwing inside that subscriber's `store.dispatch()` call has no path back to the Router. Reverted the un-skip immediately after confirming. Fix: corrected the JSDoc, added an explanatory comment above the skip in `integration.spec.ts` - left the underlying (inherited, pre-existing) behavior and the skip itself unchanged, since actually cancelling navigation on a reducer throw would need Router visibility this architecture doesn't have.

**Follow-up ([issue #468](https://github.com/Terrence721/platform-main/issues/468), 2026-09-27):** the skipped test this entry kept is gone. It is replaced by `should not cancel navigation when a reducer throws, and report the error as unhandled`, which pins what actually happens: the navigation completes, the error reaches RxJS's unhandled-error hook (not `ErrorHandler`), and the store reduces no further actions (a throwing reducer is fatal in `@ngrx/store`). `router-store` has no skipped test left.

---

### [`serializers/base.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/serializers/base.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #188](https://github.com/Terrence721/platform-main/issues/188))

Smallest file in the module: one interface, one abstract class, no runtime logic. `RouterStateSerializer` is deliberately a class rather than an interface - interfaces erase at compile time and can't serve as `store_router_connecting.service.ts`'s implicit constructor-parameter-type DI token, confirmed load-bearing rather than incidental. Both concrete serializers use `implements` rather than `extends`; checked whether that loses anything - the abstract class has no constructor logic or non-abstract members, so there's nothing to actually inherit, and `instanceof` checks elsewhere work against the concrete classes either way. Confirmed both concrete serializers' state types actually satisfy the `url: string` bound by reading their field declarations directly, not just trusting a clean compile.

---

### [`serializers/full_serializer.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/serializers/full_serializer.ts)

**medium · Correctness** — Fixed via [issue #190](https://github.com/Terrence721/platform-main/issues/190)

`serializeRoute()`'s `component` field was re-derived from `route.routeConfig.component` instead of copying `route.component` directly, unlike every other field in the function. Confirmed against the real installed `@angular/router` source that the Router sets `route.component` directly on the snapshot for `loadComponent`-based lazy routes and never touches `routeConfig.component` for that shape - so the serialized state's `component` was always `undefined` for any lazy-loaded standalone route, a common and increasingly default pattern. Confirmed empirically with a throwaway probe simulating a real `loadComponent` resolution before writing the fix, not just reasoned about. Matters more for `FullRouterStateSerializer` specifically than `MinimalRouterStateSerializer`, which deliberately excludes `component` entirely - Full getting it wrong defeats the entire reason to pick Full over Minimal. Root cause the existing tests missed it: `serializers.spec.ts`'s mock never set a top-level `.component` field distinct from `routeConfig.component`, so the suite couldn't distinguish the two read paths. Fix: `component: route.component`, plus updated the mock and expectations (including removing a now-incorrect `component: undefined` override on the "empty routeConfig" test, since `component` no longer depends on `routeConfig` at all). Checked whether any other file reads a `routeConfig` field this serializer drops - none found.

---

### [`serializers/minimal_serializer.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/serializers/minimal_serializer.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #192](https://github.com/Terrence721/platform-main/issues/192))

Given the sibling file's real bug (`full_serializer.ts`'s `component` re-derived from the wrong object - #190), checked every field here for the same "derived value reads from the wrong source" pattern. Key difference: `MinimalActivatedRouteSnapshot` has no `component` field at all by design - confirmed intentional (matches `store_router_connecting.service.ts`'s own doc comment and the test suite's "not serializable" annotations), so no possible instance of that bug class exists here. Every other field is either a direct `route.X` copy or a narrowing verified against the real `Route.title` type (`string | Type<Resolve<string>> | ResolveFn<string> | undefined`, confirmed against `@angular/router`'s `.d.ts`) - correctly resolves to `undefined`, never `null`, matching `router_selectors.ts`'s identical static-vs-resolved title distinction.

---

### [`store_router_connecting.service.ts`](https://github.com/Terrence721/platform-main/blob/5a04de59b298f57f50a3900ac161199513148af5/modules/router-store/src/store_router_connecting.service.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #194](https://github.com/Terrence721/platform-main/issues/194)) — **last file in `router-store`, 12/12**

The largest, most central file in the module - everything else this audit found traces back to how it actually behaves. Traced the full `RouterTrigger` state machine (`NONE`/`ROUTER`/`STORE`) synchronously through `dispatchRouterAction()`/`navigateIfNeeded()` and confirmed the guards correctly prevent circular re-dispatch in both directions. Checked why `NavigationCancel`/`NavigationError` dispatch unconditionally (unlike the other three event branches, which are gated on `trigger !== STORE`) - confirmed intentional: a store-triggered navigation that fails still needs to notify the store so `reducer.ts`'s cancel/error state-revert (#180) can correct it back to reality. Manually verified all 5 dispatched action payloads against `actions.ts`'s declared types field-by-field, since this file builds `{ type, payload }` literals directly rather than through the typed action creators. Investigated a real-looking `config.routerState` vs `config.serializer` decoupling (a caller can set `serializer: FullRouterStateSerializer` without `routerState: RouterState.Full`, and the event-trimming check only looks at the latter) - concluded intentional per `StoreRouterConfig.routerState`'s own doc comment, which explicitly describes it as independently controlling the dispatched payload's event metadata. Checked the theoretical `this.routerState | null` vs. the non-nullable action payload types - not reachable, since Angular Router guarantees `NavigationStart` (which sets it) always fires before any event that would read it.

No dedicated spec file, but exercised extensively through `integration.spec.ts` (store-triggered vs. router-triggered navigation, guard cancellation/error, `PostActivation` timing, currently-open-URL trailing-slash handling) and `router_store_module.spec.ts`.

---

### [`actions.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/actions.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #196](https://github.com/Terrence721/platform-main/issues/196)) — first file in `store-devtools`

Declarative action-class file (13 action classes, no generics) - a different shape than `router-store`'s `createAction()`-based actions. Confirmed the `All` union matches the 13 declared action-type constants 1:1, and cross-checked every `PerformAction(action, timestamp)` constructor call site (`devtools.ts`, `reducer.ts` x2, `utils.ts`) for argument-order consistency - no drift. `SetActionsActive` looked like a possible dead export at first (never `new`'d anywhere in this module's own `devtools.ts` API, unlike its 12 siblings) - traced it further before flagging: it legitimately arrives as a raw dispatched object from the Redux DevTools browser extension's own UI via `extension.ts`'s `unwrapAction()`, not through this repo's action creators. Could not verify the literal action-type strings against the real Redux DevTools extension protocol - no reference package available locally, and this repo's policy is not to diff against a reference implementation from memory; every constant is at least internally self-consistent.

---

### [`config.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/config.ts)

**low · Correctness** — Fixed via [issue #198](https://github.com/Terrence721/platform-main/issues/198)

`createConfig()`'s `features` computation had two bugs that canceled each other out in the one place they were both reachable, which is why neither was previously observable: (1) when the caller supplied their own `features` object, `features` aliased that same reference rather than copying it, so the `import: true -> 'custom'` normalization a few lines later mutated the caller's own config object; (2) the final `Object.assign({}, DEFAULT_OPTIONS, { features }, options)` put the normalized `{ features }` _before_ `options` in the source list, so `options.features` would clobber it - except it never visibly did, because `features` and `options.features` were the same mutated object, so the "clobber" was a no-op. Confirmed by fixing only the mutation first: it broke the existing `'import "true" is updated to "custom"'` test, since the now-_different_, unmutated `options.features` legitimately won the assign - proving both fixes were required together, not independently optional. Fix: `features` is now always a fresh copy, and the assign order is swapped (`options` before `{ features }`) so the normalized value survives. Deliberately left the `features` fallback chain's wholesale-replace-not-merge behavior alone (a partial caller override still drops the other 9 default flags) - two existing tests explicitly assert that as the expected result, not just fail to catch it; recorded as a structural observation, not a defect.

---

### [`devtools-dispatcher.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/devtools-dispatcher.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #200](https://github.com/Terrence721/platform-main/issues/200))

One line: `class DevtoolsDispatcher extends ActionsSubject {}` - an empty DI-token subclass, same shape as `store`'s own `ReducerManagerDispatcher`, already characterized as a legitimate DI-token case (not an ISP violation) during the module's original addition. Didn't stop at "trivial" - traced why it exists: `provide-store-devtools.ts` re-provides `{ provide: ReducerManagerDispatcher, useExisting: DevtoolsDispatcher }`, overriding `store`'s own default (`useExisting: ActionsSubject`), so with `store-devtools` installed, the `ReducerManager` that drives every state update dispatches through `DevtoolsDispatcher` instead of the main action stream. That's what lets `StoreDevtools` sit between the app's real actions and the reducers - intercepting, lifting, and selectively re-dispatching through `DevtoolsDispatcher` for time-travel/rollback, while `ActionsSubject` stays the unmodified record of what the app actually dispatched. Confirmed deliberate, coherent architecture, not two unrelated empty subclasses that happen to share a shape.

---

### [`devtools.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/devtools.ts)

**low · Maintainability** — Fixed via [issue #202](https://github.com/Terrence721/platform-main/issues/202)

The largest, most central file in the module - `StoreDevtools` merges the app's real dispatched actions (`actions$: ActionsSubject`) with the devtools-internal stream (`dispatcher: DevtoolsDispatcher`) and the browser extension's streams, runs them through `reducer.ts`'s `liftReducerWith()` to build `LiftedState`, and exposes the unlifted result as the `StateObservable` that `provide-store-devtools.ts` substitutes for the app's normal `State` service - the mechanism that lets time-travel/pause/lock actually affect what components see. Traced why `actions$.asObservable().pipe(skip(1))` skips exactly one emission: `ActionsSubject` seeds its `BehaviorSubject` with `{ type: INIT }` at construction, and `dispatcher: DevtoolsDispatcher` (a separate singleton - confirmed `provide-store-devtools.ts` only re-points `ReducerManagerDispatcher`, never plain `ActionsSubject`) carries its _own_ independently-seeded INIT into `liftedAction$` unwrapped; without the skip, `reducer.ts`'s dedicated (fire-once) `case INIT` would trigger twice. That same dispatcher-sourced INIT is load-bearing for `toSignal(unliftedState$, { requireSync: true })`: unlike `state.ts`'s `State` class (which seeds its `BehaviorSubject` with `initialState` directly), this file's `liftedStateSubject` is an unseeded `ReplaySubject(1)`. Wrote a throwaway repro against this repo's installed `rxjs` to confirm `queueScheduler` delivers a scheduled action synchronously (not deferred) when nothing is already draining the queue - it does, so the dispatcher's synchronous INIT reaches `liftedStateSubject.next(...)` before the constructor's later `toSignal()` call subscribes. Fragile-by-construction, verified correct as written. Also verified `injectZoneConfig(config.connectInZone!)`'s non-null assertion is safe (`config.ts` always defaults `connectInZone` to `false`), and that `this.state`'s object literal matches `StateObservable`'s real shape field-for-field.

**One real (minor) finding, fixed:** `NgZone` and `inject` (top-of-file imports) were dead - lint-confirmed and confirmed by reading, neither is referenced in the file body. Both responsibilities now live in `zone-config.ts`'s `injectZoneConfig()`, factored out after these imports were added. Removed; module lint-warning count dropped from 30 to 28 (0 errors either way).

**Follow-up hardening (requested after PR #203 merged):** the two "fragile-by-construction, verified correct as written" mechanisms above were tightened rather than left as-is. `actions$`/`dispatcher` are now both explicitly filtered to exclude `{ type: INIT }` (`filter(isNotInitAction)`), and a single `of(INIT_ACTION)` is merged in directly as the pipeline's one deliberate INIT trigger - `reducer.ts`'s fire-once `case INIT` no longer depends on `dispatcher` incidentally carrying its own seeded INIT past an unrelated `skip(1)` on `actions$`. That same explicit `INIT_ACTION` is what `toSignal(unliftedState$, { requireSync: true })` now synchronously depends on, instead of an unrelated sibling class's constructor behavior. Considered seeding `liftedStateSubject` itself (`ReplaySubject` → `BehaviorSubject(liftedInitialState)`) to remove the `queueScheduler` synchronous-delivery dependency entirely, but `liftedInitialState.computedStates` is `[]` at that point - `utils.ts`'s `unliftState()` would throw (`computedStates[-1]` destructured) if anything ever actually observed that raw seed before the real recompute lands, so this was rejected as trading one fragility for a crash. All 191 tests pass unmodified, including `store.spec.ts`'s `stagedActionIds` equal `[0, 1, 2, 3, 4]` assertion after 4 real dispatches - direct confirmation the filtering swap doesn't change which actions get lifted.

Exercised via `store.spec.ts` (where `StoreDevtools` is actually instantiated and tested - not a separate `devtools.spec.ts`, a naming assumption in this entry's first pass that didn't hold up) plus `integration.spec.ts` and every other spec in the module that dispatches through a real `Store`.

---

### [`extension.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/extension.ts)

**low · Correctness** — Fixed via [issue #205](https://github.com/Terrence721/platform-main/issues/205)

The browser-extension-facing counterpart to `devtools.ts`: `DevtoolsExtension` wraps `window.postMessage`-based `connect()`/`init()`/`subscribe()` behind `actions$`/`liftedActions$`/`start$` observables, and `notify()` is what `devtools.ts`'s `scan` callback calls on every lifted action to push updates back to the extension - either a fast path (just the action + current state, for a plain `PERFORM_ACTION` when not locked/paused/filtered) or a full lifted-state update (everything else). Confirmed the fast path's `isLocked`/`isPaused` early-returns are correct against `reducer.ts`'s own handling of those cases, and that the full-update path deliberately skips that check since non-`PERFORM_ACTION` lifted actions are frequently the devtools UI's own interactions (e.g. `PAUSE_RECORDING` itself) that must be reflected regardless of the state they just caused. Checked the `IMPORT_STATE` handling's `timeout(1000)`/`debounceTime(1000)` race in `createActionStreams()` - both the success and timeout/`catchError` paths resolve to the same value, so the race has no observable effect. Left `unwrapAction()`'s indirect `eval` (for extension-dispatched action strings/args) as-is - by-design for the extension's manual dispatcher, not a vulnerability on an external input surface.

**One real bug, fixed:** the fast path passed `state.nextActionId` as the numeric id argument to a configured `actionSanitizer`. `nextActionId` is the _next_ id to be assigned (`reducer.ts`'s `PERFORM_ACTION` case post-increments it), so it's always one past the id of the action actually being reported - `utils.ts`'s own `unliftAction()` establishes the correct pattern (`nextActionId - 1`) elsewhere in this same file family. The existing test couldn't catch this: `testActionSanitizer(action, id)` in `extension.spec.ts` discards its `id` parameter entirely, so the assertion never actually depended on the value passed - confirmed via a throwaway instrumented build (forced `notify()` to throw with the real value) that the fast path was calling the sanitizer with `id=1` where `0` is correct for the standard test fixture. Notably, the existing test's own expected-value literal already used `testActionSanitizer(createPerformAction().action, 0)` - the original intent was clearly `0`, it just was never enforced. Fixed to `state.nextActionId - 1`, with a new regression test that embeds `id` in the sanitizer's output so the assertion actually discriminates on the value - confirmed it fails against the pre-fix code and passes against the fix.

Exercised via `extension.spec.ts` (the whole file is specifically about this class, 31 tests -> 32) plus `integration.spec.ts`.

**Follow-up, surfaced while reviewing `provide-store-devtools.ts` ([#211](https://github.com/Terrence721/platform-main/issues/211)), fixed via [issue #213](https://github.com/Terrence721/platform-main/issues/213):** `REDUX_DEVTOOLS_EXTENSION`'s `InjectionToken<ReduxDevtoolsExtension>` claimed the resolved value is never `null`, but its own factory (`createReduxDevtoolsExtension()` in `provide-store-devtools.ts`) returns `null` whenever the browser extension isn't installed - the common case. `createIsExtensionOrMonitorPresent`'s own parameter in that same file already typed this correctly as `ReduxDevtoolsExtension | null`, and `DevtoolsExtension`'s own runtime checks (`if (!this.devtoolsExtension)`) were already null-safe - only the declared type lied. Fixed to `InjectionToken<ReduxDevtoolsExtension | null>` plus the matching field/constructor-parameter types. Making the type accurate surfaced three real `TS2531` errors `strict` mode couldn't see before: `this.devtoolsExtension` was referenced inside closures (`sendToReduxDevtools(() => ...)`, `new Observable((subscriber) => ...)`) where a method-level `if (!this.devtoolsExtension) return;` guard's narrowing doesn't cross the function boundary for a mutable class field. Fixed by capturing a locally-narrowed `const devtoolsExtension` after each guard rather than reaching for a non-null assertion.

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/index.ts)

**low · Correctness** — Fixed via [issue #207](https://github.com/Terrence721/platform-main/issues/207)

The public barrel. Same review method as `router-store`'s own `index.ts` (#158/#159, the first barrel-completeness bug this audit found): cross-checked every `export` across all 12 source files against what this file re-exports, looking for a type needed to _use_ an already-exported member that isn't itself exported.

**Two real gaps, both fixed:** `LiftedAction`/`LiftedActions`/`ComputedState` (from `reducer.ts`) are fields of the already-exported `LiftedState` (`StoreDevtools.liftedState: Observable<LiftedState>`, meant for building a custom time-travel UI), so a consumer had no way to name the type of an individual staged action or computed-state entry without a deep import. `ReduxDevtoolsExtension` (from `extension.ts`) is the type parameter of the already-exported `REDUX_DEVTOOLS_EXTENSION` injection token, so a consumer providing or typing a value for that token had the same problem. Scoped the second fix to just the outer interface, not its nested `ReduxDevtoolsExtensionConnection`/`ReduxDevtoolsExtensionConfig` - implementing `connect()`/`send()` inline gets those checked via normal contextual typing without naming them separately.

Deliberately left everything else internal-only: `actions.ts`'s 13 action classes/constants are consumed entirely through `StoreDevtools`'s own public methods (`.reset()`, `.rollback()`, ...), so an app never constructs them directly - cross-checks cleanly against `actions.ts`'s own review (#196). Config-side types (`ActionSanitizer`, `StateSanitizer`, `Predicate`, `SerializationOptions`) and the resolved-config token `STORE_DEVTOOLS_CONFIG` (only the raw `INITIAL_OPTIONS` is public) are only ever consumed as inline properties on the already-exported `StoreDevtoolsConfig`, getting contextual typing without a separate export.

Verified at the type level, not just by reading: confirmed all four newly-exported types actually appear in the built package's rolled-up public `.d.ts` (`dist/modules/store-devtools/types/ngrx-store-devtools.d.ts`), not just in the barrel's own source.

---

### [`instrument.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/instrument.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #209](https://github.com/Terrence721/platform-main/issues/209))

The legacy NgModule entry point: `StoreDevtoolsModule.instrument(options)` returns a `ModuleWithProviders<StoreDevtoolsModule>` wrapping the standalone `provideStoreDevtools()` (already reviewed, no bug). One real line of logic. Didn't stop at "trivial" - verified `provideStoreDevtools()`'s `EnvironmentProviders` return type is actually valid inside `ModuleWithProviders.providers` (not just something that happens to compile), that the default `options: StoreDevtoolsOptions = {}` matches `provideStoreDevtools()`'s own default exactly, and that `@NgModule({})` with no `declarations`/`imports`/`exports` is the correct shape for a providers-only module.

No dedicated spec file, but this is the single most-exercised line in the module: `store.spec.ts`'s shared test-setup helper and `integration.spec.ts` both route every test through `StoreDevtoolsModule.instrument()` rather than `provideStoreDevtools()` directly.

---

### [`provide-store-devtools.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/provide-store-devtools.ts)

**medium · Correctness** — Fixed via [issue #211](https://github.com/Terrence721/platform-main/issues/211)

The module's real entry point: the `EnvironmentProviders` array everything else in this module (`DevtoolsExtension`, `DevtoolsDispatcher`, `StoreDevtools`, and the token overrides that make devtools actually intercept the app's real state/reducer pipeline) gets wired through.

**Real gap, fixed:** `IS_EXTENSION_OR_MONITOR_PRESENT` was provided with a real factory but never injected or read anywhere in this module's source - a full-module grep confirmed it, and `store.spec.ts`'s test-setup helper deliberately overriding it to `true` in every test was the tell that this wasn't intentional dead code. The name says the intent: skip `StoreDevtools`'s lifted-reducer machinery entirely when neither an extension nor a monitor is present, for near-zero overhead in production - exactly what `config.ts`'s own `autoPause` doc comment already promises elsewhere in this module. Wired it up: `createStateObservable()` now branches on the flag, resolving either `StoreDevtools.state` or `@ngrx/store`'s own default `State`, both via lazy `Injector.get()` inside the factory body rather than static `deps` - listing `State` as a static dep in the first pass constructed it unconditionally regardless of branch taken, which silently ran `State`'s own independent, non-error-catching reducer subscription in parallel with devtools' lifted one and broke a real test (an uncaught `ReferenceError` where the error should have been caught and recorded). Added a regression test using `TestBed.overrideProvider(StoreDevtools, { useFactory: () => { throw ... } })` to prove the laziness itself, not just the branching logic.

**Cross-file finding, not fixed here:** `createIsExtensionOrMonitorPresent`'s own parameter (`extension: ReduxDevtoolsExtension | null`) already correctly allows `null`, matching what this file's `createReduxDevtoolsExtension()` actually returns - but `REDUX_DEVTOOLS_EXTENSION`'s `InjectionToken<ReduxDevtoolsExtension>` declaration in the already-closed `extension.ts` (#205) claims otherwise. Filed as a new sub-issue against that file rather than fixed inline.

---

### [`reducer.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/reducer.ts)

**high · Correctness** — Fixed via [issue #215](https://github.com/Terrence721/platform-main/issues/215)

The most complex file in the module - `liftReducerWith()`'s returned reducer is what `devtools.ts` actually runs on every lifted action. Traced every case's history-tracking invariants (`nextActionId`/`stagedActionIds`/`actionsById`/`computedStates` staying mutually consistent) against `store.spec.ts`'s extensive indirect coverage (8 `maxAge option` tests, 6 `pause recording` tests, 2 `Import State` tests) - this file has no dedicated spec of its own.

**One real bug, fixed - and a serious one:** `TOGGLE_ACTION` and `SET_ACTIONS_ACTIVE` both computed `minInvalidatedStateIndex = stagedActionIds.indexOf(actionId)` with no guard for `-1` (reachable whenever the target id is no longer staged, e.g. after `maxAge` auto-commits it away). `-1` flows into `recomputeStates()`'s `for` loop, starting it at `i = -1`, so `stagedActionIds[-1]`/`actionsById[undefined]` are both `undefined` and `.action` on that throws. Not just a devtools-panel bug: `provide-store-devtools.ts` (#211) routes the app's _entire_ live state through this reducer whenever an extension or monitor is present, so this exception can take down the app's whole reactive state stream, not just the history view - and `TOGGLE_ACTION` is reachable from `StoreDevtools.toggleAction(id)`, a public method callable with any id. Found via a guard-asymmetry check: `JUMP_TO_ACTION`'s equivalent `indexOf` call, a few cases later in the same switch, is already correctly guarded (`if (index !== -1) ...`) - the same risk, already handled right next to two siblings that weren't. Confirmed with a standalone repro (`tsx` against the real `liftInitialState`/`liftReducerWith`, bypassing Angular entirely) before touching any code, and again after the fix. Fixed to `Math.max(0, stagedActionIds.indexOf(actionId))`, matching the file's own existing clamping idiom elsewhere (`SWEEP`'s `Math.min(currentStateIndex, stagedActionIds.length - 1)`). Added 2 regression tests to `store.spec.ts` - `SET_ACTIONS_ACTIVE` had zero prior coverage anywhere in the module - confirmed both fail with the exact repro error pre-fix and pass post-fix.

Everything else traced without further findings: `commitExcessActions`'s error-stopping loop (well covered by the `maxAge` suite's clamping/multi-commit tests), `PAUSE_RECORDING`'s placeholder-overwrite mechanics (directly tested), `UPDATE`'s reducer-change signaling and independent per-entry `RECOMPUTE_ACTION` re-derivation, `ROLLBACK` correctly leaving `committedState` untouched (unlike `RESET`) per its own comment, `IMPORT_STATE`'s wholesale replace.

---

### [`utils.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/utils.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #217](https://github.com/Terrence721/platform-main/issues/217))

The shared helpers used by `devtools.ts`/`extension.ts`/`reducer.ts` - most already cross-checked as supporting context in those files' own reviews, but given a dedicated pass here. Confirmed `sanitizeStates()` correctly uses the plain array index (not an action id) for a `StateSanitizer` - unlike `extension.ts`'s `actionSanitizer` bug, this is actually correct since `computedStates` is a dense positional array with no independent id concept. Confirmed `isActionFiltered()`'s safelist/blocklist substring matching (unanchored `.match()`) is deliberate devtools-filter UX, not a bug.

**Two structural observations, not fixed - couldn't confirm either as concretely reachable:** `unliftAction()` is dead code (zero callers anywhere in the module, not in the barrel either) - unlike `IS_EXTENSION_OR_MONITOR_PRESENT`'s strong tell (a test deliberately overriding a token nothing read), nothing here signals an intended-but-missing consumer, so left alone rather than inventing a use case. `filterLiftedState()`'s caller forwards `currentStateIndex` unchanged even though the filtered arrays it returns are shorter - traced whether this is reachable and found `reducer.ts`'s own `PERFORM_ACTION` case already excludes filtered actions from `stagedActionIds` at dispatch time (confirmed via the existing "Filtered actions" tests), so the re-filtering pass has nothing left to remove in the dominant path; couldn't construct a concrete broken scenario without unverifiable assumptions about the real extension's own index handling.

---

### [`zone-config.ts`](https://github.com/Terrence721/platform-main/blob/d94a77a519e8b44ce76d47f0bba9704c0b081229/modules/store-devtools/src/zone-config.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #223](https://github.com/Terrence721/platform-main/issues/223))

Smallest file in the module: a discriminated union (`ZoneConfig`) plus `injectZoneConfig()`, which conditionally calls `inject(NgZone)` and returns the matching variant. Verified the `as ZoneConfig` cast is a legitimate, narrow assertion (TypeScript can't statically narrow a plain runtime `boolean` to the union on its own, even though the function's logic genuinely guarantees the invariant). Re-checked `devtools.ts`'s `emitInZone()` (this type's only real consumer) for a subscription leak - `new Observable<T>((subscriber) => source.subscribe({...}))` looked at first glance like it might drop the inner subscription on unsubscribe, since the callback body has no explicit `return`; it doesn't leak, since the concise-body arrow function implicitly returns `source.subscribe({...})`'s own `Subscription` as valid teardown logic. Worth double-checking rather than assuming, but confirmed correct.

**One coverage gap noted, not fixed:** every test fixture across the module sets `connectInZone: false`, so `injectZoneConfig`'s `connectInZone: true` branch (the one that actually calls `inject(NgZone)`) has no direct test coverage anywhere. Low risk (`NgZone` is a core, always-available Angular service, and `emitInZone`'s zone-wrapping logic was independently re-verified above), so left as an observation.

This completes the `store-devtools` module: **11/11 files reviewed, 6 real bugs found and fixed** (`config.ts`'s mutation bug, `extension.ts`'s sanitizer-id off-by-one, `index.ts`'s missing barrel exports, `provide-store-devtools.ts`'s unwired `IS_EXTENSION_OR_MONITOR_PRESENT`, `extension.ts`'s follow-up nullable-token fix, `reducer.ts`'s `TOGGLE_ACTION`/`SET_ACTIONS_ACTIVE` crash), plus 1 minor cleanup (`devtools.ts`'s dead imports).

---

### [`debounce-sync.ts`](https://github.com/Terrence721/platform-main/blob/122f86a561d860f697cfe5b0f52c7f546e3e6a15/modules/component-store/src/debounce-sync.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #226](https://github.com/Terrence721/platform-main/issues/226))

First file in the `component-store` module. `debounceSync<T>()` is a custom RxJS operator that collapses any number of synchronous `next()` calls into a single emission of the latest value via `asapScheduler` — a microtask-boundary debounce, not time-based; used internally by `ComponentStore.select(..., { debounce: true })`. The non-obvious piece: if the source completes while an `asapScheduler` job is still pending, the `complete` handler emits the pending value synchronously and calls `observer.complete()`, relying on RxJS's `Subscriber` automatically tearing down the returned `rootSubscription` (and thus cancelling the still-pending job) immediately afterward, so it never double-emits. Didn't just reason through this — wrote a throwaway repro against the real installed `rxjs` (a `Subject` and real microtask timing, not virtual/marble time) covering three cases: multiple synchronous `next()` calls collapsing to the latest value, completion-while-pending emitting exactly once, and completion-with-nothing-pending emitting nothing extra. All three matched.

**One real gap, fixed:** zero dedicated test coverage existed for this operator — only indirect exercise through `ComponentStore`'s own `select(..., { debounce: true })` tests, which never isolate the completion-cancellation edge case. Added `modules/component-store/spec/debounce-sync.spec.ts` encoding the same three scenarios (plus error propagation) as real regression tests against the operator directly.

---

### [`lifecycle_hooks.ts`](https://github.com/Terrence721/platform-main/blob/122f86a561d860f697cfe5b0f52c7f546e3e6a15/modules/component-store/src/lifecycle_hooks.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #228](https://github.com/Terrence721/platform-main/issues/228))

`provideComponentStore()` — the `OnStoreInit`/`OnStateInit` lifecycle-hook wiring. Registers the store class under a fresh, locally-scoped `InjectionToken`, then re-provides the class itself via a factory that resolves that token, marks the instance's private `ɵhasProvider` flag, and runs the hooks (`ngrxOnStoreInit()` synchronously, `ngrxOnStateInit()` once `state$` first emits). Traced the cross-file interaction with `component-store.ts`'s `checkProviderForHooks()` (an `asapScheduler`-deferred dev-mode warning for hooks defined without this provider) and confirmed the ordering is correct by construction, not luck: the factory's synchronous `ɵhasProvider = true` assignment always completes before the scheduled microtask check can run. Also confirmed `CS_WITH_HOOKS` being declared _inside_ the function (not module-level) is what lets two separate `provideComponentStore()` calls in the same injector coexist without colliding — not an accident of the existing multi-store test happening to pass.

**No bug found. No coverage gap** — `component-store.spec.ts`'s `LifecycleStore` block already covers eager/lazy state init, hook-called-once, multi-store composition, and both the warning and no-warning `ɵhasProvider` paths.

---

### [`component-store.ts`](https://github.com/Terrence721/platform-main/blob/b9ffef9bae6312ccd352fb63bfcdce97db0562ce/modules/component-store/src/component-store.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #230](https://github.com/Terrence721/platform-main/issues/230))

The largest, most central file in the module — the `ComponentStore<T>` class itself. `updater()`'s sync-error-capture pattern (an `isSyncUpdate` flag flipped only after `.subscribe()` returns) relies on `observeOn(queueScheduler)` delivering synchronously for a synchronous source, the same mechanism already confirmed real via a throwaway repro during `store-devtools`'s `devtools.ts` review - held up again here. `select()`'s multi-overload dispatch (`processSelectorArgs()`/`hasProjectFnOnly()`/`combineLatest()`) is the file's most complex logic; worked through all four call shapes by hand and specifically verified the "entire state is itself an array" edge case the file's own comment calls out - the `.length > 0` guard is checked on the _selectors array_, not the emitted value, which is exactly what prevents a `ComponentStore<string[]>`'s raw state from being misinterpreted as multiple projector arguments. `get()`'s reliance on `ReplaySubject`'s synchronous replay-to-new-subscriber behavior (no scheduler passed to its constructor) confirmed safe. `effect()` subscribing its generator with no error handler (an unhandled error permanently stops that effect responding to further dispatches) is documented upstream behavior, not a defect - same category as `effects`' own audited "correctness-critical by design" findings. Also confirmed `throwError(error)`'s raw-value form (deprecated but not removed in RxJS 7) still delivers correctly at runtime with the installed `rxjs@7.8.2`, via a real throwaway repro forcing an error through it - not a bug, and this repo's lint config doesn't flag the deprecation either. Checked every state-reading/writing path for the "guard asymmetry" bug pattern that recurred across `store`'s and `store-devtools`'s findings; all consistently gated by `assertStateIsInitialized()`, no gap found.

**No bug found. No coverage gap** — `component-store.spec.ts` (~2000 lines) already has dedicated coverage for essentially every method reviewed here.

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/e48eb7a523d7dbd1218959190a836b86906096da/modules/component-store/src/index.ts)

**low · Maintainability** — Fixed via [issue #232](https://github.com/Terrence721/platform-main/issues/232)

The public barrel, reviewed last per this audit's established pattern. Applied the same method used for `router-store`'s and `store-devtools`'s own `index.ts` reviews: cross-check every source file's exports against the barrel for a type needed to _use_ an already-exported member but not itself reachable.

**Real gap, fixed:** `component-store.ts`'s `selectSignal()` (a public method on the exported `ComponentStore` class) takes `SelectSignalOptions<Result>` and `SignalsProjector<Signals, Result>` directly in its public overload signatures, but neither type had an `export` keyword at all - so they never flowed through the barrel's `export *`. Confirmed real and reachable with a throwaway repro: importing either type from the module's public entry point failed with `TS2305: has no exported member` before the fix, compiled clean after adding `export` to both declarations. Verified at the type level, not just by reading - confirmed both now appear in the built package's rolled-up public `.d.ts`. Deliberately left unexported: `debounceSync` (never appears in a public signature, only used internally via `select()`'s boolean `debounce` flag) and `isOnStoreInitDefined`/`isOnStateInitDefined` (internal predicates used only by `provideComponentStore()`/`checkProviderForHooks()`, never part of any exported member's public signature) - neither matches the "needed to use an already-exported member" pattern the way `SelectSignalOptions`/`SignalsProjector` do.

This completes the `component-store` module: **4/4 files reviewed, 1 real gap found and fixed** (the `selectSignal()` barrel-export gap), no other bugs.

---

### [`potential-observable.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/core/potential-observable.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #234](https://github.com/Terrence721/platform-main/issues/234))

First file in the `component` module — picked next after `component-store` closed since it directly depends on it. `fromPotentialObservable<PO>()` normalizes four input shapes (an Observable, a dictionary of named Observables, a Promise-like, or any other plain value) into a real `Observable`. Checked the type-level `PotentialObservableResult<PO, ExtendedResult>` conditional type against the runtime branches for the declared-vs-actual-behavior divergence that recurred across `router-store`'s findings - none found; the runtime has no explicit "is Primitive" check, but primitives simply fall through to the same shared plain-value-wrap branch the type's separate `Primitive` case also resolves to. The plain-value branch's `new Observable(...)` never calling `.complete()` looked like a possible bug at first glance - confirmed deliberate instead: the existing marble tests explicitly assert no completion marker for every non-observable input, consistent with how the other three branches also never force premature completion. Hand-traced `toDistinctObsDictionary()`'s `distinctUntilChanged()`-before-`combineLatest` interaction frame-by-frame against the existing dictionary-combination marble test and confirmed a source's duplicate emission is genuinely suppressed before reaching `combineLatest`, not just assumed from reading the code.

**No bug found. No coverage gap** — existing marble-test coverage already exercises every branch and the subtler distinct-filtering/non-completion behaviors.

---

### [`models.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/core/render-event/models.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #236](https://github.com/Terrence721/platform-main/issues/236))

A discriminated union (`RenderEvent<T>`) of four render-lifecycle events, each extending a base `reset`/`synchronous` boolean pair. `SuspenseRenderEvent` narrows both to literal `true` — a real contract, not just documentation. Pure type declarations with zero runtime code, so traced forward to the one place it's actually constructed (`manager.ts`'s `switchMapToRenderEvent()`, not yet reviewed on its own) to check for the declared-narrower-type-vs-actual-construction divergence that recurred across `router-store`'s findings. None found — the construction site is gated exactly by the condition (`if (reset)`) that proves `reset` is `true` there, and `synchronous: true` is written as a literal rather than the variable, consistent with the declared type rather than accidental.

**No bug found. No coverage gap** — no dedicated spec needed for a pure-type file; correctness validated through the construction-site trace plus existing indirect coverage.

---

### [`handlers.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/core/render-event/handlers.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #238](https://github.com/Terrence721/platform-main/issues/238))

`combineRenderEventHandlers<T>()` dispatches a `RenderEvent<T>` to the matching optional handler by property name (`handlers[event.type]?.(event as any)`). The `as any` cast is necessary and legitimate, not a shortcut around a real bug — TypeScript can't statically correlate a dynamically-indexed lookup's function type with `event`'s actual narrowed type at that call site, even though the runtime correspondence (each handler's property name matches its event's `type` discriminant exactly) is genuinely sound. Already traced this once during `models.ts`'s review when checking `SuspenseRenderEvent`'s construction path; re-verified here as this file's own primary subject.

**No bug found. No coverage gap** — `handlers.spec.ts` already tests all 4 event types × 2 cases each (correct handler called with the correct event; no throw when undefined), 8 tests total.

---

### [`manager.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/core/render-event/manager.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #240](https://github.com/Terrence721/platform-main/issues/240))

The largest, most central file so far in this module — orchestrates `potential-observable.ts` and `render-event/{models,handlers}.ts` together via `createRenderEventManager<PO>()`. `renderEventComparator()`'s `distinctUntilChanged` deliberately excludes `synchronous` from its equality check — confirmed correct, not an oversight: if `type`/`reset`/`value` (or `error`) are unchanged there's nothing new to render, so whether a filtered-out duplicate would have carried `synchronous: true` or `false` doesn't matter. The `untracked(() => observable$.subscribe(...))` wrapper has no dedicated test for its actual Angular-signal-interaction purpose — checked its only current caller (`let.directive.ts`'s `ngOnInit()`, a plain lifecycle hook, not itself a reactive scope) and read this as defensive design for a shared utility that doesn't control its caller's context, not a bug or an actionable gap absent concrete evidence it's needed or missing (same bar `component-store`'s `utils.ts` review used for a similarly-plausible-but-unconfirmed wiring question).

**No bug found. No coverage gap** — the existing `manager.spec.ts` (30 tests) is unusually thorough, covering every combination of sync/async timing, next/error/complete, and both dedup layers.

**Revisited, medium · Correctness** — Fixed via [issue #252](https://github.com/Terrence721/platform-main/issues/252) — surfaced during `push.pipe.ts`'s review ([#250](https://github.com/Terrence721/platform-main/issues/250))

The "both dedup layers" above turned out to include a real one: `renderEventComparator()` deduped consecutive `error` render events by comparing `.error` values, the same way it dedupes `next`. But `error` is a terminal RxJS notification — a single subscription can emit it at most once — so two consecutive `error` events can only ever come from two _different_ switched-to sources, never a legitimate repeat the way `next` values can repeat from one still-active subscription. When two different sources happened to error with an equal value back-to-back, the second source's render event was silently deduped — and both consumers (`let.directive.ts`, `push.pipe.ts`) call `errorHandler.handleError()` unconditionally inside their `error` handler, so the second source's genuinely distinct failure was never reported. Confirmed with a throwaway repro (two `throwError(() => 'X')` sources back-to-back invoked the handler once instead of twice; a control case with _different_ error values invoked it twice as expected). This exact behavior was locked in by an existing test — initially read as deliberate (matching parallel `complete`/`suspense` dedup tests), but on reflection it was a design mistake baked into its own test: `complete`/`suspense` are also terminal, but neither consumer ties a per-occurrence side effect to a repeat of those the way `error`'s unconditional handler call does. Fix: `error` events are now always treated as distinct in the comparator (never deduped), regardless of value. Deliberately left `complete`/`suspense` deduping untouched — no verified problem there to fix.

---

### [`tick-scheduler.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/core/tick-scheduler.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #242](https://github.com/Terrence721/platform-main/issues/242))

A DI-factory-selected abstraction (`NoopTickScheduler` for real Zone.js apps, `ZonelessTickScheduler` for zoneless ones), branching on `isNgZone(zone)` (`zone instanceof NgZone`, from `zone-helpers.ts`, not yet reviewed on its own). Verified this `instanceof` check against the actual installed `@angular/core` source rather than assuming: `NoopNgZone` (what real zoneless mode provides for the `NgZone` token, confirmed via `provideZonelessChangeDetectionInternal()`'s `{ provide: NgZone, useClass: NoopNgZone }`) is a plain class with no `extends NgZone` — so the check is correct by construction for both real and zoneless apps, not by luck. The test fixture (`MockNoopNgZone`) faithfully mirrors this same plain-class shape.

**No bug found. No coverage gap** — 11 existing tests cover the DI-factory branching, coalescing (sync, microtask-queued, and multi-async calls), the browser-vs-SSR scheduling choice, and a `this`-binding safety check.

---

### [`zone-helpers.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/core/zone-helpers.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #244](https://github.com/Terrence721/platform-main/issues/244))

A single type guard: `isNgZone(zone): zone is NgZone { return zone instanceof NgZone; }` — the exact check already fully verified against the real installed `@angular/core` source during `tick-scheduler.ts`'s review (#242), this file's own primary caller.

**No bug found. No coverage gap** — `zone-helpers.spec.ts` directly tests both branches with the same faithful fixtures.

---

### [`render-scheduler.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/core/render-scheduler.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #246](https://github.com/Terrence721/platform-main/issues/246))

`RenderScheduler.schedule()` delegates to `cdRef.markForCheck()` and the already-reviewed `tickScheduler.schedule()`; call order between the two doesn't matter since the tick's real effect is always deferred. `createRenderScheduler()` (a standalone `inject()`-based factory, separate from the class's own constructor shape) looked like it might be dead/unwired code at first — traced it and confirmed `push/push.pipe.ts` (not yet reviewed) genuinely needs it as a field-initializer factory, a different construction shape than `let.directive.ts`'s plain constructor injection.

**No bug found. No coverage gap** — existing tests cover both injection-context cases for `createRenderScheduler()` (including the expected throw outside one) plus `schedule()`'s delegation.

---

### [`let.directive.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/let/let.directive.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #248](https://github.com/Terrence721/platform-main/issues/248))

The `*ngrxLet` structural directive, the primary consumer of `createRenderEventManager` (#240) and `RenderScheduler` (#246). Traced three things end-to-end: the `next`/`error`/`complete` handlers' reset/synchronous handling is structurally symmetric (no `store`-style entry-point-guard asymmetry); the reentrancy case exercised by the existing recursive-directive test is correctly guarded because `isMainViewCreated` is set _before_ `createEmbeddedView` runs, so a synchronous re-emission during view creation only mutates `viewContext` in place instead of double-creating a view; and `SuspenseRenderEvent.synchronous` being statically `true` matches the runtime flow, since a suspense event can only be the first event after a `switchMap` resubscribe, which itself happens inside an Angular-initiated change-detection pass — which is why `renderSuspenseView()` never needs a `renderScheduler.schedule()` call, unlike `renderMainView()`. A stray `NG0406` stderr line during this file's spec run turned out to reproduce identically from `tick-scheduler.spec.ts` alone (already closed, #242) — pre-existing harness noise, not caused by this file.

**No bug found. No coverage gap** — `let.directive.spec.ts` (38 tests) covers next/error/complete/suspense/suspense-template/the recursion edge case/observable-dictionary inputs; `let.directive.types.spec.ts` (17 tests) covers `ngTemplateContextGuard`'s type inference.

---

### [`push.pipe.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/push/push.pipe.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #250](https://github.com/Terrence721/platform-main/issues/250)) — real bug surfaced in the already-closed `manager.ts`, filed separately

The `ngrxPush` impure pipe, a `PipeTransform` sibling to `let.directive.ts` (#248) sharing the same render-event machinery (#240) but rendering a single returned value instead of a multi-field view context. Investigated a plausible-looking bug hard enough to write a throwaway repro for: since `error`/`complete` are terminal RxJS notifications, two consecutive same-type render events can only come from two _different_ switched-to sources, so `manager.ts`'s `distinctUntilChanged(renderEventComparator)` deduping them by value looked like it could swallow a genuinely new error's `errorHandler.handleError()` call. Reproduced it — it does suppress the second call. `manager.spec.ts` already had three explicit tests asserting exactly this as intended, symmetrically for error/complete/suspense — initially read as deliberate anti-duplicate-report design and left alone. On revisiting, that read was wrong: `error`'s unconditional handler call is exactly the kind of per-occurrence signal that must never be silently dropped, unlike `complete`/`suspense` which carry no such side effect. Fix tracked as a new sub-issue against `manager.ts` (see its own entry, #252).

**No bug found in this file. No coverage gap** — `push.pipe.spec.ts` (50 tests) and `push.pipe.types.spec.ts` (17 tests) cover next/error/complete/suspense/the signal-untracked-subscription case/observable-dictionary inputs.

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/f97d612ce90734c230722cac21adc4a1841e3399/modules/component/src/index.ts)

**low · Maintainability** — Fixed via [issue #254](https://github.com/Terrence721/platform-main/issues/254)

The module's public API barrel, 3 lines. Same cross-check method as this audit's other `index.ts` reviews (`router-store`'s #158/#159, `store-devtools`'s #207/#208, `component-store`'s #232/#233): check every already-exported member's own public signature for a type it names but the barrel doesn't re-export. **Two real gaps, fixed:** `LetDirective.ngTemplateContextGuard()`'s public return type names `LetViewContext<PO>` directly — already `export`ed from `let.directive.ts` itself, just never reached the barrel; and `PushPipe.transform()`'s return type names `PushPipeResult<PO>`, which wasn't even `export`ed from `push.pipe.ts` — a deeper gap, since `PushPipe` is documented and spec-tested as usable directly as an injectable service (not just via the template pipe), so a consumer calling `.transform()` in application code had no way to name their own variable's type. Verified at the type level: rebuilt the package and confirmed both types now appear in a real `export type { LetViewContext, PushPipeResult };` line in the rolled-up `dist/modules/component/types/ngrx-component.d.ts`, where neither appeared in any export statement before. Deliberately left `PotentialObservableResult`, `LetViewContextValue`, `TickScheduler`, and every `render-event/*` type unexported — none is the literal type name in an already-exported member's own signature, just resolved structurally one or more levels deeper, the same "contextual typing doesn't need a name" scoping already used for `store-devtools`'s `ReduxDevtoolsExtensionConnection`/`ReduxDevtoolsExtensionConfig`.

This completes the `component` module: **10/10 files reviewed, 1 real bug found and fixed** (the cross-file `manager.ts` error-dedup fix, #252 — discovered during `push.pipe.ts`'s review, also silently fixed the identical bug in `let.directive.ts`) **plus 2 barrel-export gaps fixed** (this file). 7 files confirmed clean with no findings at all.

---

### [`concat_latest_from.ts`](https://github.com/Terrence721/platform-main/blob/fad941cb2e2cc6aee14f97bd7d40329284c86385/modules/operators/src/concat_latest_from.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #256](https://github.com/Terrence721/platform-main/issues/256))

`concatLatestFrom` — combines each source value with the lazily-evaluated, freshly-subscribed latest value(s) from other observables, the documented alternative to a naive `withLatestFrom(store.select(...))` that subscribes once up front and never re-evaluates. Traced the `concatMap` + `of(value).pipe(withLatestFrom(...))` mechanism end to end: each source emission gets a fresh `observablesFactory(value)` call, fresh subscriptions, and immediate teardown — confirmed by the existing spec's laziness tests. `withLatestFrom`'s "requires every combined source to have emitted before it emits" characteristic matches the documented synchronous-selector use case, not a bug.

Investigated one thing hard enough to write throwaway type probes for: the file's own comment claims the array overload needs to come first "to maintain the proper order in the resulting tuple." Tested single/2-array/1-array factory shapes against both the real overload order and a scratch copy with them swapped — all cases resolved identically either way (array and single-observable types are structurally disjoint, so there's no real ambiguity for TypeScript to resolve). Inconclusive whether the comment is stale or guards an edge case the probes didn't hit, but found no verified mismatch to fix — also the exact question this module's deferred type-level-test-coverage issue (#171, under #162) exists to eventually cover; #162's own scope note keeps that deferred unless a review finds a real declared-vs-actual mismatch, which this wasn't.

**No bug found. No coverage gap** — `concat_latest_from.spec.ts` (8 marble tests) covers laziness, evaluation-on-trigger, and order preservation for both the array and single-observable forms.

---

### [`map-response.ts`](https://github.com/Terrence721/platform-main/blob/fad941cb2e2cc6aee14f97bd7d40329284c86385/modules/operators/src/map-response.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #258](https://github.com/Terrence721/platform-main/issues/258))

`mapResponse` — maps a source observable's `next`/error notifications into `R1`/`R2` values, the standard NgRx Effects "turn an HTTP call into a success or failure action" pattern. Checked something that looked like a real bug before trusting the existing tests: `catchError` sits after `map`, so it catches not only errors from the source but also a synchronous throw from the caller's own `next` mapper — before flagging it, checked the spec and found `'should map the error thrown in next callback using error callback'` proving this is deliberate, tested behavior (same "check for an existing test before treating a repro as a bug" discipline from `push.pipe.ts`'s review, #250). Traced the operator's real purpose too: `'should not unsubscribe from outer observable on inner observable error'` confirms wrapping the error path in `of(...)` keeps an outer Effects-composition observable alive when this operator's own source errors.

**No bug found. No coverage gap** — `map-response.spec.ts` (4 tests) covers next-mapping, error-mapping from the source, error-mapping from a throwing next-callback, and outer-stream survival.

---

### [`tap-response.ts`](https://github.com/Terrence721/platform-main/blob/fad941cb2e2cc6aee14f97bd7d40329284c86385/modules/operators/src/tap-response.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #260](https://github.com/Terrence721/platform-main/issues/260))

`tapResponse` — `mapResponse`'s sibling for side effects instead of value mapping, primarily documented for `@ngrx/component-store` effects. Same `catchError`-also-catches-a-throwing-`next`-callback design, confirmed deliberate via existing tests the same way. Noticed a minor internal-consistency wrinkle, not a bug: `tap({ next: observer.next, complete: observer.complete })` passes bare function references (detached from `observer` as `this`), unlike the file's own `catchError` handler and `mapResponse`'s handlers, which all use method-call syntax. Only matters for a caller's real `this`-dependent method rather than the documented arrow-function pattern — no concrete reachable bug, left alone.

**No bug found. No coverage gap** — `tap-response.spec.ts` (7 tests) covers next/error/complete/finalize in every combination; `tap-response.types.spec.ts` (3 tests) covers required handlers and `E`'s `unknown` default.

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/fad941cb2e2cc6aee14f97bd7d40329284c86385/modules/operators/src/index.ts)

**low · Maintainability** — Fixed via [issue #262](https://github.com/Terrence721/platform-main/issues/262)

The module's public API barrel, 3 lines. Same cross-check method as every other `index.ts` review in this audit. **Two real gaps, fixed** — the same class of gap as `component`'s `PushPipeResult` (#254): `mapResponse`'s and `tapResponse`'s `observer` parameters are each typed by a local type alias (`MapResponseObserver`, `TapResponseObserver`) that wasn't `export`ed even from its own file. Added `export` to both aliases and re-exported through the barrel. Verified at the type level: rebuilt the package and confirmed both types now appear in a real `export type { MapResponseObserver, TapResponseObserver };` line in the rolled-up `.d.ts`, where neither appeared in any export statement before.

This completes the `operators` module: **4/4 files reviewed, 0 real bugs, 2 barrel-export gaps fixed** (this file). All 3 other files' own logic checked out clean.

---

### [`libs-version.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/libs-version.ts)

**low · Maintainability** — Fixed via [issue #269](https://github.com/Terrence721/platform-main/issues/269)

First file in `schematics-core`, which has zero test infrastructure of its own — every file here is exercised only indirectly through the 10 `ng-add` schematics in `modules/schematics` that import from it. This file is one exported constant, `platformVersion` — traced its usage before assuming a one-liner couldn't hide a real bug: it's the exact version string every one of those 10 `ng-add` schematics writes into a real consumer's `package.json` for the `@ngrx/*` package being added. **Real bug, fixed**: the value was `'^22.0.0-rc.0'`, a stale prerelease-tagged floor never updated when this repo's own `@angular/core` moved from the Angular 22 RC period to stable (`22.1.4` now, several patch bumps ago). Confirmed empirically via `node-semver` this never broke dependency resolution (`22.1.4` and `semver.maxSatisfying` both correctly resolve through a prerelease-tagged floor to the latest stable version — prerelease tags only restrict _other prereleases_ from matching), so it's a genuine "forgot to update" gap rather than a functional break. Noted, not fixed here: none of the 10 `ng-add` spec files assert on the actual version value written (only `toBeDefined()`) — that coverage gap lives in the `schematics` module, left for its own future review.

**Fix**: `'^22.0.0-rc.0'` → `'^22.0.0'`.

Verified: `npx nx run schematics:lint` (0 errors), `npx vitest run modules/schematics/ng-add` (all 10 `ng-add` consumers plus `src/ng-add`, 24 files / 162 tests, all passing).

---

### [`json-utils.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/json-utils.ts)

**low · Maintainability** — Fixed via [issue #272](https://github.com/Terrence721/platform-main/issues/272)

A single small utility, `findPropertyInAstObject`, carried over from Angular CLI's own schematics tooling. Confirmed its "return the last matching property, don't break early" behavior is correct, not a bug — it mirrors real JS object-literal semantics (a later duplicate key wins). **Real issue, fixed**: the file itself was misnamed — `json-utilts.ts` is a typo for `json-utils.ts` (transposed letters). Checked the blast radius before renaming (one reference outside its own file, the barrel export) and updated it. Exported but never called anywhere in this repo, not even indirectly — not flagged as dead code, matching `libs-version.ts`'s (#269) reasoning: a shared AST-utility toolkit legitimately exports more than what this repo's own `ng-add` schematics happen to use.

**Also fixed, repo-wide but discovered here**: `modules/schematics/**/__snapshots__/*.snap` files kept showing as modified after every test run with zero real content difference (confirmed via `git diff`). No `.gitattributes` existed anywhere in the repo, so these LF-written snapshot files were subject to plain `core.autocrlf` round-trip churn on Windows. Added a scoped `*.snap text eol=lf` rule and renormalized — verified clean by re-running the affected specs.

Verified: `npx nx run schematics-core:lint` (0 errors), `npx nx run schematics-core:build` (clean), `npx vitest run modules/schematics` (50 files / 396 tests, all passing).

---

### [`parse-name.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/parse-name.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #275](https://github.com/Terrence721/platform-main/issues/275))

`parseName(path, name)` splits a schematic's `--name` option into `{ name, path }`. Small but high-stakes: used by 13 files across `ng-add` and every code-generator schematic, and its return value feeds directly into `move(parsedPath.path)` — the actual filesystem destination generated files get written to. Verified empirically against the real installed `@angular-devkit/core` rather than just reading it: a throwaway probe covering a plain name, a nested `sub/name`, an empty `path`, a trailing slash on `path`, `./name`, and `../name` all produced correct results, including the double-slash-normalizes-away and parent-directory-traversal cases most likely to hide a subtle bug.

**No bug found. No coverage gap** — `schematics-core` has no test infrastructure of its own, but this function is genuinely, transitively covered: all 13 consumers' own spec files assert on the resulting generated-file paths directly, which would catch a regression here through its real consumer.

---

### [`update.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/update.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #277](https://github.com/Terrence721/platform-main/issues/277))

`updatePackage(name)` rewrites `@ngrx/{name}`'s version in a consumer's `package.json` to `6.0.0`, preserving a `^`/`~` prefix if present. The hardcoded `6.0.0` looked suspicious at first — checked every consumer before assuming a bug: it's called exclusively from `migrations/6_0_0/index.ts` across 6 modules, and a version-specific `ng update` migration hardcoding its own target version is correct by design, not stale. (`migrations/` folders themselves are out of scope for this audit per #106, but this file lives in `schematics-core/utility/`, not inside a `migrations/` folder, so it's in scope regardless of what consumes it.)

**No bug found. No coverage gap** — confirmed genuinely thorough transitive coverage: 6 migration specs (one per consumer module) each iterate the shared test helper's `versionPrefixes = ['~', '^', '']` and run the real schematic via `SchematicTestRunner`, asserting the exact resulting version string — covering every branch this file's prefix logic has.

---

### [`package.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/package.ts)

**low · Test Coverage** — Fixed via [issue #279](https://github.com/Terrence721/platform-main/issues/279)

`addPackageToPackageJson(host, type, pkg, version)` writes a dependency entry into a consumer's `package.json`: creates the `dependencies`/`devDependencies` section with `Object.create(null)` if it's missing, and only writes when the package isn't already present (never clobbers an existing pin). It also carries an explicit `isUnsafeObjectKey()` guard — refusing `__proto__`/`constructor`/`prototype` as either the `type` or `pkg` key — added in a dedicated prior commit (`b77bcc6`) specifically to satisfy a CodeQL prototype-pollution finding. Traced all 13 real call sites (10 `ng-add` schematics, `store`'s second call for `@ngrx/eslint-plugin`, and 2 `18_0_0-beta` migrations) before assuming the guard was actually reachable: every one passes a hardcoded string literal for both `type` and `pkg` — none is schema-driven or otherwise attacker-influenced today — so the guard is defense-in-depth, not a live path that needs it.

**No bug found. Real coverage gap, fixed** — same "zero test infrastructure of its own" characteristic as every other file in this module (see `libs-version.ts`, #269): the normal write path was already transitively covered (`modules/schematics/ng-add/store/index.spec.ts`'s "should update package.json" / "should skip package.json update" tests), but the `isUnsafeObjectKey` throw branch was exercised by nothing in the suite — no caller anywhere ever passes an unsafe key, so nothing would have caught a future refactor accidentally weakening or removing this guard until CodeQL re-scanned `main` after the fact. Rather than leave the note-only precedent set at `libs-version.ts` stand for a security-critical guard, gave `schematics-core` its own test infrastructure — `vitest.config.mts`, `tsconfig.json`/`tsconfig.spec.json`, `test-setup.ts`, and a `test` target in `project.json`, all mirroring the existing `operators`/`schematics` modules — plus a new `utility/package.spec.ts` with 10 direct unit tests: writes a new package, creates a missing section, refuses to overwrite an already-pinned version, no-ops when `package.json` doesn't exist, and (the point of the exercise) throws for `__proto__`/`constructor`/`prototype` as either the `type` or `pkg` argument.

**Fix**: added `modules/schematics-core/{vitest.config.mts,tsconfig.json,tsconfig.spec.json,test-setup.ts}` and a `test` target in `project.json`, plus `utility/package.spec.ts`.

Verified: `npx nx run schematics-core:lint` (0 errors), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (2 files / 16 tests, all passing, 0 type errors), `npx vitest run modules/schematics/ng-add modules/effects/migrations/18_0_0-beta modules/component-store/migrations/18_0_0-beta` (28 files / 194 tests, all passing — one prior run flagged 5 failures across 7 files, but a clean re-run with an unchanged working tree confirmed that was transient flakiness, not a regression).

---

### [`project.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/project.ts)

**low · Correctness** — Fixed via [issue #281](https://github.com/Terrence721/platform-main/issues/281)

Four small workspace-resolution helpers: `getProject` reads the target project out of `angular.json` (falling back to `defaultProject`, then the first project key, when `--project` isn't given); `getProjectPath` derives a project's default source path; `isLib` and `getProjectMainFile` branch on `projectType` and read the real entry point (`browser` for the modern application builder, `main` for the legacy one).

**Real bug, fixed**: `getProject` looked up `workspace.projects[options.project]` and returned whatever it found — including `undefined` when `--project` names something that isn't in the workspace. Every one of the 10 `ng-add` schematics exposes `project` as a plain, unvalidated `--project`/`-p` string flag (no `$default: {"$source": "projectName"}` in any of their `schema.json`s), so a real user typo reaches this code path with nothing upstream to catch it. The `undefined` then propagated into `getProjectPath`/`isLib`/`getProjectMainFile`, each of which immediately dereferences a property on it (`project.root`, `project.projectType`, `project.architect`) — turning a routine typo into an opaque `TypeError: Cannot read properties of undefined (reading 'root')` instead of a message that says what's actually wrong.

**Fix**: `getProject` now throws a `SchematicsException` — `Project '<name>' does not exist.` — the moment the lookup comes back empty, instead of letting `undefined` leak out to whichever caller happens to dereference it first.

Also gave this file its own direct spec — `modules/schematics-core/utility/project.spec.ts`, 13 tests covering `getProject`'s name/defaultProject/first-project resolution and the new not-found throw, `getProjectPath`'s trailing-slash trim and app/lib path defaulting, `isLib`, and both entry-point branches of `getProjectMainFile` — the first file in this module to get direct coverage now that `schematics-core` has its own test infrastructure (#279). Caught a real, environment-specific trap while writing it: this module's `utility/*.ts` files each have a stale, gitignored `.js`/`.js.map` sibling from an earlier local `tsc` run, and Vite's extensionless-import resolution picked the stale compiled `.js` over the edited `.ts` source — making the new test appear to fail against my own fix. Confirmed with an isolated `tsx` probe that the fix's logic was correct outside Vitest, then deleted the stale local build output (gitignored, never committed, so it can't affect CI or another clone) and reran clean.

Verified: `npx nx run schematics-core:lint` (0 errors), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (4 files / 42 tests, all passing, 0 type errors), `npx vitest run modules/schematics` (50 files / 396 tests, all passing — the full consumer suite for every caller of these four functions).

---

### [`find-module.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/find-module.ts)

**low · Maintainability** — Fixed via [issue #305](https://github.com/Terrence721/platform-main/issues/305)

Three exported functions: `findModuleFromOptions` (resolve a schematic's target `NgModule`, either an explicitly-named one with a chain of filename-shape fallbacks, or the nearest ancestor module when none is given), `findModule` (the ancestor-walk itself), and `buildRelativePath` (compute the relative import path between two generated files).

**Correction (found while reviewing the next file, `find-component.ts`, and re-verifying this entry as a result — see [issue #307](https://github.com/Terrence721/platform-main/issues/307)):** the claim above that the default ancestor-walk path was "genuinely, transitively covered... most of that file's other tests just omit `module`" was wrong. Every one of `findModuleFromOptions`'s 9 real call sites in `modules/schematics` guarded the call itself with `if (options.module) { ... }` — so `findModuleFromOptions` was never invoked when `options.module` was falsy, meaning its own internal auto-detect branch (and `findModule()` itself) could never run. Tests that "just omit `module`" never reached that code at all; they just captured an unmodified fixture via snapshot, which passed regardless of whether auto-detect worked. Confirmed via a real, pre-existing snapshot (`store/index.spec.ts`'s "should create the initial store setup"), which showed `app-module.ts` completely untouched — no `StoreModule.forRoot()`, nothing — even though the test's own name and `findModule()`'s own doc comment both imply auto-detection should happen.

Fixed for `store`/`reducer`/`entity`/`feature` (the schematics whose only coverage was passive snapshots, with no test asserting the no-wiring behavior as intentional): all 4 now call `findModuleFromOptions` unconditionally, letting its own two branches do their job. Verified correct via updated snapshots showing real `StoreModule.forRoot()`/`.forFeature()` wiring, not just "tests pass again."

Deliberately left unfixed for `effect`/`component-store`: both have an explicit, deliberately-named test (`should not be provided by default`) directly asserting that omitting `--module` should produce _no_ wiring — a real, considered contract, not incidental coverage. Repeated feature-level generation (unlike `store`'s one-time root setup) also has a materially higher risk of the "nearest ancestor module" heuristic guessing the wrong target in a real multi-module app, and `component-store` has `--component` as its other, arguably more idiomatic target. `findModule()`'s auto-detect branch stays genuinely unreachable for these two, by design — confirmed with the user before landing this distinction rather than assumed.

The 5 `ng-add/*` call sites (`store`, `store-devtools`, `router-store`, `effects`, `data`) are one-time integration setup, the same shape as `store`'s root case — fixed the same way (dropped the `options.module &&` half of each `if (options.module && !isStandalone)` guard, keeping the `!isStandalone` half, since a truly standalone app has no module to wire into at all).

**No bug found.** Traced the one place this looked risky — `findModuleFromOptions`'s no-module branch builds `pathToCheck` from `options.path || ''`, and the explicit-module branch instead concatenates `options.path` directly with no fallback — but every real caller (`modules/schematics/src/*/index.ts`, `modules/schematics/ng-add/*/index.ts`) always sets `options.path` via `getProjectPath()`/`parseName()` before either branch runs, so the unguarded concatenation is never reachable with an actual `undefined`.

**Real, minor cleanup, fixed**: `buildRelativePath` destructured `path`/`filename`/`directory` from both `parsePath(from)` and `parsePath(to)`, but only used `fromDirectory`, `toDirectory`, and `toFileName` — `fromPath`, `fromFileName`, and `toPath` were dead on arrival (lint-confirmed, 3 `@typescript-eslint/no-unused-vars` warnings). Narrowed both destructures to only the fields actually used; zero behavior change, `parsePath` itself untouched.

**Found, not fixed here**: `modules/schematics-core/utility/find-component.ts` (next file in this module's review queue) contains a byte-for-byte duplicate of this file's `buildRelativePath`/`parsePath`/`convertToTypeScriptFileName` — and it's entirely dead: the barrel (`modules/schematics-core/index.ts`) re-exports `buildRelativePath` only from `find-module.ts`, and nothing anywhere imports `find-component.ts`'s copy directly. Same duplication shape this module's own history already had at a larger scale (Phase 30–32 consolidated 4 duplicated `schematics-core` copies into 1). Leaving the actual removal for `find-component.ts`'s own review, since the dead code lives there, not here.

**Fix (original PR)**: narrowed `buildRelativePath`'s two `parsePath()` destructures to `{ directory: fromDirectory }` and `{ filename: toFileName, directory: toDirectory }`.

**Fix (correction, issue #307)**: `modules/schematics/src/{store,reducer,entity}/index.ts` and `modules/schematics/src/feature/index.ts` (via its nested `reducer`/`entity` calls) now call `findModuleFromOptions` unconditionally; the 5 `ng-add/*` call sites dropped `options.module &&` from their guard, keeping `!isStandalone`. `feature`'s own schema gained a `skipImport` option and forwards it to its nested `entity`/`reducer` calls, since library-project targets (no root `NgModule` at all) need an explicit way to opt out of wiring — the same officially-supported mechanism `findModuleFromOptions` already checks for via `ModuleOptions.skipImport`, just not previously reachable through `feature`'s field allowlist. 5 tests across `reducer`/`entity`/`feature`/`store` needed `skipImport: true` added (all target the `'baz'` library fixture, which has no module for auto-detect to find) — each is a real Angular library, and the new throw ("Could not find an NgModule") is the correct, intended behavior for that case, not a bug to route around. `effect`/`component-store` deliberately left unchanged — see the correction above.

Verified: `npx nx run schematics-core:lint` (0 errors, down from 3 warnings on this file; 15 warnings remain repo-wide, all pre-existing and unrelated), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (6 files / 48 tests, all passing, 0 type errors), `npx nx run schematics:lint` (0 errors, 16 pre-existing warnings, unchanged baseline), `npx nx run schematics:build-package` (clean), `npx vitest run modules/schematics` (50 files / 396 tests, all passing) — 7 snapshots for `store` updated and manually verified to show correct, real `StoreModule.forRoot()`/`.forFeature()` wiring (not blindly accepted), not just "tests pass again."

---

### [`find-component.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/find-component.ts)

**low · Maintainability** — Fixed via [issue #310](https://github.com/Terrence721/platform-main/issues/310)

The component-side counterpart to `find-module.ts`: `findComponentFromOptions` (resolve a schematic's target component, either an explicitly-named one with a chain of filename-shape fallbacks, or the nearest ancestor `*.component.ts` when none is given), `findComponent` (the ancestor-walk itself). Only one real caller anywhere in the repo — `modules/schematics/src/component-store/index.ts`, guarded by `if (options.component) { ... }` — so, same shape as `find-module.ts`'s corrected finding (#307), `findComponentFromOptions`'s own auto-detect branch (and `findComponent()` itself) can never run today. **Not a bug here**: this is the exact call site the repo owner explicitly chose to keep guarded when #307/PR #308 landed — `component-store` has `--component` as one of two valid targets (the other being `--module`), and repeated per-feature generation carries real risk of the "nearest ancestor" heuristic guessing wrong in a multi-module app. `findComponentFromOptions`'s explicit-path branch (the only reachable one) is genuinely, transitively covered by `component-store/index.spec.ts` — both the success path (`component: 'app.ts'`) and the "specified component path does not exist" throw.

**Real, minor cleanup, fixed**: this file also carried its own copy of `buildRelativePath`/`parsePath`/`convertToTypeScriptFileName` — byte-for-byte identical to `find-module.ts`'s versions, and entirely dead: the barrel (`modules/schematics-core/index.ts`) re-exports `buildRelativePath` only from `find-module.ts`, and nothing anywhere imported this file's copy directly (confirmed and flagged during `find-module.ts`'s own review, #305/PR #306). Same duplication shape this module's history already had at a larger scale (Phase 30–32 consolidated 4 duplicated `schematics-core` copies into 1). Removed all three functions and the now-unused `relative`/`basename`/`extname`/`dirname` imports that only they used.

**Fix**: deleted `buildRelativePath`/`parsePath`/`convertToTypeScriptFileName` and their now-dead imports.

Verified: `npx nx run schematics-core:lint` (0 errors, down from 3 warnings on this file to 0; 12 warnings remain repo-wide, all pre-existing and unrelated), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (6 files / 48 tests, all passing, 0 type errors), `npx vitest run modules/schematics` (50 files / 396 tests, all passing — the full consumer suite for the one real caller of `findComponentFromOptions`).

---

### [`config.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/config.ts)

**low · Correctness** — Fixed via [issue #312](https://github.com/Terrence721/platform-main/issues/312)

`AppConfig` (a pure type, generated from the real Angular CLI config schema — nothing to review) plus two functions: `getWorkspacePath` (find whichever of `angular.json`/`.angular.json`/`workspace.json` actually exists) and `getWorkspace` (read and parse it). Two real callers repo-wide: `project.ts`'s `getProject()` (already reviewed, #281) and `modules/schematics/src/ng-add/index.ts`.

**Real bug, fixed**: `getWorkspacePath` returned `undefined` — typed as `string`, a real lie — when none of the 3 possible filenames exist, via `.filter(...)[0]` on an empty array. Confirmed with a real repro (not just reading the type signature): `host.read(undefined)` doesn't throw, it returns `null`, which `getWorkspace` already correctly detects — so the actual failure mode wasn't a crash, but a confusing `SchematicsException('Could not find (undefined)')` instead of a message that says what's actually missing. Not reachable by any current caller in practice (both real call sites only ever run against an actual Angular workspace, which by definition always has one of these 3 files), but a real user pointing either the `ng-add` flow or a generator at a bare, non-Angular directory would hit it — the same "internal wiring is fine today, but the type is a promise the function doesn't keep" shape as `libs-version.ts`'s stale version string (#269), just for an error path instead of a value.

**Fix**: `getWorkspacePath` now throws a clear `SchematicsException` — `Could not find a workspace configuration file (checked angular.json, .angular.json, workspace.json).` — the moment none of the 3 files are found, instead of returning `undefined` and letting a later, unrelated-looking `host.read()` call produce a confusing secondary error. Switched `.filter(...)[0]` to `.find(...)` while touching this line (same result, no intermediate array).

Added `modules/schematics-core/utility/config.spec.ts` (6 tests) — the third file in this module to get direct coverage now that `schematics-core` has its own test infrastructure (#279): each of the 3 filename fallbacks for `getWorkspacePath`, its new not-found throw, and `getWorkspace`'s parse-and-return happy path plus the same throw propagating through it. Hit this module's now-familiar stale-`.js`-shadows-`.ts` trap again while writing it (see `project.ts`'s entry, #281) — same fix, delete the stale gitignored build output and clear Vite's cache.

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (8 files / 60 tests, all passing, 0 type errors), `npx vitest run modules/schematics` (50 files / 396 tests, all passing — the full consumer suite for `ng-add/index.ts`'s real usage).

---

### [`strings.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/strings.ts)

**low · Test Coverage** — Fixed via [issue #315](https://github.com/Terrence721/platform-main/issues/315)

Nine casing/pluralization helpers (`decamelize`, `dasherize`, `camelize`, `classify`, `underscore`, `capitalize`, `pluralize`, `group`, `featurePath`) used throughout every schematic in the repo to derive generated file names, class names, and property names from a `--name` argument.

**No bug found** in seven of the nine — `decamelize`/`dasherize`/`camelize`/`classify`/`underscore`/`capitalize`/`group` are exercised constantly, transitively, across dozens of real snapshot tests in nearly every schematic (`modules/schematics/src/**`), since generated file names and class names are asserted directly against their output. `featurePath` (one real caller, `selector/index.ts`) traced by hand and confirmed all 3 of its meaningful return branches — `group && !flat`, `group && flat`, `!group` — are each independently exercised by a real, passing snapshot test in `selector/index.spec.ts`.

**Real coverage gap, fixed**: `pluralize` has 4 real behavior branches (3 regex transformations plus a no-match fallback), each demonstrated only in a non-executable doc comment — real test coverage existed for exactly one of the four (the fallback case, via `entity`'s "should update the state to plural" snapshot, which only ever pluralizes `'user'` → `'users'`). The 3 actual transformation rules (consonant+y→ie, trailing f/fe→ve, consonant+o or s/x/z or ch/sh→+e) had zero real coverage anywhere in the repo. Traced each by hand against the doc comment's own 5 examples before trusting it, then verified with a real repro (added spec, all passing on the first run) rather than assuming the trace was right. Also confirmed, by tracing `pluralize`'s one real caller-chain (`ngrx-utils.ts` → generates a `<name>FeatureKey` property), that the function's final `camelize()` pass deliberately lowercases the first character — not an accidental side effect, but the exact convention its only consumer needs.

**Real, minor cleanup, fixed**: `pluralize`'s 3 regex rules were applied via `[r1, r2, r3].map((c, i) => (str = str.replace(c, ...))) && str + 's'` — abusing `.map()`'s return value and array truthiness (a non-empty array is always truthy, so the `&&` always proceeds) purely as a sequencing trick instead of a loop. Functionally correct but genuinely hard to read; rewrote as an explicit rule list + `for` loop with the exact same replacement strings, safe to do confidently now that all 4 branches have direct test coverage proving behavioral equivalence.

**Fix**: rewrote `pluralize`'s internals as an explicit `[RegExp, string][]` rule list applied in a `for` loop; added `strings.spec.ts` (6 tests) covering all 4 branches plus the vowel+y non-match case and the deliberate lowercase-first behavior.

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx vitest run modules/schematics-core` (10 files / 72 tests, all passing, 0 type errors), `npx vitest run modules/schematics` (50 files / 396 tests, all passing, including the real `entity` "should update the state to plural" snapshot — confirms the rewrite is exactly behavior-preserving, not just "new tests pass").

---

### [`change.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/change.ts)

**low · Maintainability** — Fixed via [issue #317](https://github.com/Terrence721/platform-main/issues/317)

Two parallel mechanisms for the same `Change` objects (`NoopChange`/`InsertChange`/`RemoveChange`/`ReplaceChange`): each class implements a `.apply(host: Host)` method against an abstract `Host` interface (`{read, write}`, both `Promise`-returning), and separately, `createChangeRecorder`/`commitChanges` read the same classes' data fields directly (`.pos`, `.toAdd`, `.end`, `.oldText`, `.newText`) and replay them through the real Angular DevKit `Tree`/`UpdateRecorder` API via `instanceof` dispatch.

**No bug found** in the live path: `commitChanges`/`createChangeRecorder`, and every `Change` subclass's constructor (including the negative-position guards), are extremely thoroughly, transitively covered — confirmed via a repo-wide grep, not assumed: 30+ real call sites across nearly every module's `migrations/*/index.ts`, each backed by its own real, passing migration spec that runs the actual schematic end-to-end and asserts on the resulting file content.

**Real, confirmed dead code, not fixed**: the `Host` interface and all 4 classes' `.apply(host)` methods are 100% unreachable — a repo-wide grep for `.apply(host)` calls and `Host` implementations both came back with zero matches. `createChangeRecorder` never calls `.apply()`; it duplicates the same remove/insert operations manually via `UpdateRecorder`. One real consequence: `ReplaceChange.apply()`'s own built-in stale-position guard (rejects if the text actually at `pos` doesn't match `oldText`) never runs on the real, live path. Traced whether that's a reachable gap before deciding what to do about it: every one of the 30+ real callers computes its full `Change[]` array from a single AST parse and commits them all in one `commitChanges()` call within the same tick, so a stale position never actually arises in practice — this is a defense-in-depth gap that exists only in already-dead code, not a demonstrated live bug. Left the `Host`/`.apply()` machinery in place, undocumented no further — inherited from upstream (this is copied, MIT-licensed Angular CLI internal tooling, most likely superseded by the `Tree`/`UpdateRecorder` approach at some point upstream too), self-contained, and removing it would be a larger, riskier edit to a widely-imported shared file for zero functional gain. Same "leave alone, note it" call as `store-devtools`'s `unliftAction()` finding (#217).

**Real, minor cleanup, fixed**: removed a vestigial `/* istanbul ignore file */` comment — a leftover from the pre-Vitest, Istanbul/nyc-coverage era. This repo's last real Istanbul/nyc references (the `coverage:html`/`ci` npm scripts) were removed in [PR #300](https://github.com/Terrence721/platform-main/pull/300), confirming neither package has been installed for a while; this comment had been fully inert since, silently misleading a reader into thinking coverage instrumentation still cares about this file.

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx vitest run modules/schematics-core` (10 files / 72 tests, all passing), full build + migration-spec run across every module that constructs a `Change` directly (`store`/`effects`/`router-store`/`store-devtools`/`component`/`component-store`/`signals`/`operators`/`schematics`) — 60 files / 265 tests, all passing.

---

### [`ngrx-utils.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/ngrx-utils.ts)

**medium · Correctness** — Fixed via [issue #319](https://github.com/Terrence721/platform-main/issues/319)

Six functions wiring a generated reducer into an app: `addReducerToState`/`addReducerImportToNgModule` (the two `Rule` factories that drive it), `addReducerToStateInterface`/`addReducerToActionReducerMap` (the two AST-editing helpers they call), plus `omit`/`getPrefix`.

**No bug found** in `addReducerToState`/`addReducerImportToNgModule`/`addReducerToStateInterface`/`omit`/`getPrefix` — all exercised transitively via real schematic/migration specs (`entity`'s "should update the state to plural" snapshot alone proves `addReducerToStateInterface`'s real output; `container/index.spec.ts` exercises `omit` on every single test, since the schematic's own entry point calls it unconditionally). Noted, not fixed: both `Rule` factories throw a plain `Error` for a missing file (`!host.exists(...)`) but `SchematicsException` for a null read (`text === null`) — an inconsistent pair of error types for two closely-related failure modes, but harmless (both are still real thrown errors surfaced to the user) and identical in both functions, matching upstream's own style rather than a one-off slip.

**Real bug, fixed**: `addReducerToActionReducerMap` crashes with `TypeError: Cannot read properties of undefined (reading 'text')` if the target `reducers/index.ts` has _any_ top-level typed variable declaration, other than the `ActionReducerMap`-typed one, whose type isn't a simple named type reference (an array type, union type, object-literal type, etc.) — `.find(({ type }) => type.typeName.text === 'ActionReducerMap')` assumes every candidate's `type` node has a `.typeName`, but that's only true for `TypeReferenceNode`; e.g. `ArrayTypeNode` (`MetaReducer<State>[]`) has `.elementType` instead, no `.typeName` at all. Confirmed real and reachable with a repro, not just reasoning: the actual `store` schematic's own `reducers/index.ts.template` declares `reducers: ActionReducerMap<State>` _before_ `metaReducers: MetaReducer<State>[]`, so `.find()`'s left-to-right short-circuit happens to reach the safe entry first in the one file this repo's own tooling ever generates — masking the bug in normal use. Reordering those two declarations (or any hand-edited/differently-shaped `reducers/index.ts`) reaches the crash immediately; verified both directions with a throwaway repro calling the function directly against synthetic sources before touching any code.

**Fix**: narrowed the `.find()` predicate with `ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) && type.typeName.text === 'ActionReducerMap'` — skips any non-matching type shape instead of crashing on it. Also noted, not fixed: a few lines above, `const type = variable ? variable.type : {}` guards against `variable` being falsy, but the very next line (`variable.initializer`) doesn't — technically inconsistent, but confirmed unreachable, since a real `VariableDeclarationList`'s `declarations` array can only ever contain `VariableDeclaration` nodes by TypeScript's own AST invariants, so `.find(decl => decl.kind === ts.SyntaxKind.VariableDeclaration)` can't actually fail for any syntactically valid source.

Added `ngrx-utils.spec.ts` (3 tests) — the file's first direct coverage: the default declaration order (matching the real template, still resolves correctly), the reversed order that used to crash (now returns a normal `InsertChange`), and the already-correct no-match `NoopChange` path.

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx vitest run modules/schematics-core` (12 files / 78 tests, all passing, 0 type errors), `npx vitest run modules/schematics` (50 files / 396 tests, all passing — the full consumer suite for `entity`/`reducer`/`feature`/`store`, every real caller of these functions).

---

### [`visitors.ts`](https://github.com/Terrence721/platform-main/blob/7e7a67addd5ece8030d0f74463f302bc69a5efb7/modules/schematics-core/utility/visitors.ts)

**medium · Correctness** — Fixed via [issue #328](https://github.com/Terrence721/platform-main/issues/328)

Twelve AST-walking helpers: `visitTSSourceFiles`/`visitTemplates` (source-tree-wide walkers), `visitNgModuleImports`/`visitNgModuleExports`/`visitComponents`/`visitNgModules`/`visitDecorator` (find a decorated class and its property arrays), `visitImportDeclaration`/`visitImportSpecifier` (find imports), `visitTypeReference`/`visitTypeLiteral`/`visitCallExpression` (find type/call-expression nodes).

**No bug found** in `visitTSSourceFiles`, `visitImportDeclaration`, `visitImportSpecifier`, `visitTypeReference`, `visitTypeLiteral`, `visitCallExpression`, or `visitTemplates`'s own template/templateUrl resolution logic — each correctly recurses into every child regardless of match (the only sound way to find nested matches, e.g. `Foo<Bar<Baz>>`'s 3 nested type references), and `visitTemplates`'s `templateUrl` path resolution mirrors Angular CLI's own real approach.

**Real bug, fixed**: `visitDecorator` — the shared engine behind `visitComponents`/`visitNgModules`/`visitNgModuleImports`/`visitNgModuleExports` — had a control-flow asymmetry every sibling function in this same file avoids. Its inner `findClassDeclaration` did `if (!ts.isClassDeclaration(node)) { ts.forEachChild(node, findClassDeclaration); }` with no `return`, so after recursing into a non-class node's children, execution fell through and force-cast that same non-class node to `ts.ClassDeclaration` anyway (`node as ts.ClassDeclaration`) before checking it for a matching decorator. Confirmed real and reachable with a repro, not just reading the cast: a decorated class _expression_ (valid TC39 decorator syntax, e.g. `const Foo = @Component({...}) class {};`) is not a `ClassDeclaration` — `ts.isClassDeclaration` is false for it — but a `ClassExpression` is one of the node kinds `ts.getDecorators` _does_ return real decorators for, so the callback fired with a `ClassExpression` typed as a `ClassDeclaration`, `.name` silently `undefined` (a `ClassDeclaration` always promises a name to callers; a `ClassExpression` doesn't). Every real caller of these functions in this repo (`modules/schematics/src/ngrx-push-migration/index.ts`, via `visitTemplates`/`visitNgModuleImports`/`visitNgModuleExports`) either never touches the node's `.name` or discards it entirely, so this never crashes anything in this repo's own generators today — same "type is a promise the function doesn't keep, not reachable by current callers, but real for anyone else exercising this shared utility" shape as `config.ts`'s `getWorkspacePath` finding above.

**Fix**: added the missing `return;` after the recursive call, and dropped the now-unnecessary `as ts.ClassDeclaration` cast — TypeScript's own control-flow narrowing on the `ts.isClassDeclaration` guard now proves `node`'s type without it.

Added `visitors.spec.ts` (16 tests) — the file's first direct coverage: a real-match/no-match/wrong-decorator-name set for `visitComponents`/`visitNgModules`, the class-expression regression case itself, `visitNgModuleImports`/`visitNgModuleExports`'s array-element extraction, import declaration/specifier parsing, nested type-reference/call-expression matching (proving the "always recurse" correctness the fixed function now also follows), and `visitTemplates`/`visitTSSourceFiles` against a real `UnitTestTree` (inline template, external `templateUrl` resolution, a missing `templateUrl` correctly producing no match, and `.d.ts`/`node_modules` correctly skipped).

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (13 files / 94 tests, all passing, 0 type errors), `npx nx run schematics:test` (50 files / 396 tests, all passing — the full consumer suite for `ngrx-push-migration`, the one real caller of `visitTemplates`/`visitNgModuleImports`/`visitNgModuleExports`).

---

### [`standalone.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/schematics-core/utility/standalone.ts)

**medium · Correctness** — Fixed via [issue #330](https://github.com/Terrence721/platform-main/issues/330)

A verbatim copy of real, actively-maintained Angular CLI internal tooling (per the file's own header comment). `callsProvidersFunction`/`addFunctionalProvidersToStandaloneBootstrap` (the two public entry points, both `@deprecated` upstream in favor of `addRootImport`/`addRootProvider` but still this repo's real, live path) plus the private helpers that find a `bootstrapApplication` call, resolve its app config (inline, same-file identifier, or cross-file identifier import), and mutate it via the `ts.factory`/`UpdateRecorder` pattern.

**No bug found** in the core AST-finding/mutation logic — traced all 4 real branches of `addFunctionalProvidersToStandaloneBootstrap` (new 1-arg config, existing inline config, `mergeApplicationConfig(...)` call, and app-config-via-identifier) by hand, and confirmed each is either genuinely correct or throws a clear `SchematicsException` for an unanalyzable shape. Noted, not fixed: `findBootstrapApplicationCall`'s walker avoids descending into an already-matched node's subtree but doesn't short-circuit the rest of the walk, so a pathological file with two sibling `bootstrapApplication(...)` calls would return the last one instead of the first — unreachable for any real `main.ts`, which only ever has one.

**Real bug, fixed**: `resolveAppConfigFromIdentifier` (the cross-file case — an `app.config.ts` imported into `main.ts`, the default shape `ng new --standalone` generates) built the imported file's path with Node's own `path` module (`join(dirname(bootstrapFilePath), ...)`) instead of `@angular-devkit/core`'s `Tree`-safe path utilities already used everywhere else in this file's sibling utilities. `path.join`/`dirname` use OS-native separators — on Windows, this produces a **backslash-separated path**, violating the function's own documented contract ("@return The file path that the provider was added to") and the `Tree` API's POSIX-only convention. Confirmed with a real repro, not just reading the import: `join(dirname('/main.ts'), './app/app.config.ts')` returns `"\app\app.config.ts"` on this machine (`process.platform === 'win32'`). Traced the actual blast radius before fixing: `Tree.exists`/`readText`/`beginUpdate`/`commitUpdate` all tolerate the malformed separators internally (a second repro confirmed reads/writes still land on the correct file), and this module's one real downstream consumer of the returned path (`store`'s `ng-add/index.ts`, feeding it into `find-module.ts`'s `buildRelativePath`) also self-heals via `@angular-devkit/core`'s own `normalize()` — so this has never actually produced a broken generated file for any of this repo's 5 real callers (`data`/`effects`/`router-store`/`store`/`store-devtools`), and CI (Linux runners) would never have caught it either way. Still a real, fragile contract violation on the one platform this repo's own maintainer actually develops on — a future caller that doesn't happen to route through `normalize()` first would break.

**Fix**: swapped the `'path'` import for `@angular-devkit/core`'s `dirname`/`join`/`normalize` (already the convention in `find-module.ts`/`visitors.ts`), normalizing `bootstrapFilePath` before computing the imported file's path.

Added `standalone.spec.ts` (10 tests) — the file's first direct coverage: `callsProvidersFunction`'s true/false cases, all 4 `addFunctionalProvidersToStandaloneBootstrap` config-resolution branches including the previously **zero-coverage-anywhere-in-this-repo** `mergeApplicationConfig` case, the regression case itself (asserting the returned path uses forward slashes), and both `SchematicsException` paths.

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (14 files / 104 tests, all passing, 0 type errors), `npx nx run schematics:test` (50 files / 396 tests, all passing — the full consumer suite for all 5 real `ng-add` callers).

---

### [`ast-utils.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/schematics-core/utility/ast-utils.ts)

**medium · Correctness** — Fixed via [issue #332](https://github.com/Terrence721/platform-main/issues/332)

The largest file in the module (926 lines): real, MIT-licensed Angular CLI source (`findNodes`, `getSourceNodes`, `getDecoratorMetadata`, `insertImport`, the `_addSymbolTo*Metadata` family) plus NgRx-specific extensions layered on top — most notably `_addSymbolToNgModuleMetadata`'s `EffectsModule.forRoot`/`forFeature` merge branch, which doesn't exist in the sibling `_addSymbolToComponentMetadata`.

**No bug found** in the core Angular CLI logic — `findNodes`/`getSourceNodes`/`insertAfterLastOccurrence`/`getDecoratorMetadata`/`insertImport`/the `_addSymbolTo*Metadata` family's main insertion paths are all extensively, transitively covered across dozens of real migration and generator specs repo-wide (every `ng-add`/`ng generate` schematic in `modules/schematics` routes through this file).

**Real bug, fixed**: `replaceImport`'s dedup-removal branch (used when renaming an import specifier to a name that's already separately imported in the same statement — e.g. the `effects` module's `13_0_0` migration renaming `Effect` → `createEffect`) correctly cleaned up the trailing comma when removing a specifier that has a _following_ specifier, but left a dangling `", "` behind when the removed specifier was the _last_ one in the list (with an earlier specifier still before it) — `import { Actions, ofType, createEffect, Effect }` became `import { Actions, ofType, createEffect,  }` instead of cleanly closing the brace. Confirmed with a real repro against the actual function (not just reading the branch), and confirmed the existing migration test suite never covered this shape - the only existing "dedup remove" test has the removed specifier in the middle of the list, not last.

**Fix**: added a `previousIdentifier` branch that removes from the end of the preceding specifier through the end of the one being removed (mirroring the existing "next identifier" branch in reverse) when there's no following specifier to anchor on.

**Real, minor cleanup, fixed**: `_addSymbolToNgModuleMetadata`'s `EffectsModule` merge branch extracted the existing call's array argument via `.arguments.shift()` — a mutating read where a plain `.arguments[0]` was clearly intended (nothing downstream re-reads `.arguments` afterward). Traced the actual blast radius: every real caller in this repo (`modules/schematics/src/effect/index.ts`) parses a fresh `ts.SourceFile` for a single `addImportToModule` call per schematic invocation, so the mutation has never been observable — but it's a real footgun for any future caller that reuses the same parsed AST across multiple calls against the same NgModule. Swapped for a non-mutating index read.

**Real, minor cleanup, fixed**: removed the same vestigial `/* istanbul ignore file */` comment class already removed from `change.ts` (#317) - dead since this repo's last Istanbul/nyc references were removed in [PR #300](https://github.com/Terrence721/platform-main/pull/300).

Added `ast-utils.spec.ts` (5 tests) — the file's first direct coverage, focused on the actual finding: `replaceImport`'s plain-rename path, the existing mid-list dedup-remove behavior (regression-proofing what already worked), the previously-broken last-of-list dedup-remove case, a 2-specifier variant, and the no-op case for an unrelated module.

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (15 files / 109 tests, all passing, 0 type errors), `npx nx run schematics:test` (50 files / 396 tests, all passing), `npx nx run effects:test` (the real `replaceImport` migration caller — the specific 3 tests that intermittently timed out under full-suite worker contention on an unrelated `spec/types/**` compiler-API check all passed cleanly, with real timing margin, when run in isolation — the documented pre-existing flakiness pattern, not a regression).

---

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/e35d1e68cebdba45abea67a7156a49562af80466/modules/schematics-core/index.ts)

**medium · Correctness** — Fixed via [issue #334](https://github.com/Terrence721/platform-main/issues/334)

The module's public barrel, and its last file — closes out `schematics-core`.

**Real bug, fixed**: applying this audit's established barrel cross-check method (every already-exported member's own public signature checked for a type/function it needs but the barrel doesn't re-export) turned up an unusually large set of gaps for this module specifically — `schematics-core` is consumed by _other modules in this same repo_, and several real internal callers turned out to reach it via deep imports (`'../../../schematics-core/utility/X'`) rather than the barrel, which let the barrel drift badly out of sync with what the module actually offers:

- `createRemoveChange` (`change.ts`) — the sibling factory to the already-exported `createReplaceChange`, used internally by `ast-utils.ts`'s `replaceImport`.
- `ComponentOptions` (`find-component.ts`) — the parameter type of the already-exported `findComponentFromOptions`.
- `Location` (`parse-name.ts`) — the return type of the already-exported `parseName`.
- `WorkspaceProject` (`project.ts`) — the return type of the already-exported `getProject`.
- `getProjectMainFile` (`project.ts`) — a whole function, confirmed with 5 real callers (`data`/`effects`/`router-store`/`store`/`store-devtools`'s `ng-add` schematics) that all currently deep-import it.
- All 3 of `standalone.ts`'s exports (`callsProvidersFunction`, `addFunctionalProvidersToStandaloneBootstrap`, `findBootstrapApplicationCall`) — the entire file was unreachable via the barrel, despite the same 5 real `ng-add` callers above depending on it (this is the file reviewed in #330/PR #331).
- 5 of `visitors.ts`'s 12 exports (`visitImportDeclaration`, `visitImportSpecifier`, `visitTypeReference`, `visitTypeLiteral`, `visitCallExpression`) — confirmed with 4 real callers across `effects`/`operators`/`signals`' migrations.

**Fix**: added all of the above to the barrel. Deliberately left `strings.ts`'s 9 casing/pluralization functions alone — they're intentionally namespaced under the already-exported `stringUtils` object rather than re-exported individually, a deliberate design choice (the object is explicitly constructed for that purpose), not an oversight.

Verified at the type level, not just by reading the source: confirmed every new export actually appears in the compiled `dist/modules/schematics-core/index.d.ts`. No new test file needed — this is a pure re-export change with no new logic; existing behavior for every already-reachable export is unchanged.

Verified: `npx nx run schematics-core:lint` (0 errors, 12 pre-existing warnings, unchanged), `npx nx run schematics-core:build` (clean), `npx nx run schematics-core:test` (15 files / 109 tests, all passing, 0 type errors), `npx nx run schematics:test` (50 files / 396 tests, all passing), plus the real deep-import consumers confirmed directly: `operators`', `effects`', and `signals`' migration specs that use `visitors.ts`'s newly-barrel-exported functions all pass clean in isolation.

---

**`schematics-core` module COMPLETE as of 2026-09-16: 16/16 files, 9 real bugs found and fixed, 2 test-coverage gaps closed, 13 barrel-export gaps closed (across 6 files, the largest barrel-gap finding of any module in this audit) plus 2 dead-code/vestigial-comment cleanups.** Full real-bug list: `libs-version.ts` (stale version floor), `json-utils.ts` (misnamed file), `project.ts` (missing-project error), `find-module.ts` (`findModuleFromOptions` never actually auto-detected), `config.ts` (`getWorkspacePath` returning `undefined` typed as `string`), `ngrx-utils.ts` (`addReducerToActionReducerMap` crash on non-simple type shapes), `visitors.ts` (`visitDecorator` handing callers a `ClassExpression` typed as `ClassDeclaration`), `standalone.ts` (`resolveAppConfigFromIdentifier` building a backslash-separated path on Windows), `ast-utils.ts` (`replaceImport` leaving a dangling comma). Tracking issue [#34](https://github.com/Terrence721/platform-main/issues/34) to be closed once this PR merges.

---

### [`deep-computed.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/deep-computed.ts)

**low · Correctness** — Reviewed via [issue #336](https://github.com/Terrence721/platform-main/issues/336)

`deepComputed`, the module's first file. A thin wrapper (one line of real logic): `toDeepSignal(computed(computation))`, deferring all the real deep-signal-construction work to `deep-signal.ts` (next file in this module's review).

**No bug found**: confirmed the wrapping is type-sound (`computed()` returns `Signal<T>`, `toDeepSignal<T>(signal: Signal<T>): DeepSignalOf<T>` accepts exactly that, matching `deepComputed`'s own declared `DeepSignalOf<T>` return type). Genuinely, directly well-tested already — not just trivially trusted for its small size — `deep-computed.spec.ts` has 6 tests covering nested object literals, unions of objects (including a live discriminated-union narrowing check via `'m' in result`), unions with primitives/null mixed in, arrays (confirmed deliberately _not_ deep-signaled), and primitives/null/undefined. Also checked the doc comment's own usage example against the real implementation — accurate.

---

### [`deep-signal.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/deep-signal.ts)

**high · Correctness** — Fixed via [issue #338](https://github.com/Terrence721/platform-main/issues/338)

`toDeepSignal`, the Proxy-based engine `deepComputed`/`signalState`/`withState`/`withLinkedState` all build on: given a `Signal<T>`, lazily returns a Proxy that also exposes each nested object property of `T` as its own (further-nested) signal, discriminating unions on access via `'x' in deepSignal`.

**No bug found** in the union-narrowing/laziness/cleanup logic itself — traced the full `get`/`has` trap interaction (the `has` trap deliberately delegates to `get`'s own logic so that `'x' in result` both checks _and_ warms up the lazy signal it guards) and the stale-signal cleanup on a union member disappearing. Already extremely well-covered directly: 13 existing tests in `deep-signal.spec.ts` alone (plain objects, custom class instances, lazy initialization, 4 distinct union shapes including a full round-trip, primitives, iterables, 8 different built-in object types, functions, and custom classes extending iterables/built-ins).

**Real bug, fixed — the most severe finding of this whole audit**: the lazy per-property computed signal was cached by writing directly onto the underlying signal itself — `Object.defineProperty(target, prop, { value: computed(...) })`, where `target` _is_ the real, potentially **writable** `Signal` object (confirmed: `signalState()` calls `toDeepSignal(stateSource[key])` on a genuine `signal(...)`, not a read-only `computed()`). If the state value at any level of nesting happened to have an own property literally named `set` (or any other real `WritableSignal`/`Signal` method — `update`, `asReadonly`, etc.), accessing that property through the deep signal **permanently overwrote the real signal's own `.set()` method** with a read-only computed signal derived from the data's own `set` property. `patchState`'s real update path (`signals[signalKey].set(newState[signalKey])`) would then silently call the clobbered (non-mutating) property instead of the real setter — **the state update is silently dropped, with no error, no warning, nothing** — the store just stops responding to `patchState` for that slice forever.

Confirmed with a real, full-stack repro (not just reading the code) against the actual public `signalState`/`patchState` API: `signalState({ settings: { set: ['a', 'b'], count: 0 } })`, access `state.settings.set` once (as any consumer reading `.settings.set()` normally would), then `patchState(state, { settings: { set: ['c'], count: 1 } })` — the state silently stayed at its original value. This is a plausible, real-world-reachable collision (`set`, `update`, `get`, `count`, `state` are all ordinary English words a real domain model could legitimately use as property names) in the module's own core, most widely-used public API.

**Fix**: moved the lazy-signal cache off the underlying signal object entirely, into a side `WeakMap<object, Map<PropertyKey, Signal>>` keyed by the target signal instance. The real signal's own properties (`.set`, `.update`, `.asReadonly`, its internal markers) are never touched, so there is no longer any possible collision with a same-named state property, regardless of the property's name. This is also simpler than the original `DEEP_SIGNAL`-symbol-tagging mechanism it replaces — the cache's own existence check does the same "was this already deep-signal-cached" job the symbol tag used to, with no risk of confusing a real signal method for one.

**Real, minor cleanup, fixed along the way**: `deep-signal.ts:45`'s `has` trap used a non-null assertion (`this.get!(...)`) to call the Proxy handler's own optional `get` trap — a pre-existing lint warning (`@typescript-eslint/no-non-null-assertion`). Swapped for optional chaining (`this.get?.(...)`), identical behavior (`get` is always defined here, it's declared right above in the same handler object), no more assertion needed.

Added a direct regression test to `deep-signal.spec.ts` — confirmed it fails against the pre-fix code (reverted the source, re-ran, watched it fail) before confirming it passes against the fix, matching this audit's verification discipline for every serious finding.

Verified: `npx nx run signals:lint` (0 errors, 70 warnings, down from 71 — the non-null-assertion cleanup), `npx nx run signals:build` (clean), `npx vitest run` directly against `deep-signal.spec.ts`/`deep-computed.spec.ts`/`signal-state.spec.ts`/`with-state.spec.ts`/`with-linked-state.spec.ts` (85 tests, all passing, 0 type errors) — the full set of real, direct consumers of `toDeepSignal`. The full `nx run signals:test` run separately showed 9 failures, all in unrelated `spec/types/**` compiler-API files under the well-documented pre-existing full-suite worker-contention flakiness (confirmed by re-running the same files in isolation, clean).

---

### [`signal-method.ts`](https://github.com/Terrence721/platform-main/blob/main/modules/signals/src/signal-method.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #348](https://github.com/Terrence721/platform-main/issues/348))

`signalMethod`, a standalone helper unrelated to the `toDeepSignal` engine the previous two files built — wraps a static value or a signal/computation in an `effect()`-driven call to a processing function, with manual per-instance `.destroy()` plus automatic cleanup on injector teardown.

**No bug found**: traced the reactive-vs-static branch (`isReactiveComputation`), the injector-priority chain (explicit config injector > caller injector > source injector — all three orderings directly tested), the dev-mode deprecation warning gate, and the `watchers` array bookkeeping behind `.destroy()`. Already thoroughly tested directly — 15 tests in `signal-method.spec.ts` covering non-signal/signal/computation inputs, injection-context assertion, 4 distinct destroy scenarios (including a destroyed child injector's effect ref being safely re-destroyed), 3 injector-priority orderings, and the full deprecation-warning matrix.

One minor, non-functional observation, not filed as a bug: `.destroy()` calls `.destroy()` on every entry in the internal `watchers` array but never clears the array itself, and a watcher destroyed individually (via its own returned `EffectRef.destroy()`, not through the owning injector) is never removed from it either — the array only shrinks via `DestroyRef.onDestroy`, which fires on injector teardown, not on a direct `.destroy()` call. Confirmed this doesn't cause a functional defect — Angular's `effect().destroy()` is idempotent, so a stale re-destroy is a harmless no-op — just a bounded memory-retention nuance, not worth a fix on its own.

---

### [`signal-state.ts`](https://github.com/Terrence721/platform-main/blob/main/modules/signals/src/signal-state.ts)

**n/a · Maintainability** — Reviewed, no findings at the time ([issue #350](https://github.com/Terrence721/platform-main/issues/350)); a quadratic build was found later in the `with-computed.ts` review and fixed in [issue #408](https://github.com/Terrence721/platform-main/issues/408), see the correction at the end of this entry

`signalState`, one of the real callers of `deep-signal.ts`'s `toDeepSignal` engine — given deliberate extra scrutiny rather than a quick pass, per the follow-up note left on that severe finding.

**No bug found, but the same collision class was worth re-checking directly, not assumed safe:** `signalState()` also writes per-key deep-signal accessors straight onto an object via `Object.defineProperty(signalState, key, { value: toDeepSignal(stateSource[key]) })` — the same general shape as `deep-signal.ts`'s pre-fix bug. The difference that makes it safe: the target here (`signalState`, a `computed()` result) is genuinely **read-only** — it never has live `.set`/`.update`/`.asReadonly` methods to begin with, so a state key literally named `set`/`update`/`asReadonly` can't clobber a real mutator the way it did on the writable signal in `deep-signal.ts`. The actual writable signals live in a separate `stateSource` dictionary, attached once via its own `Object.defineProperty(signalState, STATE_SOURCE, ...)` call and never touched by the per-key loop. Confirmed `patchState` (`state-source.ts`) mutates exclusively through `stateSource[STATE_SOURCE][key].set(...)` — the raw dictionary — never through `signalState[key]`, so there's no path from a colliding key name back to a broken `patchState` call. The existing test `'overrides Function properties if state keys have the same name'` already directly exercises the top-level collision case (state keys named `name`/`length`, real `Function.prototype` properties) and confirms it as the library's own deliberate, tested behavior.

Also confirmed: the eager, one-time `Reflect.ownKeys(initialState)` top-level key enumeration (vs. `deepComputed`'s fully lazy Proxy-based approach) matches `WritableStateSource<State>`'s own type contract (a fixed `keyof State`), not a gap — nested levels below the top layer still go through the already-fixed, dynamic `toDeepSignal` engine. Already thoroughly tested: 10 runtime tests (`signal-state.spec.ts`) plus an unusually extensive 15-test type-level spec (`signal-state.types.spec.ts`) covering optional slices, unions, iterables, built-ins, and Function-property-name collisions at the type level.

**Correction, found later ([issue #408](https://github.com/Terrence721/platform-main/issues/408)):** the conclusion above checked the `set`/`update` collision class but did not measure how the file scales, and it missed a real defect. `signalState()` builds its `stateSource` dictionary, and the whole-state `computed` that re-runs on every read after a change, with `reduce` and an object spread per key, which is quadratic in the number of slices (2,000 slices: 1.87 s to create, 1.3 to 1.65 s per `state()` read). Fixed in one pass with `Object.fromEntries`; details and measurements are in the `with-computed.ts` entry.

### [`signal-store-assertions.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/signal-store-assertions.ts)

**low · Correctness** — Fixed via [issue #352](https://github.com/Terrence721/platform-main/issues/352)

`assertUniqueStoreMembers`, the dev-mode-only guard (23 lines) that warns when a feature adds a store member whose name already exists. It matters more than its size suggests: `signalStore()`'s constructor merges `{ ...stateSignals, ...props, ...methods }` last-write-wins, so this warning is the only signal a developer gets that one kind of member is shadowing another — confirmed with a real repro that after a state-key vs. method collision the method is what the final store exposes, so the warning is accurate when it fires.

**No bug in the guard itself, and nothing bypasses it:** every feature that adds members goes through one of the four guarded callers — `withState`/`withProps`/`withMethods`/`withLinkedState` call it directly (all four gated on `ngDevMode`), `withComputed` delegates to `withProps`, `withEntities` is built from `withState` + `withComputed`, `withFeature`/`signalStoreFeature` delegate, and `withHooks`/`withReducer`/`withEventHandlers` add no members (each verified by reading it, not assumed).

**Real defect, fixed in the callers — a false-positive warning:** `withProps`/`withMethods` passed `Reflect.ownKeys()` of their factory's result to the guard, which includes **non-enumerable** own keys, then merged that result into the store with a spread, which silently drops them. So a non-enumerable key sharing a name with an existing member logged `Trying to override: <name>` although nothing was overridden. Confirmed with a throwaway probe before touching any code: a non-enumerable `inc` returned from `withProps` logged the warning, yet `props` stayed `[]` and `methods.inc` was still the original function. `withState`/`withLinkedState` are not affected (they create a real signal for every own key, so their keys match what is actually added). Impact is a misleading dev-mode message on an unusual input — no state is corrupted and production (`ngDevMode` off) is unaffected — fixed anyway as a genuine mismatch between what the guard reports and what the store does.

**Fix**: `withProps`/`withMethods` now spread the factory's result once into a local and derive the guard's keys from that same enumerable-only snapshot that gets merged, so the guard can only report members that are actually being added (same key set, order, values, and single getter evaluation as before). Added one regression test each to `with-props.spec.ts`/`with-methods.spec.ts` — a mixed case (one enumerable colliding key plus non-enumerable keys colliding with existing state/method/computed members) — confirmed to fail against the pre-fix source and pass after. `with-props.ts`/`with-methods.ts` are not yet reviewed under [#43](https://github.com/Terrence721/platform-main/issues/43) and will still get their own full pass; this fix covers only the key-derivation mismatch above.

Verified: `npx nx run signals:lint` (0 errors, 70 warnings; the four touched files are unchanged at 16 warnings vs. `main`), `npx nx run signals:build` (clean), and the 6 related spec files (`with-props`, `with-methods`, `with-computed`, `signal-store`, `with-state`, `with-linked-state`; 127 tests counting both the runtime and type-check passes, 0 type errors) pass. A full local `npx nx test signals` additionally shows `signal-state.spec.ts > caches previously created signals` failing — it fails identically on a clean `main` checkout (confirmed by stashing this change and re-running), as do the documented `spec/types/**` worker-contention errors; neither is touched by this change.

### [`signal-store-feature.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/signal-store-feature.ts)

**low · Maintainability** — Fixed via [issue #354](https://github.com/Terrence721/platform-main/issues/354)

`signalStoreFeature`, the function that combines several store features into one: 20 hand-written overloads (10 arities × with/without an `input` argument), a 6-line runtime (`typeof args[0] === 'function' ? args : args.slice(1)`, then a `reduce` over the features), and the `type<T>()` helper.

**Reviewed mechanically, not by eye:** a hand-typed overload set is exactly where a copy-paste slip hides, so every overload was checked by a script against the pattern the first few establish — the type-parameter list, the feature-to-feature input chain (`F1 & … & F(k-1)`), the `NoInfer<Input>` handling, and the return type including `PrettifyFeatureResult`. **19 of 20 match exactly.**

**Real defect, fixed:** the 4-feature-with-`input` overload named its first parameter `Input` (capital I) where the other nine use `input`. Confirmed to reach consumers, not just the source: the built package's public `.d.ts` emitted `(Input: Input, …)` for that one overload only, so editor signature help showed a differently-named parameter for that call shape. No behavioral or type-checking effect (parameter names in overload signatures do not participate in assignability), hence low severity.

**Fix**: renamed the parameter to `input` (one-line diff). After the fix the same mechanical check reports all 20 overloads matching, and a rebuilt `.d.ts` emits `(input: Input` for all ten with-input overloads with zero `Input:` remaining. No regression test was added: a parameter name is erased from assignability, so no meaningful runtime or type-level test can observe it.

**Runtime, verified correct:** the discriminator inspects only `args[0]` — a function means every argument is a feature, anything else is the `input` object and is dropped (its values are `undefined` at runtime anyway, since `type<T>()` returns `undefined`). Zero-feature and input-only calls return an identity feature — unreachable for TypeScript callers (every overload needs at least one feature) but sane regardless. Each feature receives and returns a fresh store object, so the `reduce` threads state correctly.

**Two observations (the first since fixed, the second deliberately not changed):** (1) **JSDoc is dropped from the built `.d.ts` for every overloaded function** — module-wide, not specific to this file. The `@description`/`@usageNotes` block sits above the _implementation_ signature, which TypeScript does not emit, so hovering `signalStoreFeature` shows no documentation. Verified by text-matching each function's doc in the built `.d.ts`: `signalStore` (45 signatures), `withState` (2), `signalStoreFeature` (20) and `withHooks` (2) all lose it, while the single-signature features (`withMethods`, `withProps`, `withComputed`, `withLinkedState`) keep theirs. It was left for its own decision at the time, then fixed on request in [issue #402](https://github.com/Terrence721/platform-main/issues/402) by moving the block onto every overload of all four functions. (2) `signalStoreFeature` types up to 10 features while `signalStore` types up to 15 — looks intentional, since larger sets compose by nesting, which the existing spec exercises.

Verified: the 5 related spec files (`signal-store-feature`, its type spec, `signal-store`, `with-feature` and its type spec — 110 tests counting both the runtime and type-check passes, 0 type errors) pass, `npx nx run signals:build` is clean, `eslint` and prettier report nothing on the file.

### [`signal-store-models.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/signal-store-models.ts)

**low · Correctness** — Fixed via [issue #356](https://github.com/Terrence721/platform-main/issues/356)

82 lines of pure types with no runtime code: `StateSignals`, `SignalsDictionary`, `MethodsDictionary`, `SignalStoreHooks`, `InnerSignalStore`, `SignalStoreFeatureResult`, `EmptyFeatureResult`, `SignalStoreFeature` and `SignalStoreFeatureType`. Each declaration was checked against what the runtime actually does, not just read.

**Sound, verified:** `InnerSignalStore` matches the runtime shape `getInitialInnerStore()` produces. `SignalStoreFeatureType`'s three branches (no required input → `Output`; required input → `Input & Output`; bare factory with unresolved input → `Output`) are all exercised by the existing type spec, and its JSDoc example was compiled **verbatim** in a throwaway probe and yields a correctly typed store, so the documentation is not stale.

**Real gap, fixed:** `SignalsDictionary` is keyed by `string | symbol`, but `MethodsDictionary` was `Record<string, Function>` — string keys only — even though the runtime and existing specs plainly support symbol-keyed methods (`withMethods` iterates `Reflect.ownKeys`; `with-state.spec` and `with-methods.spec` use `[METHOD_SECRET]() {}`). A `Record<string, …>` constraint never sees symbol keys. Confirmed with a type-check probe: `withMethods(() => ({ [SYM]: 42 }))` **compiled with no error**, while the string-keyed equivalent is correctly rejected — a symbol-keyed non-function was silently accepted as a "method". Low impact: the inferred store type still says `number` for that key, so nothing is misrepresented; the methods contract just was not enforced for symbol keys.

**Fix**: `MethodsDictionary = Record<string | symbol, Function>` (one line). Blast radius verified before keeping it: the only other user of the type is `with-methods.ts`'s generic constraint, the **full `spec/` directory (112 files, 876 tests, every existing type spec included) passes with 0 type errors**, the library build is clean across all entry points, and the only new compile error anywhere is the intended one. This is a deliberate tightening of a public constraint — code that misused a symbol-keyed non-function as a method now fails to compile; previously valid code is unaffected.

**Regression test**: new `spec/types/with-methods.types.spec.ts` (plain vitest `expectTypeOf` + `@ts-expect-error`, deliberately not the `ts-snippet` style, to avoid that harness's documented contention flakiness) — symbol-keyed methods are accepted and passed on to later features with the right type; a symbol-keyed and a string-keyed non-function are both rejected. Verified two-sided: **fails without the fix** (`Unused '@ts-expect-error' directive`), passes with it. It is also `signals`' first type-level coverage for `withMethods` (the scope of [#174](https://github.com/Terrence721/platform-main/issues/174)), which this real declared-vs-actual finding justifies.

**Suspicion investigated and disproven:** that symbol-keyed methods might not propagate to later features at the type level — they do, with the correct type, both before and after the change (probed with and without a string key alongside). **Deferred to `index.ts`'s own review:** the barrel exports 5 of this file's 9 types; `SignalsDictionary`, `MethodsDictionary`, `SignalStoreHooks` and `InnerSignalStore` are not exported although `InnerSignalStore` and `MethodsDictionary` appear in the signatures of the exported `SignalStoreFeature`/`SignalStoreFeatureResult` — exactly the barrel cross-check that file's review applies.

Verified: `npx nx run signals:build` (clean), the full `spec/` directory as above, `eslint` (0 errors; the 4 `{}`-type warnings on lines 11 and 39 pre-exist on `main` and are unchanged) and prettier on the changed files.

### [`signal-store.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/signal-store.ts)

**low · Test coverage** — Fixed via [issue #396](https://github.com/Terrence721/platform-main/issues/396)

File is 1,432 lines: 45 `signalStore` overload signatures (three families of 15: no config, `{ protectedState?: true }` and `{ protectedState: false }`), a 45-line implementation and the small `getInitialInnerStore()` helper.

**Sound, verified:**

- **All 45 overloads checked mechanically** with the TypeScript compiler API instead of by eye (the method that found the `Input:` typo in `signal-store-feature.ts`): type parameters `F1…Fn` plus `R` from the second overload on, every `Fk` constrained to `SignalStoreFeatureResult`, `R` defaulting to `F1 & … & Fn`, parameters `f1…fn` (after `config` in the two config families), each `fk` taking exactly `F1 & … & F(k-1)` as its input (`EmptyFeatureResult` for `f1`, `{} & F1` for `f2`), and the right return type per family (`StateSource` for the two protected families, `WritableStateSource` for `protectedState: false`). 0 deviations.
- **Implementation:** the config is told from the features by `typeof args[0] === 'function'`; the arguments are copied before `shift()`, so the caller's array is never mutated; the feature chain re-runs per instance from a fresh `getInitialInnerStore()`, so instances share nothing; every member is assigned before `onInit` runs; `inject(DestroyRef)` is only called when an `onDestroy` exists, so a store without one can still be created with `new` outside an injection context.
- **`protectedState` is compile-time only.** Nothing at runtime reads it (checked across `src/`); it only selects between the `StateSource` and `WritableStateSource` overload families, which the existing type spec covers for all three shapes.

**Real gap, fixed:** `providedIn: 'platform'`, half of the public `providedIn?: 'root' | 'platform'` option, had no test anywhere (the specs only cover `'root'`). A throwaway probe confirmed it works (created, injected, `onInit` ran), then a new spec asserts that the instance survives `TestBed.resetTestingModule()`, which only a platform-scoped provider does. Verified two-sided: it passes as written and fails (`expected … to be …`) when the same store is declared `providedIn: 'root'`. Also replaced a `store.x!()` non-null assertion in the neighboring "optional state slices" test with `store.x?.()` (same assertion, clears the spec file's one ESLint warning).

**Observed, not changed (verified, no demonstrable harm):**

- `signalStore()` with no arguments, unreachable through the types (they need at least one feature), throws `TypeError: Cannot read properties of undefined (reading 'providedIn')` because `shift()` hands back `undefined` as the config. Only a plain-JS or `any` caller can hit it.
- A `signalStore` instance carries `STATE_SOURCE` as an ordinary property (enumerable, writable, configurable), while `signalState` defines it locked (non-enumerable, non-writable, non-configurable), so `{ ...store }` copies it. Nothing in the repo depends on either behavior.

**Confirmed module-wide, then fixed on request:** the JSDoc (description plus usage example) sits on the implementation signature, which TypeScript does not publish. It appears **0 times** in the built `ngrx-signals.d.ts`, while 12 `@description` blocks on single-signature functions survive. Four functions are affected: `signalStore` (45 overloads), `signalStoreFeature` (20), `withHooks` (2) and `withState` (2), so hover/IntelliSense on the library's headline API shows no description. TypeScript shows the JSDoc of the overload a call resolves to, so a real fix means copying the block onto every overload (about 38 lines × 45 in this file). That was a call for the maintainer rather than something to fold into a per-file review PR, so it was not changed here; it was fixed afterwards in [issue #402](https://github.com/Terrence721/platform-main/issues/402) (see the entry below).

Verified: `yarn nx test signals` (122 files, 922 tests, 0 type errors), `yarn nx lint signals` (0 errors; the changed spec file now has 0 warnings) and prettier on the changed files.

### `signals` — JSDoc on overloaded functions (`signal-store.ts`, `signal-store-feature.ts`, `with-hooks.ts`, `with-state.ts`)

**low · Documentation** — Fixed via [issue #402](https://github.com/Terrence721/platform-main/issues/402)

A cross-file finding, first recorded as an observation in the `signal-store-feature.ts` and `signal-store.ts` reviews and fixed afterwards on request. The JSDoc (description plus usage example) of every overloaded public function sat on the **implementation signature**, which callers cannot see. TypeScript publishes the JSDoc of each overload and never that of the implementation, so the docs reached neither the built typings nor the editor tooltip. Four functions were affected: `signalStore` (45 overloads), `signalStoreFeature` (20), `withHooks` (2) and `withState` (2).

**Verified before changing anything:** the built `ngrx-signals.d.ts` contained the `signalStore` description 0 times (12 `@description` blocks on single-signature functions survived), and a TypeScript-checker probe on the original source, resolving calls at several arities and both `protectedState` config families, found **no `@description`** on the resolved overload of any of the four functions.

**Fix:** a script moved each doc block verbatim from the implementation signature onto every overload of that function (it asserted that every overload had no comment of its own and every implementation exactly one JSDoc; no code line changed). After a rebuild the built typings carry the block 45 / 20 / 2 / 2 times, and the same checker probe run against the rebuilt package resolves a `@description` for every call shape. **Cost, measured:** the built `ngrx-signals.d.ts` grows from 72.7 KB to 123.8 KB, because the block is repeated on every overload; that is inherent to how TypeScript resolves overload docs, not a tooling artifact.

**Regression test:** new `spec/overload-jsdoc.spec.ts` parses the four source files and fails on any overload without the doc, so a future overload or a moved comment cannot silently drop it again. Verified two-sided: **fails 4/4 before the fix** (the `signalStore` case lists all 45 overloads), passes after. `with-hooks.ts` and `with-state.ts` had this fixed here ahead of their own reviews; those reviews should not re-flag it.

Verified: `yarn nx test signals`, `yarn nx lint signals`, `yarn nx run signals:build`, and `npx prettier --check` on the changed files.

### [`state-source.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/state-source.ts)

**medium · Correctness / Performance** — Fixed via [issue #404](https://github.com/Terrence721/platform-main/issues/404)

248 lines: the `STATE_SOURCE` symbol and its `StateSource` / `WritableStateSource` types, `isWritableSignal` / `isWritableStateSource`, `patchState`, `getState`, `watchState` and the watcher registry behind them. It is `patchState`'s implementation and the last of the `signals` writable-signal callers flagged for extra scrutiny after `deep-signal.ts`, so every function was probed with a throwaway spec rather than only read.

**Sound, verified:** `patchState` hands each updater the accumulating state, sets only the slices whose value changed (identity check), warns about unknown slices in dev mode only, handles symbol keys through `Reflect.ownKeys`, and reads the current state untracked, so calling it inside an effect does not subscribe the effect. The watcher registry is a `WeakMap` keyed by the `STATE_SOURCE` record, so it cannot keep a store alive.

**Four real defects, fixed:**

1. **`getState` is quadratic in the number of slices.** It built the result with `reduce` and an object spread per slice, copying the accumulator once per key. Measured: 50 slices 0.99 ms against 0.02 ms for a one-pass build (49×), 500 slices 95.7 ms against 0.13 ms (762×), 2,000 slices 1.1 s against 1.4 ms (815×). `patchState` calls it once per call and every watcher calls it once per notification. Now `Object.fromEntries(Reflect.ownKeys(signals).map(...))`, which defines the same own data properties in the same order.
2. **A watcher destroyed by an earlier watcher during the same notification still runs.** `notifyWatchers` iterates a snapshot of the list, so a removal made mid-loop was not seen. Probe: watcher A destroys watcher B on `count === 1`; the log was `A0 B0 A1 B1`, with `B1` running after B was destroyed. The loop now skips entries that are no longer registered.
3. **Registering the same function twice, then destroying one registration, removes both.** Watchers were removed by function identity. Probe: one call expected after destroying one of two registrations of the same function, zero received. A shared module-level handler used by two component instances hits this. Each `watchState` call now registers its own entry.
4. **`watchState` never unregisters its `DestroyRef.onDestroy` callback on a manual `destroy()`.** `onDestroy` returns the function that removes the callback, and it was ignored. Probe: 200 watch-then-destroy cycles left **200** callbacks on the injector (0 before), each retaining the watcher and the state source until the injector itself is destroyed.

**Regression tests:** four new specs in `state-source.spec.ts`, one per defect (the `getState` one is a deliberately loose 250 ms limit for 2,000 slices: about 1 ms fixed against about 1 s before). Verified two-sided: with the source reverted, **all four fail** (the timing test took 2,993 ms), with the fix all pass. Also removed three `no-empty-function` warnings in that spec file (two in the new tests, one that was already there).

**Observed, not changed:**

- **A no-op `patchState` still notifies every watcher** (two identity patches produced two extra calls). An existing spec, "does not track signals read in the watcher within a reactive context", relies on an identity patch reaching the watchers, so this looks intended rather than accidental and is left for a decision.
- **A throwing watcher stops the notification.** Later watchers are skipped and `patchState` rethrows although the state was already updated (log `A0 B0 A1`, state `1`, `patchState` threw).
- **`patchState` compares slices with `!==`**, signals use `Object.is`: patching `-0` over `0` does not update the slice, and `NaN` is set every time (harmless, the signal ignores it).
- **`STATE_SOURCE` and `isWritableSignal` are not exported from the barrel**, although `STATE_SOURCE` appears in the public `StateSource` type. Deferred to `index.ts`'s own review.

Verified: `yarn nx test signals` (124 files, 935 tests, 0 type errors), `yarn nx lint signals` (0 errors, 68 warnings, one fewer than before), `yarn nx run signals:build`, `npx prettier --check` on the changed files.

### [`ts-helpers.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/ts-helpers.ts)

**low · Correctness (type-level)** — Fixed via [issue #406](https://github.com/Terrence721/platform-main/issues/406)

52 lines of pure types with no runtime code: `NonRecord`, `Prettify`, `IsRecord`, `IsUnknownRecord`, `IsKnownRecord`, `HasKnownRecordMember`, `NonRecordMembers` and `OmitPrivate`. They decide which state slices get deep signals, so each one was checked two ways: its computed type for a set of edge cases (evaluated through the TypeScript compiler API, not read), and what `toDeepSignal` actually does at runtime for the same value.

**Sound, verified:** 37 edge cases evaluated. `IsKnownRecord` is `true` for plain objects, class instances, `URL`, unique-symbol keys and `Partial<…>`, and `false` for `{}`, `object`, arrays, `Map`, `Date`, functions, `null`, `any`, `never`, `unknown`, `string`/`number`/`symbol` index signatures and mixed known-plus-index types. `HasKnownRecordMember` and `NonRecordMembers` distribute over unions correctly (`{ a: 1 } | string | undefined` keeps `string | undefined`). `OmitPrivate` keeps `readonly` and optional modifiers and drops only `_`-prefixed keys, keeping symbol and numeric keys. `Prettify` leaves arrays alone. The type-level `NonRecord` list matches the runtime `nonRecords` list in `deep-signal.ts` (`Iterable` matches `isIterable`), and for `URL` the type and the runtime agree (`state.url.href()` works).

**Real defect, fixed:** `IsUnknownRecord` recognized `string`, `number` and `symbol` index signatures as dictionaries but not **template-literal pattern keys**. So ``Record<`a-${string}`, number>`` was classified as a known record, and `DeepSignal` gave it ``{ readonly [x: `a-${string}`]: Signal<number> }``, while `Record<string, number>` correctly got a plain `Signal`. Dictionaries are excluded from deep signals on purpose (an index-signature access has no `| undefined`, and the key may be absent at runtime); at runtime an absent key of such a dictionary returns `undefined` (probe: present key `function`, absent key `undefined`), so the type promised a callable signal that was not there. `IsUnknownRecord` now also returns `true` when any key is a pattern: an empty object is assignable to `Record<K, unknown>` only when `K` is a pattern, because a literal key would be required. Blast radius: the full `signals` suite, every existing type spec included, passes unchanged.

**Regression test:** new `spec/types/ts-helpers.types.spec.ts` (plain `expectTypeOf`, deliberately not the `ts-snippet` style, to avoid that harness's documented contention flakiness) pins `IsKnownRecord` for known records, all three index-signature kinds, template-literal patterns (including `id${number}` and a known key mixed with a pattern), built-ins and non-objects, and that `signalState` gives such a dictionary a plain `Signal`. Verified two-sided: **fails against the original source** (both template-literal cases), passes with the fix.

**Observed, not changed:**

- **An Error-shaped plain object gets no deep-signal typing, and its `.name` is mistyped.** Any object type with `name: string` and `message: string` is structurally an `Error`, so `{ name; email; message }` (a contact or comment form) is classified as a non-record: `store.contact.email` is a compile error although the runtime, which checks the prototype, provides it. Worse, `store.contact.name` is typed `string` (the function's own `name`) while the runtime returns a signal (probe: `typeof state.note.name` is `function`). This cannot be fixed at the type level, because a real `Error` instance has exactly the same type: treating the shape as a record would type `store.error.message()` as callable when the runtime value is a real `Error` and returns `undefined`, a worse lie. Left as an inherent limit of structural typing.
- **A null-prototype object typed with known keys** is a known record for the types, but `isRecord` in `deep-signal.ts` returns `false` for it (probe: `state.dict.a` is `undefined`). Null-prototype dictionaries are normally typed with an index signature and so are excluded, which is why this stays a theoretical edge; it would be a one-line runtime change in a closed file, so it is recorded rather than done.

Verified: `yarn nx test signals` (126 files, 945 tests, 0 type errors), `yarn nx lint signals` (0 errors, 68 warnings, none new), `yarn nx run signals:build`, `npx prettier --check` on the changed files.

### [`with-computed.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/with-computed.ts)

**medium · Performance** — Fixed via [issue #408](https://github.com/Terrence721/platform-main/issues/408)

73 lines: `withComputed` wraps `withProps`, turning every function in the factory's dictionary into a `computed()` and passing existing signals through untouched. The types are `ComputedResult` (keeps a `Signal`, `WritableSignal` or `DeepSignal` as it is, turns `() => V` into `Signal<V>`).

**Sound, verified:** the JSDoc example compiles and runs verbatim (`doubleCount()` is `4` for `count` 2). Signals passed in are the same instances in the store (the existing specs for `Signal`, `WritableSignal` and `DeepSignal`), symbol keys work, the factory runs in an injection context (through `withProps`), and the unique-member warning comes from `withProps`, so this file has no guard of its own to get wrong.

**Real defect, fixed:** the result was built with `reduce` and an object spread per key, which copies the accumulator once per computed signal, so it is quadratic in the number of computed signals. Measured against the same members built in one pass through `withProps`: 20 keys 0.69 ms against 0.15 ms, 200 keys 17.7 ms against 1.07 ms, 1,000 keys 510 ms against 11 ms. It runs once per store instance, so the practical cost is small for a typical store, but it is a plain scaling defect and the fix is one line of structure.

**The same pattern, found in a closed file and fixed here (correcting that file's "no findings"):** `signal-state.ts` builds its `stateSource` dictionary and its whole-state `computed` the same way, and the computed re-runs on **every read after a state change**. Measured through the public API: 100 slices create in 7.6 ms and read in 3.4 ms; 500 slices create in 147 ms and read in 98 ms; **2,000 slices create in 1.87 s and read in 1.3 to 1.65 s** (`state()`, before and after one `patchState`). The `signal-state.ts` review (#350) checked the `set`/`update` collision class carefully but did not measure how it scales, so its "no findings" was incomplete. It is the same defect as `getState` in `state-source.ts` (#404), where I fixed it a file earlier.

**Fix:** all three sites are now built in one pass with `Object.fromEntries`, which defines the same own data properties in the same order as the spread did (symbol keys included).

**Regression tests:** two timing specs, `adds many computed signals in linear time` (2,000 keys) and `creates and reads a state with many slices in linear time` (2,000 slices, creation and two whole-state reads). The limits are deliberately loose (400 ms; about 10 ms when linear, seconds when quadratic). Verified two-sided: with the three source changes reverted **both fail** (1,833 ms and 3,107 ms), with the fix both pass. Also removed three `no-empty-function` warnings that were already in `with-computed.spec.ts`.

**Observed, not changed:**

- **A non-enumerable key in the returned dictionary is kept by `withComputed` but dropped by `withProps` and `withMethods`** (probe: `true` against `false`), because this file enumerates the dictionary with `Reflect.ownKeys` while the siblings spread it. It only matters for a dictionary built with `Object.defineProperties`, and keeping the key is arguably the friendlier behavior, so it is recorded rather than aligned.
- **Prototype methods of a class-instance dictionary are silently dropped** (`Reflect.ownKeys` sees own properties only), exactly as in the sibling features.
- The two `{}` in the public return type are the library's own "no members" shape; replacing them would change the printed public type, so those lint warnings stay.

Verified: `yarn nx test signals` (126 files, 949 tests, 0 type errors), `yarn nx lint signals` (0 errors, 65 warnings, 3 fewer than before), `yarn nx run signals:build`, `npx prettier --check` on the changed files.

### [`with-feature.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/with-feature.ts)

**low · Test coverage** — Fixed via [issue #410](https://github.com/Terrence721/platform-main/issues/410)

56 lines: `withFeature` gives a feature factory the store's state signals, props, methods and writable state source, then applies the feature the factory returns to the real inner store. There is no logic of its own beyond building that argument object and calling the factory.

**No functional bug.** Verified with throwaway probes rather than by reading only:

- **Symbol keys reach the factory** for all three member kinds (state signal, prop, method), because the argument object is built with object spread.
- **The factory runs in an injection context** (`inject()` inside it resolves) and **once per store instance** (two instances, two calls), so nothing is shared between stores.
- **Name collisions resolve like the final store does.** With a state slice, a prop and a method all called `x`, the factory sees the method and the built store's `x()` returns the method's value, so the factory never sees a different member than the store ends up with.
- **`patchState` on the store the factory receives updates the real store** (the state source is the same object).
- The unique-member warning comes from whatever feature the factory returns (`withProps`, `withMethods` and so on), so this file has no guard of its own to get wrong. The argument object is built exactly like the ones in `withProps` and `withMethods`; the type includes `WritableStateSource`, the same as theirs (unlike `withComputed`, whose type hides it).

**Real gap, fixed:** the existing spec covered methods, state signals, properties, the writable state source and input types, but not the two contracts its siblings pin: symbol-keyed members and the injection context. Two tests added: `provides symbol-keyed state signals, properties and methods`, and `executes the feature factory in injection context, once per store instance`. Verified two-sided by mutating `with-feature.ts` and restoring it: copying the members without their symbol keys fails the first (and only that) test, and memoizing the feature across instances (which would share one feature's state between stores) fails the second (and only that) test.

Also removed the two `no-unused-vars` warnings that were already in the spec (an unused `id` parameter now used, an unused `state` parameter dropped).

**Observed, not changed:**

- The argument-object construction (`[STATE_SOURCE]` plus the three spreads) exists as a separate copy in `with-props.ts`, `with-methods.ts` and here; a shared helper would remove the duplication, but each copy is four lines and identical, so it is a maintainability note, not a defect.
- The JSDoc example uses `User` and `withEntityLoader`, which are illustrative and not defined, so it is not compilable verbatim (unlike the `signalStoreFeature` example that was checked); it reads correctly as documentation.

Verified: `yarn nx test signals` (126 files, 953 tests, 0 type errors), `yarn nx lint signals` (0 errors, 63 warnings, 2 fewer than before), `npx prettier --check` on the changed files. No source file changed, so no build was needed.

### [`with-hooks.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/with-hooks.ts)

**medium · Correctness** — Fixed via [issue #412](https://github.com/Terrence721/platform-main/issues/412)

127 lines: two overloads (a hooks object, or a factory that returns the hooks) and one implementation that merges each hook with the ones defined by earlier features. The JSDoc it carries on both overloads is the one moved there in #402.

**Sound, verified:** a hook defined later runs after one defined earlier, for `onInit` and for `onDestroy` (both asserted by the existing specs). Hooks receive the state signals, props, methods and writable state source, built exactly like the argument objects in the sibling features. The factory runs in an injection context and the hooks object is read once per store instance, so nothing is shared between stores. On the types side, a mistyped hook name is rejected, a hook that takes a parameter is rejected in the factory form, and the two overloads are told apart correctly.

**Real defect, fixed:** the merged hook called the user's hook as a bare function (`hook(storeMembers)`), so **`this` was `undefined` inside any hook written as a method**. TypeScript disagrees: it types `this` in an object-literal hook method as the hooks object, and a class instance with `onInit`/`onDestroy` methods is accepted by both overloads (`withHooks(new C())` compiles). So the code compiled and then failed when the store was constructed. Probes: a class instance whose `onInit` reads `this.log` threw `TypeError: Cannot read properties of undefined (reading 'log')`; `typeof this` inside an object-literal `onInit` was `undefined`; a factory returning a class instance lost `this.n` the same way. The hooks are now called as methods of their hooks object (`hook.call(hooks, storeMembers)`), which changes nothing for arrow functions and for `this`-free methods.

**Regression tests:** three unit specs in `with-hooks.spec.ts` (a class instance passed as the hooks object, the same class returned by a factory, and `this` in an object-literal method) and one end-to-end test in `signal-store.spec.ts` (a class instance through a real `signalStore`, including `onDestroy`). Verified two-sided: with the source reverted **all three unit specs fail** and the end-to-end test fails with the exact `TypeError` above; with the fix all pass. `withHooks` also had **no type spec at all**, so a new `spec/types/with-hooks.types.spec.ts` (5 tests, plain `expectTypeOf` and `@ts-expect-error`) pins the members a hook receives, the typo and parameter rejections, and the class-instance form. Verified two-sided by mutating the types: letting factory hooks take a parameter turns the rejection test into an "Unused `@ts-expect-error` directive" failure, and removing the writable state source from the hook argument fails the members test.

**Observed, not changed:**

- **`onDestroy` hooks run in registration order, not in reverse.** A feature that relies on a resource created by an earlier feature can find it already torn down. The existing spec `executes new onDestroy hook after previously defined one` asserts exactly this order, so it is deliberate and left alone; recorded because it is easy to assume the opposite.
- **A hook that throws stops the rest of its chain**, because the hooks of all features are composed into one function per lifecycle event.
- **A hook that returns a promise is accepted (its return type is `void`) and is not awaited**, so a rejection is unhandled.
- The argument-object construction is now four separate identical copies (`with-props.ts`, `with-methods.ts`, `with-feature.ts` and here).

Verified: `yarn nx test signals` (128 files, 971 tests, 0 type errors), `yarn nx lint signals` (0 errors, 63 warnings, none new), `yarn nx run signals:build`, `npx prettier --check` on the changed files.

### [`with-linked-state.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/with-linked-state.ts)

**high · Correctness** — Fixed via [issue #414](https://github.com/Terrence721/platform-main/issues/414)

111 lines: `withLinkedState` takes a factory that returns a dictionary of `WritableSignal`s or computation functions, turns every computation into a `linkedSignal`, and registers each result as a new state slice (in the shared state source, like `withState`) with its deep signal. One of the writable-signal callers flagged for extra scrutiny after `deep-signal.ts`, so its behavior was probed rather than only read.

**Sound, verified:** the dev-mode guard and the loop that registers the slices both enumerate the dictionary with `Reflect.ownKeys`, so it cannot have the false-positive warning that `withProps`/`withMethods` had (#352). A computation function becomes a `linkedSignal`, an explicit `linkedSignal` is used as it is, a read-only `computed` returned as-is is linked and not shared (probe: `d` is 100 after a patch while `double` stays 2), and a genuine `WritableSignal` returned as-is is shared on purpose, which is what its type promises (probe: the same signal object). The factory receives state signals and props only; methods and the state source are excluded by design and by the type spec.

**Real defect, fixed: a state slice signal returned as-is was aliased instead of linked.** `isWritableSignal` decided whether a value was a user-supplied `WritableSignal` by checking for `set` and `update`. But every state slice signal on a store is a **deep signal, a proxy over the writable signal it wraps**, and the proxy exposes that signal's `set` and `update`. So `withLinkedState(({ userId }) => ({ value: userId }))`, the exact shape of this repo's own spec `has access to state signals` (which only read the value), registered the source's own writable signal as the new slice. Writing the linked slice then wrote the source: probe with `withState({ a: 1 })` and `withLinkedState(({ a }) => ({ b: a }))`, then `patchState(store, { b: 5 })`, gave **`a = 5` and `b = 5`** (the control with an explicit `linkedSignal` gave `a = 1`, `b = 5`). A slice of _another_ store did the same across stores: `patchState(userStore, { id: 9 })` wrote to the other store's `id`. The types say the opposite: a deep signal is a read-only `Signal`, so `LinkedStateResult` treats it as a computation.

**Fix:** `deep-signal.ts` records every proxy `toDeepSignal` creates in a `WeakSet` and exports `isDeepSignal`; `isWritableSignal` in `state-source.ts` returns `false` for those, so a deep signal falls through to `linkedSignal(...)` like any other read-only signal. No public API changes (neither function is exported from the barrel). Blast radius: the state source only ever holds raw signals, never proxies, so `isWritableStateSource` is unaffected, and the full `signals` suite passes unchanged.

**Regression tests:** two integration tests in `signal-store.spec.ts` (a slice of the same store, and a slice of another store; each checks the source is untouched by a patch of the linked slice and that the linked slice follows the source afterwards) and unit tests for `isWritableSignal` in `state-source.spec.ts` (true for a writable; false for a `computed`, an `asReadonly()`, deep signals including a nested one, and a `deepComputed`). Verified two-sided in a scratch git worktree so that the shared checkout was never touched: against the original sources the three new failing cases fail with `expected 5 to be 1`, `expected 9 to be 1` and `expected true to be false`; with the fix all pass.

**Observed, not changed:**

- The type parameters are ordered `<State, Input>`, the reverse of the sibling features (`<Input, ...>`). Harmless, since both are inferred, and changing it would alter the public signature.
- The state source is mutated in place (`stateSource[key] = ...`), exactly as `withState` does; every store instance starts from a fresh inner store, so nothing is shared between instances.

Verified: `yarn nx test signals` (128 files, 981 tests, 0 type errors), `yarn nx lint signals` (0 errors, 63 warnings, none new), `yarn nx run signals:build`, `npx prettier --check` on the changed files.

### [`with-methods.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/with-methods.ts)

**n/a · Maintainability** — Reviewed, no findings ([issue #416](https://github.com/Terrence721/platform-main/issues/416))

69 lines: `withMethods` builds the argument object (state source, state signals, props and earlier methods), runs the factory, spreads its result, runs the dev-mode unique-member guard and returns the store with the new methods merged in. The key derivation (the guard sees the spread copy, so a non-enumerable key never triggers a false warning) was fixed in the `signal-store-assertions.ts` review (#352) and is not re-flagged here.

**No bug found.** Verified with throwaway probes and a compiler-API check rather than only by reading:

- **`this` behaves as ordinary JavaScript.** A method written with method syntax gets the store as `this` when called as `store.method()` (`this === store`, and sibling members are visible), and `undefined` when called detached. The library never calls the methods itself, so, unlike `withHooks` (#412), it has no receiver to lose.
- **A getter in the returned dictionary is read once, when the feature is applied,** so a getter-based dictionary is a snapshot (probe: one read for two calls).
- **A later feature that redefines a method replaces it for the store, but methods of earlier features keep calling the old one** (probe: `store.foo()` ran the new `foo`, `store.callFoo()`, defined before the override, still ran the old one). That matches the documented "SignalStore members cannot be overridden" warning, which still fires.
- **A class instance is rejected as a methods dictionary by the types** (`Index signature for type 'string' is missing in type 'Service'`), so methods on a prototype cannot be silently dropped by the spread; an object literal compiles.

Already covered by the existing specs: immutability of the input store, the unique-member warning, the non-enumerable case, the input argument, injection context, symbol keys (`signal-store.spec.ts`) and the type spec added in #357. Nothing failed, so no test was added.

**Observed, not changed:**

- The result is cast to `InnerSignalStore<Record<string, unknown>, SignalsDictionary, Methods>`, which widens the state type to `Record<string, unknown>`. The cast is unchecked, but callers only ever see the declared `SignalStoreFeature<Input, …>` return type, so it has no visible effect.
- The argument-object construction (`[STATE_SOURCE]` plus three spreads) is now four separate identical copies (`with-props.ts`, `with-methods.ts`, `with-feature.ts`, `with-hooks.ts`); a shared helper would remove them, but each copy is four lines.

Verified: nothing changed in `modules/signals/src` or its specs; `yarn spell` and `npx prettier --check` on the two docs files.

### [`with-props.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/with-props.ts)

**medium · Correctness (declared vs actual)** — Fixed via [issue #418](https://github.com/Terrence721/platform-main/issues/418)

63 lines: `withProps` builds the same argument object as `withMethods` (state source, state signals, props and methods), runs the factory, spreads its result, runs the dev-mode unique-member guard and merges the result into the store's props. The key derivation was fixed in the `signal-store-assertions.ts` review (#352) and is not re-flagged. The one difference from `withMethods` is the constraint: `Props extends object`, where `withMethods` uses a `Record` type.

**Sound, verified:** the argument object matches the siblings (the type also includes `WritableStateSource`), earlier props are kept (`{ ...store.props, ...props }`), the guard sees the spread copy, and the factory runs in an injection context (covered in `signal-store.spec.ts`, together with symbol and numeric keys).

**Real gap, fixed: the types promise members the runtime silently drops.** The result of the factory is spread, which keeps own enumerable properties only, but `Props extends object` accepts any object. Probe with a class `Api` (own field `baseUrl`, prototype method `url()`, getter `host`) returned from `withProps(() => new Api())`: the compiler typed `store.url('/x')`, `store.host` and `store.baseUrl` all as `string`, while at runtime only `baseUrl` existed (`url` and `host` were `undefined`). A `Map` behaved the same way (`size` typed `number`, `undefined` at runtime, and so is `get`). `withMethods` and `withComputed` reject class instances at compile time through their `Record` constraints, `withProps` does not, so the natural-looking `withProps(() => inject(MyService))` compiles and fails silently at the first call of a method.

**Fix (a dev-mode diagnostic, behavior unchanged):** a new `assertPlainObject` in `signal-store-assertions.ts`, next to `assertUniqueStoreMembers`, is called by `withProps` in dev mode. When the factory returns something other than a plain object (its prototype is neither `null` nor an object whose own prototype is `null`, so a plain object of another realm still counts as plain) it logs one warning that names the class and says what to do:

> `@ngrx/signals: withProps expects a plain object, but received an instance of Api.` / `Only its own enumerable properties are added to the SignalStore; members it inherits from its prototype are ignored.` / `Return an object literal instead, e.g. { service: inject(Service) }.`

What is added to the store is exactly what was added before. No types changed.

**Why a warning and not a tighter constraint:** `Props extends Record<string | symbol, unknown>` would reject class instances at compile time like `withMethods` does, but it also rejects objects typed by an `interface` (interfaces have no implicit index signature), which would break valid consumers. That is a public API change and is recorded as an option for you to decide, not done here.

**Regression tests:** two specs in `with-props.spec.ts`: a class instance logs exactly that warning (and the props still contain only the own field), and an object literal and a `Object.create(null)` object log nothing. Verified two-sided in a scratch git worktree (the shared checkout was not touched): against the original sources the warning test fails with `expected "warn" to be called 1 times, but got 0 times`, and the no-false-positive test passes on both sides; with the change all pass. A whole-module run of `signals` shows **0** occurrences of the new warning, so no library feature or existing spec returns a non-plain object. Also removed four `no-empty-function` warnings that were already in that spec.

**Observed, not changed:**

- A getter in the returned object is read once, when the feature is applied (probe: one read, and two reads of the store member both return `1`), exactly as in `withMethods`: a getter-based prop is a snapshot.
- `withState` accepts `State extends object` in the same way, so `withState(() => new Foo())` may have the same kind of mismatch; that belongs to its own review, next.
- The two `{}` in the public return type are the library's own "no members" shape, so those lint warnings stay.

Verified: `yarn nx test signals` (128 files, 985 tests, 0 type errors), `yarn nx lint signals` (0 errors, 59 warnings, 4 fewer than before), `yarn nx run signals:build`, `npx prettier --check` on the changed files.

### [`with-state.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/with-state.ts)

**medium · Correctness (declared vs actual)** — Fixed via [issue #420](https://github.com/Terrence721/platform-main/issues/420)

89 lines: two overloads (a state object, or a factory returning it, told apart by `typeof … === 'function'`) and the implementation that turns every own key of the state into a signal in the shared state source, plus its deep signal. The JSDoc it carries on both overloads is the one moved there in #402.

**Sound, verified:** the state keys come from `Reflect.ownKeys`, so symbol keys work and, like in `getState` and `signalState`, a non-enumerable own key becomes a slice too (probe), unlike the spread in `withProps`/`withMethods`. The unique-member guard runs before the state source is touched, the factory runs in an injection context (covered in `signal-store.spec.ts`), and the state source is mutated in place exactly like `withLinkedState` does it. The overload split is sound (a factory is a function, a state object is not).

**Real gap, fixed: the types promise members of a class instance that the runtime never creates.** `withState` and `signalState` are constrained only to `State extends object`, and the state is read with `Reflect.ownKeys`, which returns own properties only. Probe with a class `Foo` (own field `field`, prototype method `m()`, getter `g`): the compiler typed `store.m` as `Signal<() => number>` and `store.g` as `Signal<string>` (and the same on a `signalState`), while at runtime `field` was a signal and `m` and `g` were `undefined`. That is the same defect as `withProps` (#418), reachable through a domain class handed in as the state. (An array at the root also creates odd slices, `0`, `1`, `2` and `length`, but an ESLint rule, `with-state-no-arrays-at-root-level`, already covers it; a `Map` simply yields no slices.)

**Fix (a dev-mode diagnostic, behavior unchanged):** the `assertPlainObject` helper added in #418 is now also called by `withState` (on the state it just read, whichever overload) and by `signalState`, and it now takes the hint as a parameter so each caller suggests the right thing (`Pass an object literal with the state slices instead.` for the two state functions, the `inject(Service)` example for `withProps`). The message text was made accurate for all three callers (`Members that it inherits from its prototype are ignored.`, without the "enumerable" claim that only holds for `withProps`). What becomes a slice is exactly what became one before. No types changed.

**Regression tests:** two specs in `with-state.spec.ts` and two in `signal-state.spec.ts` (a class instance logs exactly that warning and only its own field becomes a slice; an object literal and a `Object.create(null)` object log nothing), and the `withProps` spec follows the new wording. Verified two-sided in a scratch git worktree (the shared checkout was not used): against the original sources the three warning tests fail (`expected "warn" to be called 1 times, but got 0 times` for the two new cases, and a message mismatch for the reworded `withProps` one) and the no-false-positive tests pass on both sides; with the change all 46 pass. A whole-module run of `signals` shows the new warning **0** times, so no library feature or existing spec passes a non-plain object.

**Observed, not changed:**

- A non-enumerable own key of the state object becomes a slice (probe), while the same key is dropped by `withProps` and `withMethods`; it follows from `Reflect.ownKeys`, which `getState` and `signalState` also use, so the state functions are consistent with each other.
- A root array is still turned into slices, now with a runtime warning in addition to the lint rule.

Verified in the scratch worktree: `yarn nx test signals` (128 files, 993 tests, 0 type errors), `yarn nx lint signals` (0 errors, 59 warnings, none new), `yarn nx run signals:build`, `npx prettier --check` on the changed files.

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/61e1fdc8421ded83cba45489338afd2fc4c82530/modules/signals/src/index.ts)

**low · Correctness (public API)** — Fixed via [issue #422](https://github.com/Terrence721/platform-main/issues/422)

The package barrel: 31 exported names, re-exported unchanged by `modules/signals/index.ts`. Reviewed with this audit's barrel method, run with the compiler API instead of by eye: for every exported symbol, list the named types and values in its declaration that the barrel does not re-export, then decide for each whether an author of a feature or a wrapper needs to name it.

**Real gap, fixed:** `InnerSignalStore`, `MethodsDictionary` and `SignalStoreHooks` were `export`ed from `signal-store-models.ts` but missing from the barrel, although exported members are made of them: the argument and the result of `SignalStoreFeature` are `InnerSignalStore` (whose `hooks` field is `SignalStoreHooks`), and `SignalStoreFeatureResult.methods` and the type parameter of `withMethods` use `MethodsDictionary`. A library author writing a helper that takes the store a feature receives, or a generic wrapper `<Methods extends MethodsDictionary>` around `withMethods`, could not name them. They were on the list deferred from the `signal-store-models.ts` review (#356). The barrel now exports them next to their siblings (34 names); the file already exported them, so no other source changed.

**Checked, and not a breakage:** realistic consumer code compiled with `declaration: true` against the package (a store, a custom feature, and an alias of `withMethods`) produced no diagnostics, so this is about naming the types when authoring or wrapping features, not about errors in ordinary use. The package's own secondary entry points (`entities`, `events`, `resource`, `rxjs-interop`, `testing`) use only 16 names of the barrel and never reach past it.

**Deliberately left out, with reasons:**

- `SignalsDictionary`: it was on the deferred list, but no exported member's signature mentions it; it only appears in casts inside `signalState`, `withState`, `withMethods` and `withLinkedState`.
- `STATE_SOURCE`: the key of `StateSource` and `WritableStateSource`. Keeping the symbol out of the barrel keeps the writable state source of a store out of reach of code outside the library, which `protectedState` relies on, so hiding it looks intentional.
- `IsKnownRecord`, `HasKnownRecordMember` and `OmitPrivate`: conditional-type plumbing in `DeepSignal`, `StateSignals` and `signalStore`; exporting them would commit to them as public API.
- The local aliases that are not even exported from their own file (`HookFn`, `HooksFactory`, `ProvidedInConfig`, `SignalStoreConfig`, `SignalStoreMembers`, `ComputedResult`, `LinkedStateResult`, `PrettifyFeatureResult`, `DeepSignalRecordMembers`, `DeepSignalNonRecordMembers`): callers get them by inference or with `Parameters<typeof withHooks>[0]`. Same scoping as the earlier barrel reviews.

**Regression test:** new `spec/types/public-api.types.spec.ts` (3 tests, plain `expectTypeOf`): a hand-written `SignalStoreFeature` typed with `InnerSignalStore`, the `hooks` of a store typed with `SignalStoreHooks`, and a generic wrapper of `withMethods` constrained by `MethodsDictionary`. A name that the barrel does not export silently becomes `any` in a spec file, so each test first asserts that the imported name is not `any`; the first version of this spec omitted that and passed vacuously against the unchanged barrel, so it was strengthened before use. Verified two-sided in a scratch git worktree: against the unchanged barrel all 3 tests fail, with the change they pass. The rebuilt package's typings declare the three names as `export type`, while `SignalsDictionary`, `STATE_SOURCE` and `IsKnownRecord` stay unexported.

**This is the last file of the `signals` module: 18/18.** Verified in the scratch worktree: `yarn nx test signals` (130 files, 999 tests passed), `yarn nx lint signals` (0 errors, 59 warnings, none new), `yarn nx run signals:build`; `npx prettier --check` is clean on the changed files.

### [`action/index.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/action/index.ts)

**low · Correctness (generated output)** — Fixed via [issue #424](https://github.com/Terrence721/platform-main/issues/424)

The action schematic (`ng generate @ngrx/schematics:action`): `index.ts` is 49 lines, but what it does is decided together with the template it renders (`files/__name@dasherize@if-flat__/__name@dasherize__.actions.ts.template`) and the `schema.json` its options are validated against, so this review covers the three. It was done by running the built schematic (`dist/`) against a real `@schematics/angular` workspace and reading what it wrote, not from the source alone.

**Real defect, fixed: the default output was not clean code.** With the default options (`api: false`) the generated file was

```ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const FooActions = createActionGroup({
  source: 'Foo',
  events: {
    'Load Foos': emptyProps(),
    ····
    ····
  }
});
```

(`·` = a space): an import of `props` that nothing uses (`TS6133` under `noUnusedLocals`, and `@typescript-eslint/no-unused-vars` in a default Angular lint setup), and two lines that hold only four spaces, left behind by the two `<% if (api) { %>…<% } %>` lines. Both were recorded in the committed snapshots, so they read as expected output. The `props` import and the two api events are now inside the conditional; the default output is `import { createActionGroup, emptyProps } from '@ngrx/store';` and a single event, and the `api: true` output is unchanged.

**Real defect, fixed (declared vs actual): `name` is required, the schema said it was not.** `Schema.name` is a required `string`, but `schema.json` said `"required": []`, so nothing rejected a call without a name and `parseName(options.path, undefined)` crashed with `TypeError: Cannot read properties of undefined (reading 'lastIndexOf')` (probe against the built schematic). `required` is now `["name"]`: interactive `ng generate` still prompts for it (`x-prompt`), and a call without it fails with `Data path "" must have required property 'name'`, the message Angular's own schematics give (its `component`, `service` and `class` schemas require `name`). **The other 9 schematics that take a name (`component-store`, `container`, `data`, `effect`, `entity`, `feature`, `reducer`, `selector`, `store`) have the same `"required": []`.** It is not changed here, to keep this one file per PR: each one gets the same fix and test in the review of its own `index.ts`, so it is not to be re-flagged as new there.

**Coverage gap, closed:** `flat: false`, `flat: false` together with `group`, and a nested name (`bar/foo`) had no test; the existing ones cover the default, `group`, `project` and `prefix`. Probing showed all three behave correctly (`foo/foo.actions.ts`, `actions/foo/foo.actions.ts`, `bar/foo.actions.ts`), so they are pinned by new specs rather than changed.

**Sound, verified:**

- The `if-flat` template function reads `options.flat` and `options.group` when the path is rendered. The boolean option `group` does not shadow `stringUtils.group` in the template scope, because `if-flat` captured the function directly and the template never calls `group(…)`.
- The options object is overwritten (`path`, `prefix`, `name`), as in every schematic here. It is idempotent (a second pass resolves to the same values) and the engine gives each call a fresh object.
- The template reads `api` unguarded, which would be a `ReferenceError` if it were undefined, but the schema default (`false`) is applied both by the CLI and for `schematic('action', …)` as called by `feature`, and `getPrefix` covers a missing `prefix`.

**Observed, not changed:**

- The event name is `<Prefix> <Name>s`, a naive plural: `category` gives `Load Categorys` and `status` gives `Load Statuss` (probe). Other generated code depends on that exact spelling (the `effect` template's `ofType(FooActions.loadFoos)` is built from `<%= prefix %><%= classify(name) %>s`, and the `entity` actions and reducer), so it could only change in all of them together.
- `chain([branchAndMerge(chain([mergeWith(templateSource)]))])(host, context)` nests three rules where one would do; every schematic here has the same shape.
- Spec hygiene: two tests generate the same output (`should create api actions` and `should create api actions (load, success, error) when the api flag is set`, the second one misnamed since the events are `Success` and `Failure`), and the `group` test sits inside `describe('api')`.
- `schema.ts` documents `name` as "The name of the component." (copy-paste; `schema.json` says action). That file is the next row, `action/schema.ts`, and is left to its own review.

**Regression tests** (`index.spec.ts`, 8 new, `it.each` counted per case): the three that pin the fixes fail against the unchanged build: `should only import what it uses when the api flag is not set`, `should not leave lines with only whitespace (api: false)` and `should fail with a validation error if the name is missing`; the other five (the `api: true` variants and the three location specs) pass on both sides, as they document behavior that was already right. The line-ending of the generated file is normalized first: on a Windows checkout the template is CRLF, and `/^[ \t]+$/m` would not match `····\r` and pass vacuously.

**Verification** (in a scratch git worktree, the checkout was given only the finished files): against the unchanged build the three tests above fail; with the change `yarn nx test schematics` passes (50 files, 413 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean. Two snapshots change (the default-output and the custom-prefix one, each losing the `props` import and the two blank lines); the `feature` and `entity` snapshots are unchanged.

### [`action/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/action/schema.ts)

**low · Correctness (declared vs actual)** — Fixed via [issue #426](https://github.com/Terrence721/platform-main/issues/426)

The options type that `index.ts` reads, reviewed against `schema.json`, which validates the same options.

**Real defect, fixed: `prefix` was declared required but is optional.** `Schema.prefix` was `prefix: string`, but nothing requires it: `schema.json` gives it `"default": "load"` without listing it in `required`, and `index.ts` calls `getPrefix(options)`, which falls back to `'load'` when it is missing. A typed caller building a `Schema` had to pass a prefix it doesn't need. It is now `prefix?: string`, the same as `container`, `effect`, `feature` and `reducer`; `action` was the only schematic that declared it required.

**Doc comments, fixed** (in `schema.ts` and the matching `schema.json` descriptions that `ng generate --help` shows):

- `name` said "The name of the component.", which is copy-paste; it now says "The name of the action." (`schema.json` already said so).
- `path` said "The path to create the component."; it now says "The path to create the action file."
- `flat` said "Flag to indicate if a dir is created.", which is backwards: `flat: true` (the default) is the case where no folder is created, as the location specs added in #424 show. It now says what each value does.

**The same wrong `flat` text is in all 10 schematics that have the option, and "The path to create the component." is in 6 more `schema.json` files** (`component-store`, `container`, `effect`, `entity`, `reducer`, `store`). They are not changed here, keeping to one file per PR; each gets the fix in its own `schema.ts` review, so they are not to be re-flagged as new there.

**Sound, verified:** the interface declares exactly the 7 options `schema.json` defines. The blank line between `flat`'s doc comment and the property (removed anyway) did not detach the comment, because TypeScript's JSDoc lookup still attaches it.

**Guard spec:** new `schema.spec.ts` (2 tests) parses `schema.ts` with the TypeScript compiler API and checks it against `schema.json`: the same option names, and only the options `schema.json` requires are non-optional. Against the unchanged file, the second test fails (`expected [ 'name', 'prefix' ] to deeply equal [ 'name' ]`); the first passes on both sides. The spec's own first draft failed the typecheck pass (`.filter(ts.isPropertySignature)` on a union of array types does not narrow), which was fixed before use.

**Verification:** `yarn nx test schematics` passes (52 files, 417 tests, the new spec counted by both the runtime and the typecheck pass; 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean, and prettier is clean on the changed files.

### [`component-store/index.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/component-store/index.ts)

**medium · Correctness (CLI options)** — Fixed via [issue #428](https://github.com/Terrence721/platform-main/issues/428)

The component-store schematic (`ng generate @ngrx/schematics:component-store`), reviewed together with its `schema.json` and templates by running the built schematic against a real `@schematics/angular` workspace and by feeding `schema.json` through the Angular CLI's own option parser (`parseJsonSchemaToOptions` + `addSchemaOptionsToCommand`).

**Real defect, fixed: `--component` also set `--module`, and the reverse.** `schema.json` gave both `component` and `module` the alias `m` (`component`'s is a copy-paste of `module`'s). The CLI honours the singular `alias` key, and yargs merges options that share an alias into one group, so through the CLI's own parser `--component src/app/app.ts` parses to `{ component: 'src/app/app.ts', module: 'src/app/app.ts' }`, and `--module`/`-m` also set `component`. With a normal app this happens to do nothing (a component file has no `@NgModule` to add to, and the reverse), which is why no test caught it; the whole generated tree was confirmed identical to the single-option run. But a file that holds both a component and its NgModule (the single-component-module pattern) gets the store in **both**: `--component widget.ts` added `FooStore` to the `@Component`'s `providers` and to the `@NgModule`'s `providers` (probe), so the app gets an extra module-level instance of what should be a per-component store. The alias is removed from `component`; `-m` now means `--module` only.

**Real defect, fixed (carried over from #424): `name` is required, the schema said it was not.** Same as `action`: `"required": []`, so a call without a name crashed with `TypeError: Cannot read properties of undefined (reading 'lastIndexOf')`. Now `["name"]`, and a missing name gets `must have required property 'name'`.

**Generated output, fixed:** the store template wrote `export interface FooState {};`, a stray semicolon after an interface body. The main generated file, `foo.store.ts`, had no test or snapshot at all (only the module, component and spec files did), which is how this went unnoticed; it is now pinned by a content test and a snapshot.

**Vacuous test, fixed:** `should fail if specified module does not exist` set `thrownError` to `null`, caught into it, and asserted `expect(thrownError).toBeDefined()`, which `null` passes, so the test could not fail. It now asserts the actual message (`Specified module path …/app-moduleXXX.ts does not exist`). Both "does not exist" tests also passed an absolute path, which `findModuleFromOptions`/`findComponentFromOptions` always join onto `path` (they would fail even for a file that exists), so they now use a name relative to the app folder, which is what they meant to test.

**Also found, not changed here (one file per PR):** `container`'s `schema.json` gives `project` and `prefix` the same alias `p`, the same defect class. It gets the same fix and test in `container/index.ts`'s review, so it is not to be re-flagged as new there. A scan of all 12 `schema.json` files found no other shared alias.

**Sound, verified:**

- The generated spec's `new FooStore()` works outside an injection context: `ComponentStore`'s constructor is `@Optional() @Inject(INITIAL_STATE_TOKEN)` with no `inject()` call.
- `createProvidingContext` builds `/${options.path}/…`, which gives a leading `//`, but `buildRelativePath` normalizes it; the import written is `./foo/foo.store` (probe).
- An absolute `--module`/`--component` path is joined onto `path` (`/projects/bar/src/app/projects/bar/src/app/app-module.ts`), so only paths relative to the working directory work. That is `schematics-core`'s `find-module.ts` (already reviewed), and the same convention as Angular's own `findModuleFromOptions`, so it is recorded, not changed.

**Observed, not changed:** a missing module or component throws a plain `Error` in one place and `SchematicsException` in the next (the `host.read` null branch, unreachable after `host.exists`); interactive `ng generate` prompts for both `component` and `module`, and answering both provides the store in both, which is consistent with the options.

**Regression tests** (`index.spec.ts`, 3 new, 2 tightened): against the unchanged build (in a scratch git worktree built from `main`, given only the new spec) exactly the three new ones fail: `should create the component store` (the stray `;`), `should fail with a validation error if the name is missing` (the raw `TypeError`) and `should not give two options the same alias`; the rest pass.

**Verification:** `yarn nx test schematics` passes (52 files, 423 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean. One snapshot is added (the store file); the existing snapshots are unchanged.

### [`component-store/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/component-store/schema.ts)

**low · Documentation** — Fixed via [issue #430](https://github.com/Terrence721/platform-main/issues/430)

The options type that `index.ts` reads, reviewed against `schema.json`, which validates the same options.

**Sound, verified:** the interface declares exactly the 7 options `schema.json` defines, and only `name` is non-optional, which matches `"required": ["name"]` (set by #428). No type changes.

**Doc comments, fixed:**

- `flat` said "Flag to indicate if a dir is created.", which is backwards (`flat: true`, the default, creates no folder), the same text as `action` (#426). It now says what each value does.
- `component` and `module` said "Allows specification of the declaring component/module." (copied from Angular's component schematic). A component store isn't declared anywhere: `index.ts` adds it to the component's or NgModule's `providers`, which is what the options' own prompts say ("should the component store be provided in?"). They now say "The component (path) / The NgModule (path) to provide the component store in."

**Guard spec:** new `schema.spec.ts`, the same check `action/schema.ts` got (#426): option names match `schema.json`, and only the options `schema.json` requires are non-optional. It passes before and after here, since this file's types were already right; it guards against drift.

**Found by running the same check across all 12 schematics (recorded for their own reviews, not changed here):** the 8 schematics not yet reviewed (`container`, `data`, `effect`, `entity`, `feature`, `reducer`, `selector`, `store`) have the known `name` required gap from #424. **New: `reducer`'s `schema.ts` declares `prefix`, but its `schema.json` does not define it**, although `feature` passes `prefix` to the reducer schematic. That is for `reducer`'s review.

**Verification:** `yarn nx test schematics` passes (54 files, 427 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`container/index.ts`](https://github.com/Terrence721/platform-main/blob/e7259e1f9a219ac7019528d09138e58e9a6a1f53/modules/schematics/src/container/index.ts)

**medium · Correctness (generated output)** — Fixed via [issue #432](https://github.com/Terrence721/platform-main/issues/432)

The container schematic (`ng generate @ngrx/schematics:container`) runs `@schematics/angular`'s `component` schematic, adds `Store` to the component, and writes its own spec. It was reviewed with its `schema.json` and both spec templates by running the built schematic against an Angular 22.2 workspace, type-checking what it wrote, and comparing `schema.json` with Angular's own component schema.

**Real defect, fixed: the generated spec did not compile, with default options.** Angular 22 names the component file `foo.ts` and the class `Foo`, but both spec templates hard-coded `import { FooComponent } from './foo.component'`. `index.ts` already knew about the new naming (it falls back from `foo.component.ts` to `foo.ts` when adding `Store`), but the templates were rendered from the options alone, before the component existed. Type-checking the generated specs next to the real generated `foo.ts` (strict, Vitest globals):

- the integration spec (the default `testDepth`): `TS2307 Cannot find module './foo.component'` and `TS2304 Cannot find name 'spyOn'`;
- the unit spec: `TS2307` and `TS2552 Cannot find name 'Store'` (it called `TestBed.inject(Store)` but imported only `MockStore`).

Both also put the component in `declarations`, which fails at runtime for a standalone component (the default). The fixed specs type-check with no errors.

The spec is now rendered by a new rule after the component exists. It reads the component's file name, class name and `standalone` flag from the generated file, so the result is right whichever naming or standalone setting the workspace uses. The spec is written as `foo.spec.ts` next to `foo.ts`, as Angular does, instead of `foo-component.spec.ts`. A standalone component goes in `imports`, a non-standalone one in `declarations`. The unit spec injects `MockStore`. The integration spec drops `spyOn(store, 'dispatch').and.callThrough()`: nothing asserted on the spy, and `spyOn` is a Jasmine global that Vitest, the default test runner for new Angular workspaces (`testRunner` default `vitest`), does not provide.

**Real defect, fixed: `viewEncapsulation` offered a value Angular rejects and missed the one it accepts.** The enum was `["Emulated", "Native", "None"]`, but Angular's component schema (which has `additionalProperties: false` and validates the options passed on) takes `["Emulated", "None", "ShadowDom"]`. `Native` was removed from Angular years ago. So `--view-encapsulation Native` passed this schema and then failed Angular's, and `--view-encapsulation ShadowDom` was rejected by this schema: no value gave shadow-DOM encapsulation (probe). The enum now matches Angular's, and `schema.ts`'s matching type union changes with it (the rest of `schema.ts` is left to its own review).

**Real defect, fixed: `project` and `prefix` shared the alias `p`** (the defect class found in #428), so `-p app` set both. `prefix` loses its alias; `-p` stays `--project`, as in every other schematic here.

**Real defect, fixed (carried over from #424):** `"required": []` → `["name"]`; a missing name crashed with a raw `TypeError`.

**Weak tests, tightened:** `should remove .ts from the state path if provided` and `should remove index.ts from the state path if provided` only checked that `foo.ts` existed. They now assert the import they are named for (`'../reducers/foo'`, `'../reducers'`). Probing showed both already worked. The two existing spec snapshots recorded the broken output; they are regenerated and backed by explicit assertions.

**Observed, not changed:**

- `stateInterface` (`default: "State"`) has no effect. It appears only in the early-return guard `if (!options.state && !options.stateInterface)`, which its default keeps from ever firing, and the `Store` it adds is untyped. Whether to remove the option or make it type the store is a design decision, raised with the repo owner instead of changed here.
- `--state reducers` (a folder) throws `The Specified state path //projects/bar/src/app/reducers does not exist`: a schematic `Tree` only knows files, so the documented form is the file (`reducers/index.ts`), which works. The message also has a doubled leading slash.
- `standalone` has `default: true` in this schema, so it is always passed to Angular's component schematic and overrides any `standalone` default a workspace sets for `@schematics/angular:component`.
- The `foo.component.ts` branch of `getComponentPath` is only reached when a workspace default sets the component type, which the test runner doesn't apply, so it is covered by reading, not by a test.

**Regression tests** (`index.spec.ts`, 13 new with `it.each` counted per case, 4 tightened): against the unchanged build (a scratch git worktree built from `main`, given only the new spec) 15 fail and 29 pass. Every test that pins a fix fails there: the spec's location and names, the non-standalone `declarations`, the missing name, the shared alias, both `ShadowDom` tests, and the two tightened snapshot tests. The whitespace tests also fail there, but only because the old build writes no `foo.spec.ts`; their job is to guard the new templates' `standalone` branches. The spec reader asserts the file exists, because `readContent` returns `''` for a missing file, which let the first draft's `not.toMatch` checks pass vacuously against the old build. That was caught by the two-sided run and fixed before use.

**Verification:** `yarn nx test schematics` passes (54 files, 449 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`container/schema.ts`](https://github.com/Terrence721/platform-main/blob/8d5215f37a7f0d7cfef4c1b5c428449701354d06/modules/schematics/src/container/schema.ts)

**low · Correctness (declared vs actual)** — Fixed via [issue #434](https://github.com/Terrence721/platform-main/issues/434)

The options type that `container/index.ts` reads, reviewed against `schema.json`.

**Real defect, fixed: `stateInterface` had no effect (raised in #432; the repo owner chose to make it work).** It was declared and documented ("Specifies the interface for the state", default `"State"`), but `index.ts` only read it in a guard that its default keeps from ever firing, and the `Store` it added was untyped. With `--state`, the injected store is now typed by it: `constructor(private store: Store<fromStore.State>)` by default, `Store<fromStore.AppState>` with `--state-interface AppState`. Without `--state` there is no `fromStore` import to type it from, so the store stays untyped, as before. Both generated forms type-check next to a real state file. **The code change is in `index.ts`** (a file closed with #432), because that is where the option is read; it is reported under this file because the defect is that `schema.ts` declares an option the code ignored.

**Loose type, narrowed:** `testDepth?: string`, but `schema.json` only allows `"unit" | "integration"`. It is now that union.

**Doc comments, fixed (in `schema.ts` and, where the text was wrong there too, the `schema.json` descriptions `--help` shows):**

- `flat` said "Flag to indicate if a dir is created.", which is backwards, the same text as #426/#430. Here `flat` has no schema default, so Angular's `false` applies and a folder is created (probe in #432).
- `stateInterface` now says what it does.
- Missing full stops on `state` and `standalone`.

**Checked, correct as is:** `module` says "the declaring module", which is right here: a non-standalone container _is_ declared in an NgModule, unlike the component store in #430. The option names and the non-optional `name` match `schema.json` (the guard spec below).

**Guard spec:** new `schema.spec.ts`, the same check as `action` and `component-store`. It passes before and after here, since names and required already matched.

**Regression tests** (`index.spec.ts`, 3 new): `should type the store with the default State interface of the state file` and `…with the given interface…` fail against the unchanged build, and pass with the fix. `should leave the store untyped without a state file` passes on both sides, since that behavior is unchanged. One snapshot changes (`should import Store into the component`: `Store` → `Store<fromStore.State>`). The spec's `it.each` tables became `as const` to fit the narrowed `testDepth`.

**Verification:** `yarn nx test schematics` passes (56 files, 459 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`data/index.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/data/index.ts)

**medium · Correctness (generated output)** — Fixed via [issue #436](https://github.com/Terrence721/platform-main/issues/436)

The data schematic (`ng generate @ngrx/schematics:data`) writes an entity model, an `EntityCollectionServiceBase` service and its spec. It was reviewed with its `schema.json` and templates by running the built schematic and then **running the spec it generated** inside the `data` module's own test setup (a scratch git worktree, so no generated file touched the checkout).

**Real defect, fixed: the generated spec failed.** It type-checked, but running it failed:

```
NG0201: No provider found for `EntityDispatcherFactory`.
Path: HeroService -> EntityCollectionServiceElementsFactory -> EntityDispatcherFactory
```

The spec provided only `EntityCollectionServiceElementsFactory` and the service. That factory depends on the rest of `@ngrx/data` (dispatcher, selectors and definition services), which depend on the store. So every freshly generated data service came with a failing test. The spec now provides `provideStore()` and `provideEntityData({ entityMetadata: { Hero: {} } })` and injects the service (it is `providedIn: 'root'`), and the generated spec passes when run. Each part is needed: without the `Hero` entry it fails with `No EntityDefinition for entity type "Hero"` (tried), because in an app that entry comes from the app's entity metadata. `withEffects()` is not needed, since the service does not touch HTTP until it is used. The spec also drops a needless `compileComponents()` (there are no components).

**Real defect, fixed (carried over from #424):** `"required": []` → `["name"]`; a missing name crashed with a raw `TypeError` (probe). `name` also gets the `x-prompt` every other schematic has, so interactive `ng generate` asks for it instead of failing now that it is required.

**Coverage gaps, closed:** `skipTests: true`, `flat: false` and `group` had no test (only the defaults were covered). All three already worked, and the new tests pin them. The spec file was only snapshotted, which is how the broken setup was locked in; it now has explicit assertions too.

**Sound, verified:** the service template injects `EntityCollectionServiceElementsFactory` with `inject()` and passes the classified entity name, which matches the `entityMetadata` key the spec registers; `if-flat` plus `group` gives `data/<name>/` (probe).

**Left for `data/schema.ts`'s review:** the backwards `flat` doc text, and `path` saying "The path to create the service." (three files are created).

**Regression tests** (`index.spec.ts`, 4 new): against the unchanged build, `should provide what the service needs in the spec` and `should fail with a validation error if the name is missing` fail; the `skipTests` and `flat`/`group` tests pass on both sides, as they pin behavior that was already right. One snapshot changes (the spec file).

**Verification:** `yarn nx test schematics` passes (56 files, 467 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean; the spec generated by the fixed build passes when run in the `data` module (scratch worktree).

### [`data/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/data/schema.ts)

**low · Documentation** — Fixed via [issue #438](https://github.com/Terrence721/platform-main/issues/438)

The options type that `data/index.ts` reads, reviewed against `schema.json`.

**Sound, verified:** the interface declares exactly the 6 options `schema.json` defines, and only `name` is non-optional, which matches `"required": ["name"]` (set by #436). No type changes.

**Doc comments, fixed:**

| Option               | Was                                                                                                                                                                      | Now                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `name` (`schema.ts`) | The name of the component.                                                                                                                                               | The name of the data entity. (`schema.json` already said so)                                                                  |
| `path`               | "The path to create the component." (`schema.ts`), "…the service." (`schema.json`)                                                                                       | The path to create the entity model, service and spec.                                                                        |
| `flat`               | Flag to indicate if a dir is created. (backwards, as in #426/#430/#434)                                                                                                  | When true (the default), creates the files in the path directly; when false, creates them in a folder named after the entity. |
| `group`              | "Group entity metadata files within 'data' folder" (`schema.ts`; the schematic writes no metadata file), "Group the services within relative subfolders" (`schema.json`) | When true, creates the files within a data folder.                                                                            |

Probed before writing them: `group` puts all three files in `data/` (`data/hero.ts`, `data/hero.service.ts`, `data/hero.service.spec.ts`), and `flat: false` puts them in `hero/`. A stray blank line between `flat`'s comment and the property is removed.

**Guard spec:** new `schema.spec.ts`, the same check as the other reviewed schematics. It passes before and after here.

**Verification:** `yarn nx test schematics` passes (58 files, 471 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`effect/index.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/effect/index.ts)

**medium · Correctness (generated output)** — Fixed via [issue #440](https://github.com/Terrence721/platform-main/issues/440)

The effect schematic (`ng generate @ngrx/schematics:effect`), reviewed with its `schema.json` and templates by running the built schematic, and by type-checking what it generated (strict, with `noUnusedLocals`) together with the `action` file and the NgModule it registers in.

**Real defect, fixed: with `--flat false --group` the NgModule imported a file that does not exist.** `index.ts` built the import path by hand (`<name>/` then `effects/`), while the template's `if-flat` puts the file in `effects/<name>/` (probe):

|                 | Before                                         | After                         |
| --------------- | ---------------------------------------------- | ----------------------------- |
| file written to | `effects/foo/foo.effects.ts`                   | `effects/foo/foo.effects.ts`  |
| NgModule import | `'./foo/effects/foo.effects'` (does not exist) | `'./effects/foo/foo.effects'` |

The other combinations matched. The import path and the template now use one `effectsFolder` function, so they cannot drift apart again. **`schematics-core`'s `ngrx-utils.ts` builds reducer paths the same way (`<name>/` then `reducers/`, two places)**, so the reducer registration probably has the same bug. `schematics-core` is closed, so that is left to be probed in `reducer`'s review.

**Real defect, fixed: a missing name wrote nameless files.** `parseName(options.path, options.name || '')` never failed, so a call without a name created `.effects.ts` and `.effects.spec.ts` (class `Effects`), with no error (probe). **Unlike the other schematics, `name` cannot simply be made required here:** `--root --minimal` is designed to run without one (it registers `EffectsModule.forRoot([])` and creates no file), and an existing test covers that. A first attempt that set `"required": ["name"]` broke exactly that test, and was reverted. `index.ts` now throws `A name is required, except with --root --minimal.` in every other case.

**Generated code, fixed (the class #424 fixed for `action`):**

- The default (non-feature) effect imported `createEffect` without using it, which the default Angular ESLint setup (`no-unused-vars`) flags.
- The `feature` + `api` effect imported `Observable` without using it.
- Every variant had runs of blank lines from the `<% if %>` lines, including one right after `pipe(`.

The template now imports only what each variant uses and leaves no blank runs. Type-checking the generated default, `feature` and `feature` + `api` effects (with their actions), and the nested-and-grouped NgModule, gives no errors apart from the scaffold's own `private actions$` being unread in the default effect. That is only reported under `noUnusedLocals`, which new Angular workspaces don't enable, and it is the starting point the user's effects will use, so it is kept.

**Vacuous test, fixed:** `should fail if specified module does not exist` ran the schematic `'effects'`, which the collection does not have (it is `effect`, alias `ef`), so it passed on `Schematic "effects" not found in collection`, even for a module that exists (probe). It now runs `effect` and asserts the real message.

**Snapshots:** the 5 effect snapshots and 3 `feature` snapshots (which include the effects file `feature` generates) change only by the removed blank lines and imports.

**Regression tests** (`index.spec.ts`, 7 new, `it.each` counted per case): against the unchanged build (a scratch git worktree built from `main`) all 7 fail: the nested-and-grouped import, the missing name, the two import tests and the three blank-line cases.

**Verification:** `yarn nx test schematics` passes (58 files, 483 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`effect/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/effect/schema.ts)

**low · Correctness (declared vs actual)** — Fixed via [issue #442](https://github.com/Terrence721/platform-main/issues/442)

The options type that `effect/index.ts` reads, reviewed against `schema.json`.

**Real defect, fixed: `name` was declared required, but it is optional by design.** `schema.ts` had `name: string`, while `schema.json` requires nothing, and #440 established why: `--root --minimal` runs without a name (it registers `EffectsModule.forRoot([])` and creates no file), and `index.ts` rejects a missing name in every other case. A typed caller of that minimal mode had to pass a name it doesn't need. It is now `name?: string`. The guard spec (below) failed on it before the change (`expected [ 'name' ] to deeply equal []`).

That made two places in `index.ts` (closed with #440) no longer type-check as they relied on `name` being a `string`. Behavior is unchanged in both: `addImportToNgModule` reads it into a local `name` (it is always set by then, `''` only in minimal mode), and `findModuleFromOptions` gets a copy with the narrowed `name` (it only reads its options).

**Doc comments, fixed (in `schema.ts`, and in `schema.json` where the `--help` text was wrong too):**

- `name` said "The name of the component."; it now says it is the effect's name and is not needed with `--root --minimal`.
- `path` (`schema.json`) said "component".
- `flat` was backwards, the same text as #426/#430/#434/#438.
- `module` said "the declaring module", but effects are registered in a module, not declared, which is what the option's own prompt says ("should the effect be registered in?").
- `feature` said "grouped within a feature" / "part of a feature schematic". What it does is generate a sample effect wired to the feature's actions, as the `feature` schematic does.
- Also: `root` now names `EffectsModule.forRoot`, and missing full stops are added.

**Guard spec:** new `schema.spec.ts`, the same check as the other reviewed schematics. Unlike most of them, it fails against the unchanged file here, on `name`.

**Verification:** `yarn nx test schematics` passes (60 files, 487 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`entity/index.ts`](https://github.com/Terrence721/platform-main/blob/6293894e5c2b00c12933fedbebe7268baf7453f8/modules/schematics/src/entity/index.ts)

**medium · Correctness** — Fixed via [issue #444](https://github.com/Terrence721/platform-main/issues/444)

The entity schematic (`ng generate @ngrx/schematics:entity`) writes a model, actions, a reducer and its spec, and registers the reducer in an NgModule. It was reviewed with its `schema.json` and templates by running the built schematic against both an NgModule app and a standalone app.

**Real defect, fixed: `ng generate entity` failed in a standalone app.** `index.ts` called `findModuleFromOptions` unconditionally, so without `--module` it searched for the nearest NgModule. A standalone app, the default since Angular 17, has none, so the schematic stopped with

```
Could not find an NgModule. Use the skip-import option to skip importing in NgModule.
```

and generated nothing. That message also points at an option this schematic does not have (`entity` has no `skipImport`), so there was no way through. It is the unguarded call the #305/#307 review assumed no caller made. Now, without `--module`:

| App            | Before                                                    | After                                                                                  |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| NgModule app   | files created, reducer registered in the nearest NgModule | unchanged                                                                              |
| standalone app | error, no files                                           | files created; registering the feature (`provideState(fooFeature)`) is left to the app |

Only the "could not find" case is caught. An explicit `--module` that does not exist, and "more than one module matches", still fail as before.

**Real defect, fixed (carried over from #424):** `"required": []` → `["name"]`; a missing name crashed with a raw `TypeError`. `entity` has no mode that runs without a name (unlike `effect`, #440), so making it required is right here.

**Coverage gap, closed:** auto-registration without `--module` in an NgModule app had no test. It is now pinned, so the fix above cannot quietly drop it. A test for a `--module` that does not exist is added too.

**Sound, verified:**

- The registration paths match where the files are written in every combination, including `--flat false --group` (`./foo/reducers/foo.reducer`). The `<name>/` + `reducers/` order `schematics-core`'s `ngrx-utils.ts` builds (flagged in #440) is right for `entity`'s layout. It still has to be checked against the `reducer` schematic's layout in that review.
- The templates are consistent: the reducer handles every action the actions file declares, and the feature key and selectors come from one `createFeature`.

**Observed, not changed:** `index.ts` imports `SchematicsException` and `template` without using them, and assigns `getProject(...)` to an unused `projectConfig`. Lint does not flag them, and the `getProject` call has a side effect (it fills in the default project), so the call stays.

**Regression tests** (`index.spec.ts`, 4 new): against the unchanged build (a scratch git worktree built from `main`), the standalone-app test (`Could not find an NgModule…`) and the missing-name test (the raw `TypeError`) fail. The NgModule auto-registration and the missing-module tests pass on both sides, as they pin behavior that was already right. No snapshot changes.

**Verification:** `yarn nx test schematics` passes (60 files, 495 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`entity/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/entity/schema.ts)

**low · Documentation** — Fixed via [issue #446](https://github.com/Terrence721/platform-main/issues/446)

The options type that `entity/index.ts` reads, reviewed against `schema.json`.

**Sound, verified:** the interface declares exactly the 9 options `schema.json` defines, and only `name` is non-optional, which matches `"required": ["name"]` (set by #444). No type changes.

**Doc comments, fixed:**

| Option               | Was                                                                                                                           | Now                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (`schema.ts`) | The name of the component.                                                                                                    | The name of the entity.                                                                                                                   |
| `path`               | "The path to create the effect." (`schema.ts`), "…the component." (`schema.json`)                                             | The path to create the entity files.                                                                                                      |
| `flat`               | Flag to indicate if a dir is created. (backwards, as in every schematic so far)                                               | When true (the default), creates the files in the path directly; when false, creates them in a folder named after the entity.             |
| `module`             | "Allows specification of the declaring module." / "Specifies the declaring module."                                           | The NgModule (path) to register the reducer in. Without it, the nearest NgModule is used, if the app has one (the behavior #444 settled). |
| `reducers`           | "Allows specification of the declaring reducers." / "Specifies the reducers file."                                            | The reducers file (path) to add the entity reducer to.                                                                                    |
| `group`              | "grouped within sub folders" / "Group actions, reducers and effects within relative subfolders" (`entity` creates no effects) | When true, puts the actions, model and reducer in `actions`, `models` and `reducers` folders (probed in #444).                            |
| `feature`            | "grouped within a feature" / "Flag to indicate if part of a feature schematic."                                               | Set by the feature schematic; it does not change what this schematic generates.                                                           |

**Observed, not changed: `feature` has no effect.** Nothing in `entity`'s `index.ts` or templates reads it. The `feature` schematic passes `feature: true`, and the option is hidden from `--help` (`visible: false`). Removing it would be a design change, so it is only documented accurately.

Stray blank lines between five doc comments and their properties are removed, and the spacing between members is made consistent.

**Guard spec:** new `schema.spec.ts`, the same check as the other reviewed schematics. It passes before and after here.

**Verification:** `yarn nx test schematics` passes (62 files, 499 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`feature/index.ts`](https://github.com/Terrence721/platform-main/blob/6293894e5c2b00c12933fedbebe7268baf7453f8/modules/schematics/src/feature/index.ts)

**medium · Correctness (generated output)** — Fixed via [issue #448](https://github.com/Terrence721/platform-main/issues/448)

The feature schematic (`ng generate @ngrx/schematics:feature`) runs `action`, `reducer`, `selector` and `effect` (or `entity` and `effect` with `--entity`). It was reviewed by generating every variant into an NgModule app and a standalone app, and **type-checking all the generated code** (strict) against the built `@ngrx/store`, `@ngrx/effects` and `@ngrx/entity` type declarations.

**Real defect, fixed: `--entity --api` and `--entity --prefix` generated effects that did not compile.** In entity mode the actions come from the `entity` schematic, which declares fixed events (`Load Foos`, `Add Foo`, …) with no success or failure actions. But `feature` still passed `api` and `prefix` to the `effect` schematic, so the effect referenced actions that do not exist:

```
entity-api/foo.effects.ts:     TS2339: Property 'loadFoosSuccess' does not exist on type 'ActionGroup<"Foo/API", …>'
entity-api/foo.effects.ts:     TS2339: Property 'loadFoosFailure' does not exist …
entity-prefix/foo.effects.ts:  TS2339: Property 'customFoos' does not exist …
```

In entity mode the effect is now generated to match the entity actions (`prefix: 'load'`, no api branch), so it uses `FooActions.loadFoos`, which `Load Foos` provides. All entity variants type-check. The `action`-based variants were already correct and are unchanged.

**`name` now required** in `feature`'s own schema, for consistency with the rest of the module. Unlike the other schematics, this was not a crash here: the `action` (or `entity`) schematic that `feature` calls already rejected a missing name with the same message (the test passes against the unchanged build too), so it now just fails one step earlier.

**Confirmed here, left to `reducer`'s review (the code is not in this file):**

- **`--flat false --group --module` writes a broken NgModule import.** The reducer goes to `reducers/foo/foo.reducer.ts`, but the NgModule imports `./foo/reducers/foo.reducer` (`TS2307`). That is the `<name>/` + `reducers/` path order in `schematics-core`'s `ngrx-utils.ts` predicted in #440. `entity`'s layout matches it (#444), but the `reducer` schematic's layout does not. It is written by the `reducer` schematic's registration, so it is fixed there.
- **`ng generate feature` fails in a standalone app** with `Could not find an NgModule` (the #444 defect) unless `--skip-import` is given (`feature` has that option; with it, all files are created). The failing lookup is the `reducer` schematic's, since `action`, `selector` and `effect` do not search for a module. So it is fixed in `reducer`'s review, which also fixes `feature`.

**Sound, verified:** `skipImport` passed through to `entity` is honored (`findModuleFromOptions` reads it though `entity`'s schema does not declare it). Every other variant type-checks: default, `--module`, `--api`, `--entity`, `--group`, and the standalone app with `--skip-import`.

**Regression tests** (`index.spec.ts`, 3 new): against the unchanged build (a scratch git worktree built from `main`), the two entity tests fail (`loadFoosSuccess`, `customFoos`). The missing-name test passes on both sides, for the reason above. No snapshot changes.

**Verification:** `yarn nx test schematics` passes (62 files, 505 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`feature/schema.ts`](https://github.com/Terrence721/platform-main/blob/6293894e5c2b00c12933fedbebe7268baf7453f8/modules/schematics/src/feature/schema.ts)

**low · Documentation** — Fixed via [issue #450](https://github.com/Terrence721/platform-main/issues/450)

The options type that `feature/index.ts` reads, reviewed against `schema.json`.

**Sound, verified:** the interface declares exactly the 12 options `schema.json` defines, and only `name` is non-optional, which matches `"required": ["name"]` (set by #448). No type changes.

**Doc comments, fixed** (every description was checked against probes from #444/#448):

| Option                           | Was                                                                                                                                                   | Now                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefix`, `entity` (`schema.ts`) | no doc comment at all                                                                                                                                 | documented (below)                                                                                                                                             |
| `flat`                           | Flag to indicate if a dir is created. (backwards)                                                                                                     | When true (the default), creates the files in the path directly; when false, creates them in a folder named after the feature.                                 |
| `module`                         | "Allows specification of the declaring module." / "Specifies the declaring module."                                                                   | The NgModule (path) to register the reducer and effects in.                                                                                                    |
| `reducers`                       | "Allows specification of the declaring reducers." / "Specifies the reducers file."                                                                    | The reducers file (path) to add the feature reducer to.                                                                                                        |
| `group`                          | "grouped within sub folders" / "Group actions, reducers and effects within relative subfolders" (it also groups selectors, and models with an entity) | When true, puts each file in a folder for its kind: actions, reducers, selectors, effects (and models with an entity).                                         |
| `api`, `prefix`                  | no mention of `entity`                                                                                                                                | Now say they have no effect with `entity`, whose actions have fixed names and no success or failure actions (the behavior #448 made explicit).                 |
| `entity` (`schema.json`)         | Toggle whether an entity is created as part of the feature                                                                                            | When true, creates an @ngrx/entity model, actions and reducer (instead of the action, reducer and selector schematics), and an effect that uses those actions. |

**Guard spec:** new `schema.spec.ts`, the same check as the other reviewed schematics. It passes before and after here. It uses `import ts from 'typescript'`, not the namespace import the earlier guard specs copied, following the repo owner's decision (2026-09-27) to convert every `import * as ts from 'typescript'` in `modules/` (TypeScript suggestion 80003) in a separate PR after this one.

**Verification:** `yarn nx test schematics` passes (64 files, 509 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`ng-add/index.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/ng-add/index.ts)

**low · Correctness (idempotency)** — Fixed via [issue #454](https://github.com/Terrence721/platform-main/issues/454)

`ng-add` for `@ngrx/schematics` makes it a default schematic collection: it adds `@ngrx/schematics` to `cli.schematicCollections` in `angular.json`, first moving a legacy `cli.defaultCollection` into that list. It was reviewed by running the built schematic against a real workspace, and by reading how the Angular CLI reads the setting.

**Real defect, fixed: not idempotent.** Nothing checked whether a collection was already listed (probe):

| Case                                           | Before                                     | After                  |
| ---------------------------------------------- | ------------------------------------------ | ---------------------- |
| `ng-add` run twice                             | `["@ngrx/schematics", "@ngrx/schematics"]` | `["@ngrx/schematics"]` |
| legacy `defaultCollection: "@ngrx/schematics"` | `["@ngrx/schematics", "@ngrx/schematics"]` | `["@ngrx/schematics"]` |

The CLI reads the list into a `Set` (`schematics-command-module.js`), so the duplicate does not break generation, but it accumulates in the user's `angular.json` on every run. Each collection is now added only if it is not listed yet.

**Sound, verified:**

- With no `schematicCollections`, the list becomes `["@ngrx/schematics"]` alone, which drops the implied `@schematics/angular` default. That is fine, because `@ngrx/schematics`' `collection.json` `extends` `@schematics/angular`, so `ng generate component` and the rest still resolve.
- A legacy `defaultCollection` is moved into the list ahead of `@ngrx/schematics` and removed (existing test).

**Observed, not changed:** `angular.json` is rewritten with `JSON.stringify(…, 2)`, which normalizes its formatting. That is standard for schematics.

**Regression tests** (`index.spec.ts`, 2 new): both fail against the unchanged build (the duplicate entry) and pass with the fix.

**Verification:** `yarn nx test schematics` passes (64 files, 513 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (16 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`ng-add/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/ng-add/schema.ts)

**low · Lint** — Fixed via [issue #456](https://github.com/Terrence721/platform-main/issues/456)

The file was `// eslint-disable-next-line @typescript-eslint/no-empty-interface` followed by `export interface Schema {}`, the options type of `ng add @ngrx/schematics`, whose `schema.json` defines no options.

**Real defect, fixed: one of the module's standing lint warnings.** typescript-eslint v8 deprecated `no-empty-interface` in favour of `no-empty-object-type`. The repo config enables both: the old one as an error, which the comment suppressed, and the new one as a warning, which it did not. So the line was reported:

```
2:18  warning  An empty interface declaration allows any non-nullish value, including literals like `0` and `""`.  @typescript-eslint/no-empty-object-type
```

That was one of the 16 warnings `nx lint schematics` has reported throughout this review. As the rule says, `{}` means "any non-nullish value", not "no options". The file is now `export type Schema = Record<string, never>;` with a doc comment. That type means an options object with no properties, neither rule flags it, and the disable comment is gone. The warning count drops to 15.

**Sound, verified:** nothing imports `Schema`, since `ng-add`'s `index.ts` takes no options (#454), so the change cannot affect a caller. `schema.json` has `"properties": {}`, which the new type matches.

**Same pattern elsewhere, not changed here:** `ngrx-push-migration/schema.ts` (a later row of this module, to get the same fix in its review), and the same outdated `no-empty-interface` disable comment in `store/spec/edge.spec.ts` (`store` module, already reviewed).

No test is added: the change is type-only, and lint (`--report-unused-disable-directives` clean, warning gone) is the check.

**Verification:** `yarn nx test schematics` passes (64 files, 513 tests, 0 type errors), `yarn nx lint schematics` has 0 errors and **15** warnings (down from 16, the one removed being this file's), `yarn nx build schematics` is clean.

### [`ngrx-push-migration/index.ts`](https://github.com/Terrence721/platform-main/blob/044dfb1e7be76f9df7a9c2fe965b4b4a292ba6e1/modules/schematics/src/ngrx-push-migration/index.ts)

**high · Correctness (generated code)** — Fixed via [issue #458](https://github.com/Terrence721/platform-main/issues/458)

`ng generate @ngrx/schematics:ngrx-push-migration` rewrites `| async` to `| ngrxPush` in component templates, and adds the module that provides `ngrxPush` to NgModules that import or export `CommonModule`/`BrowserModule`. It was reviewed by running the built schematic on an NgModule component, a standalone component and edge-case templates, and type-checking the result against the built `@ngrx/component` declarations.

**Real defect 1, fixed: it imported `PushModule`, which `@ngrx/component` no longer exports.** `PushModule` was deprecated in NgRx v16 in favour of the standalone `PushPipe` (the `component` module's own `16_0_0` migration moves apps off it), and it is not in `@ngrx/component`'s public API any more. But this schematic still added `import { PushModule } from '@ngrx/component'` and put it in `imports`/`exports`:

```
foo.module.ts(3,10): error TS2305: Module '"@ngrx/component"' has no exported member 'PushModule'.
```

So every NgModule it migrated stopped compiling. It now adds `PushPipe` (a standalone pipe may go in an NgModule's `imports` and `exports`), and it still skips a module that already has `PushPipe` or the old `PushModule`.

**Real defect 2, fixed: standalone components were broken.** In a standalone component (Angular's default) the template was rewritten to `ngrxPush`, but nothing added `PushPipe` to the component's own `imports` (probe: `imports: [AsyncPipe]` left as is), so Angular fails to compile the template (no pipe named `ngrxPush`). A new rule, `importPushPipeInStandaloneComponents`, adds `PushPipe` to the `imports` array and the import declaration of every standalone component whose template (inline or `templateUrl`) now uses `ngrxPush`. A component counts as standalone if it has an `imports` array (and not `standalone: false`) or `standalone: true`. That needs no Angular-version guess, because a standalone component cannot use `| async` without importing `AsyncPipe` or `CommonModule`. It is idempotent (a second run adds nothing), and an `imports` that is not an array literal (e.g. a shared constant) is left for the user.

**Real defect 3, fixed: the regex rewrote code that is not the `async` pipe.** `/\| {0,}async/g` had no word boundary and no guard against `||` (probe):

| Template                  | Before                                                        | After     |
| ------------------------- | ------------------------------------------------------------- | --------- |
| `{{ a \|\| asyncValue }}` | `{{ a \|\| ngrxPushValue }}` (a variable that does not exist) | unchanged |
| `{{ d \| asyncDate }}`    | `{{ d \| ngrxPushDate }}` (a different pipe)                  | unchanged |
| `{{ x$ \|async }}`        | `{{ x$ \|ngrxPush }}`                                         | same      |

It is now `/(?<!\|)\|\s*async\b/g`. That also accepts a line break between `|` and `async`, which templates allow and the old `{0,}` spaces-only pattern missed.

**Existing tests that locked in defect 1:** the four `importPushModule`/`exportPushModule` tests asserted `PushModule` as the expected output. `PushModule` no longer exists, so the expectation, not the behavior, was wrong. They now assert `PushPipe` (the `describe` names keep the exported function names).

**Observed, not changed:** a standalone component's `AsyncPipe` or `CommonModule` stays in `imports` after migration, which Angular's unused-standalone-import diagnostic can report as a warning. Removing it safely would mean checking that nothing else in the template uses it. `schema.ts` has the empty-interface lint pattern fixed in #456; that is the next row.

**Regression tests** (`index.spec.ts`, 5 new, 4 updated): against the unchanged build (a scratch git worktree built from `main`), 8 fail: the 4 updated NgModule tests (`PushModule` written), the regex test and 3 of the 4 standalone tests. `should not touch a component declared in an NgModule` passes on both sides.

**Verification:** `yarn nx test schematics` passes (64 files, 523 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (15 warnings, none in the changed files), `yarn nx build schematics` is clean; the migrated NgModule type-checks against the built `@ngrx/component` declarations (`TS2305` before).

### [`ngrx-push-migration/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/ngrx-push-migration/schema.ts)

**low · Lint** — Fixed via [issue #460](https://github.com/Terrence721/platform-main/issues/460)

The file was `// eslint-disable-next-line @typescript-eslint/no-empty-interface` followed by `export interface Schema {}`. That is the options type of `ng generate @ngrx/schematics:ngrx-push-migration`, whose `schema.json` defines no options.

**Real defect, fixed: one of the module's standing lint warnings.** As in #456: the comment suppressed the deprecated `no-empty-interface`, but its replacement `no-empty-object-type` (enabled as a warning) still reported the line (`An empty interface declaration allows any non-nullish value…`). The file is now `export type Schema = Record<string, never>;` with a doc comment, and the disable comment is gone. `nx lint schematics` warnings drop from 15 to 14.

**Sound, verified:** nothing imports `Schema` (the migration's `index.ts`, reviewed in #458, takes no options), and `schema.json` has `"properties": {}`, which the new type matches.

This was the last `no-empty-interface` disable comment in `modules/schematics`. The only other one in `modules/` is in `store/spec/edge.spec.ts` (recorded in #456).

No test is added: the change is type-only, and lint (`--report-unused-disable-directives` clean, warning gone) is the check.

**Verification:** `yarn nx test schematics` passes (64 files, 523 tests, 0 type errors), `yarn nx lint schematics` has 0 errors and **14** warnings (down from 15), `yarn nx build schematics` is clean.

### [`reducer/index.ts`](https://github.com/Terrence721/platform-main/blob/6293894e5c2b00c12933fedbebe7268baf7453f8/modules/schematics/src/reducer/index.ts)

**medium · Correctness (generated code)** — Fixed via [issue #462](https://github.com/Terrence721/platform-main/issues/462)

The reducer schematic (`ng generate @ngrx/schematics:reducer`) writes a reducer (and spec), and registers it in an NgModule and/or a reducers barrel. It was reviewed with its `schema.json` and templates by running the built schematic in NgModule and standalone apps, and type-checking what it generated (strict) against the built `@ngrx/store` declarations.

**Real defect 1, fixed: the default output did not compile.** The template imported `{ FooActions } from './foo.actions'` and `on` unconditionally, but only uses them with `--feature`, and the reducer schematic never creates the actions file:

```
default/foo.reducer.ts(2,28): error TS2307: Cannot find module './foo.actions' or its corresponding type declarations.
```

ESLint also flagged both imports as unused. Both are now inside the `feature` condition. The default reducer imports only `createReducer`, and all three variants (default, `--feature`, `--feature --api` with their actions) type-check. Two snapshots change: the non-feature default and grouped reducers lose those two imports.

**Real defect 2, fixed: with `--flat false --group`, both registrations imported a path that does not exist.** The template writes the reducer to `reducers/foo/foo.reducer.ts`, but `schematics-core`'s `addReducerImportToNgModule` and `addReducerToState` built the import path as `<name>/` then `reducers/`, which is the `entity` schematic's layout (#444), not this one's:

| Registration        | Before                                                          | After                          |
| ------------------- | --------------------------------------------------------------- | ------------------------------ |
| NgModule            | `'./foo/reducers/foo.reducer'` (does not exist; `TS2307`, #448) | `'./reducers/foo/foo.reducer'` |
| `reducers/index.ts` | `'../foo/reducers/foo.reducer'` (does not exist)                | `'./foo/foo.reducer'`          |

The other flat/group combinations were right. The fix spans two files:

- `schematics-core/utility/ngrx-utils.ts` (reviewed in #34): the path block, duplicated in both functions, becomes one `getReducerPath(options)` helper. It returns exactly the old path, so `entity` is unchanged, unless the caller passes `options.reducerPath`.
- `reducer/index.ts` computes `reducerPath` with the same `reducerFolder` function its template's `if-flat` uses (as `effect` did in #440), so the registration and the file cannot disagree again.

**Real defect 3, fixed: `ng generate reducer` failed in a standalone app** (Angular's default) with `Could not find an NgModule. Use the skip-import option…`. This is the #444 defect, with an option this schematic does not have. As in `entity`, a lookup without `--module` that finds no NgModule now skips registration (left to `provideState` in the app), while NgModule apps still auto-register and a missing explicit `--module` still fails. This also fixes `feature` in standalone apps, which #448 traced to this schematic.

**Schema, fixed:**

- `"required": []` → `["name"]` (carried over from #424); a missing name crashed with a raw `TypeError`. The reducer schematic has no nameless mode.
- `prefix` was used (`getPrefix`, the `feature` template's `on(FooActions.<prefix>Foos…)`) and declared in `schema.ts`, but not defined in `schema.json`, so the CLI would not accept `--prefix` (found in #430). It is now defined, with the same `"load"` default as `action` and `effect`.

**Observed, not changed:** the `State` interface and `initialState` are generated empty on purpose (scaffolding the user fills in), which lint reports as an empty interface. In `--api` mode the handlers' `action` parameter is unused.

**Regression tests** (`index.spec.ts`, 5 new): against the unchanged build (a scratch git worktree built from `main`, `CI=true`), 4 fail: the nested-and-grouped registrations, the standalone app, the unused imports and the missing name. The NgModule auto-registration test passes on both sides.

**Verification:** `yarn nx run-many -t build test lint --all` (all 13 modules, since `schematics-core` changed; `CI=true`, `--skip-nx-cache`) passes, 50/50 tasks; `yarn nx test schematics` passes (64 files, 533 tests, 0 type errors); `yarn nx lint schematics` has 0 errors (14 warnings, none in the changed files).

### [`reducer/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/reducer/schema.ts)

**low · Documentation** — Fixed via [issue #464](https://github.com/Terrence721/platform-main/issues/464)

The options type that `reducer/index.ts` reads, reviewed against `schema.json`.

**Sound, verified:** the interface declares exactly the 11 options `schema.json` defines, including `prefix`, which #462 added to `schema.json`. Only `name` is non-optional, which matches `"required": ["name"]` (also #462). No type changes.

**Doc comments, fixed** (checked against the behavior #462 settled):

| Option               | Was                                                                                                        | Now                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (`schema.ts`) | The name of the component.                                                                                 | The name of the reducer.                                                                                                                                         |
| `path`               | "The path to create the effect." (`schema.ts`), "…the component." (`schema.json`)                          | The path to create the reducer.                                                                                                                                  |
| `flat`               | Flag to indicate if a dir is created. (backwards)                                                          | When true (the default), creates the files in the path directly; when false, creates them in a folder named after the reducer.                                   |
| `module`             | "Allows specification of the declaring module." / "Specifies the declaring module."                        | The NgModule (path) to register the reducer in. Without it, the nearest NgModule is used, if the app has one.                                                    |
| `reducers`           | "Allows specification of the declaring reducers." / "Specifies the reducers file."                         | The reducers file (path) to add the reducer to.                                                                                                                  |
| `group`              | "Specifies if this is grouped within sub folders" (`schema.ts`)                                            | When true, creates the reducer within a `reducers` folder.                                                                                                       |
| `feature`            | "grouped within a feature" / "Flag to indicate if part of a feature schematic."                            | When true, the reducer handles the feature's actions (from the action schematic) and is exported through `createFeature`, as the feature schematic generates it. |
| `api`, `prefix`      | no mention that they only apply with `feature`; `schema.ts` called `prefix` "The prefix for the reducers." | Both now say "(with `feature`)": the template reads them only inside its `feature` block.                                                                        |

**Guard spec:** new `schema.spec.ts`, the same check as the other reviewed schematics (default `typescript` import, as decided in #452). It passes before and after here, since #462 already aligned `schema.json` with the type.

**Verification:** `yarn nx test schematics` passes (66 files, 537 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (14 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`selector/index.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/selector/index.ts)

**low · Correctness (generated output)** — Fixed via [issue #466](https://github.com/Terrence721/platform-main/issues/466)

The selector schematic (`ng generate @ngrx/schematics:selector`) writes a selectors file and a spec; with `--feature` they select the feature state of the reducer the `feature` schematic creates. It was reviewed with its `schema.json` and templates by running the built schematic and type-checking what it generated (strict, `isolatedModules`, which new Angular workspaces enable, and `noUnusedLocals`), together with the action and reducer in the `--feature` case.

**Real defect, fixed: without `--feature` the output was two unused imports and a test that did nothing.** Before (probe):

```ts
// foo.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';

// foo.selectors.spec.ts
describe('Foo Selectors', () => {
  it('should select the feature state', () => {
····
  });
});
```

Both imports were flagged by `no-unused-vars`. The spec's only test had an empty body (a whitespace-only line), so it passed without checking anything, under a name that claimed it did. Just removing the imports would have left an empty file, which `isolatedModules` rejects (TS1208), so what to generate was a design decision. **The repo owner chose a real feature selector:**

```ts
import { createFeatureSelector } from '@ngrx/store';

export const selectFooState = createFeatureSelector<unknown>('foo');
```

The key is `'foo'`, the same camel-cased name the reducer schematic uses for `fooFeatureKey`. The spec now calls `selectFooState({ foo: {} })` and asserts `{}`. `--feature` output is unchanged except that its unused `createSelector` import is dropped too. All variants (default; `--feature`; `--feature --flat false --group`) type-check under those settings, specs included.

**Real defect, fixed: a missing name wrote nameless files.** As in `effect` (#440), `parseName(options.path, options.name || '')` never failed, so a call without a name created `.selectors.ts` and `.selectors.spec.ts` (probe). `selector` has no mode that runs without a name, so `name` is now required in `schema.json` and the `|| ''` is gone.

**Sound, verified:** in `--feature` mode, `featurePath` resolves the reducer import correctly in every flat/group layout, including against the reducer's nested layout fixed in #462 (type-checked).

**Snapshots:** all 10 change. The five `createFeatureSelector, createSelector` imports lose `createSelector`, the three non-feature files get the selector and the real test, and the two feature specs gain a trailing comma.

**Regression tests** (`index.spec.ts`, 4 new): against the unchanged build (a scratch git worktree built from `main`, `CI=true`), all 4 fail: the default output, the default spec, `createSelector` with `--feature`, and the missing name.

**Verification:** `yarn nx test schematics` passes (66 files, 545 tests, 0 type errors; `CI=true`, so no snapshot was rewritten silently), `yarn nx lint schematics` has 0 errors (14 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`selector/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/selector/schema.ts)

**low · Correctness (CLI) + Documentation** — Fixed via [issue #470](https://github.com/Terrence721/platform-main/issues/470)

The options type that `selector/index.ts` reads, reviewed against `schema.json`.

**Real defect, fixed: a required option with no prompt.** #466 made `name` required, but `schema.json` gave it no `x-prompt`, so an interactive `ng generate @ngrx/schematics:selector` run without a name failed validation instead of asking for one. It now prompts ("What should be the name of the selector?"), as every other schematic here does. This is the same gap #436 fixed for `data`. The new `schema.spec.ts` has a third test, `should prompt for every option schema.json requires`, which fails against `main` (`expected [ 'name' ] to deeply equal []`) and passes with the fix.

**Sound, verified:** the interface declares exactly the 7 options `schema.json` defines, and only `name` is non-optional, which matches `"required": ["name"]`.

**Doc comments, fixed (in `schema.ts` and the `schema.json` descriptions `--help` shows):**

- `flat` was backwards, as in every schematic so far.
- `feature` said "grouped within a feature" / "Flag to indicate if part of a feature schematic." What it actually decides (#466) is what is selected: the state of the reducer the `feature` schematic creates, typed by its `State`. Without it, the feature state is typed `unknown`.
- `group`: "an 'selectors' folder" → "a 'selectors' folder" (and the same wording in `schema.json`).

**Guard spec:** new `schema.spec.ts`, the shared guard (names and required options match `schema.json`) plus the prompt test above.

**Verification:** `yarn nx test schematics` passes (68 files, 551 tests, 0 type errors, `CI=true`), `yarn nx lint schematics` has 0 errors (14 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`store/index.ts`](https://github.com/Terrence721/platform-main/blob/044dfb1e7be76f9df7a9c2fe965b4b4a292ba6e1/modules/schematics/src/store/index.ts)

**medium · Correctness** — Fixed via [issue #472](https://github.com/Terrence721/platform-main/issues/472)

The store schematic (`ng generate @ngrx/schematics:store`) writes a state file (`reducers/index.ts`) and registers it in an NgModule: `StoreModule.forRoot` (plus store devtools) with `--root`, `StoreModule.forFeature` otherwise. It was reviewed by running the built schematic in NgModule and standalone apps, and type-checking (strict, `isolatedModules`, `noUnusedLocals`) and linting what it generated.

**Real defect, fixed: `ng generate store` failed in a standalone app** (Angular's default) with `Could not find an NgModule. Use the skip-import option…`, for both a feature store and `--root`. `store` has no `skipImport` option either. This is the defect fixed for `entity` (#444) and `reducer` (#462), fixed the same way: a lookup without `--module` that finds no NgModule now skips registration (left to `provideStore`/`provideState` in the app), and the state file is still created. NgModule apps still auto-register, and an explicit `--module` that does not exist still fails.

**Generated code, fixed:** `reducers/index.ts` imported `ActionReducer`, `createFeatureSelector` and `createSelector` without using them (three `no-unused-vars` warnings in a default Angular lint setup), and had a stray blank line. It now imports only `ActionReducerMap` and `MetaReducer`. All variants (feature, `--root`, and the edited NgModules) type-check with `noUnusedLocals`.

**Tests that could not catch what they described, tightened:**

- `should pass if a root state name is not specified` wrapped an `async` function in `expect(...).not.toThrow()`. Calling it returns a promise and never throws synchronously, so the test passed even if the schematic rejected. It now awaits the run and asserts the state file exists.
- `should fail if a feature state name is not specified` and `should fail if specified module does not exist` accepted any error. They now assert the actual messages (`Please provide a name for the feature state`, `Specified module path …/app.moduleXXX.ts does not exist`).

**Checked, correct as is:**

- `name` stays optional: `--root` is designed to run without one, and `index.ts` already rejects a missing name otherwise with a clear message (the same design as `effect`, #440).
- The NgModule registrations for feature, `--root` and `--root --minimal` all type-check against the built `@ngrx/store` and `@ngrx/store-devtools` declarations.

**For `store/schema.ts` (next row):** `flat` has no effect in this schematic (the template path is `__statePath__/index.ts`; `--flat false` produces the same files, probed).

**Observed, not changed:** the generated `State` interface and `reducers` map are empty on purpose (scaffolding, as in `reducer`, #462). `metaReducers` is `isDevMode() ? [] : []`, a placeholder showing where dev-only meta-reducers go. **This is the third copy of `findModuleToRegisterIn`** (after `entity` and `reducer`); moving it into `schematics-core` is suggested as a separate cleanup.

**Snapshots:** the 10 `store` snapshots of the state file, and 1 `entity` snapshot (its plural test runs `store` first), change only by the trimmed import.

**Regression tests** (`index.spec.ts`, 3 new, 3 tightened): against the unchanged build (a scratch git worktree built from `main`, `CI=true`), the 3 new ones fail (both standalone cases and the unused imports). The 3 tightened ones pass on both sides, because that behavior was already right; they now actually check it.

**Verification:** `CI=true yarn nx test schematics` passes (68 files, 557 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (14 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`store/schema.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/store/schema.ts)

**low · Correctness (declared vs actual) + Documentation** — Fixed via [issue #476](https://github.com/Terrence721/platform-main/issues/476)

The options type that `store/index.ts` reads, reviewed against `schema.json`.

**Real defect, fixed: `name` was declared required, but it is optional by design.** `schema.ts` had `name: string`, while `schema.json` requires nothing. `--root` is meant to run without a name, and `index.ts` rejects a missing name otherwise with `Please provide a name for the feature state` (kept in #472). The guard spec failed on it (`expected [ 'name' ] to deeply equal []`). It is now `name?: string`, the same situation and fix as `effect` (#442). Two places in `index.ts` relied on `name` being a `string`, and both got type-only changes: `addImportToNgModule` reads it into a local `name` (always set by then, `''` only with `--root`), and `findModuleFromOptions` gets a copy with `name` defaulted. Behavior is unchanged; the existing tests, including the nameless `--root` one, pass.

**Options that do nothing, now documented as such:**

- `flat`: the template path is `__statePath__/index.ts`, so the state file always lands in the `statePath` folder. `--flat false` produced the same files (probe in #472).
- `skipTests`: the schematic creates no spec file at all (its only template is `index.ts`).

Removing them would be a breaking change to the CLI options, so they are kept and described accurately.

**Doc comments, fixed (in `schema.ts` and the `schema.json` descriptions `--help` shows):**

- `name` said "The name of the component." (`schema.ts`); it now says it is the feature state's name and is not needed with `--root`.
- `path` said "…the effect." / "…the component.": now the path to create the state folder in.
- `module` said "declaring module": now "the NgModule (path) to register the state in", with the nearest-NgModule fallback #472 settled.
- `statePath` had no description at all in `schema.json` (blank in `--help`): now "the folder, relative to the path, to create the state file (`index.ts`) in".
- `minimal` now says it applies with `--root` and skips the state file.
- `root` and `stateInterface` got full stops; stray blank lines between comments and members are removed.

**Guard spec:** new `schema.spec.ts`, the shared guard (option names and required options match `schema.json`). It failed against the unchanged file on `name`, so here it is a regression test, not only a drift guard.

**Verification:** `CI=true yarn nx test schematics` passes (70 files, 561 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (14 warnings, none in the changed files), `yarn nx build schematics` is clean.

### [`src/index.ts`](https://github.com/Terrence721/platform-main/blob/c10a528a951521dc75d1d4a208fc7e71f3b2ba53/modules/schematics/src/index.ts)

**low · Build / packaging** — Fixed via [issue #479](https://github.com/Terrence721/platform-main/issues/479); the `types` gap tracked in [#478](https://github.com/Terrence721/platform-main/issues/478)

`modules/schematics/src/index.ts` was **0 bytes**, and had been since the module was added. Nothing imports it, and the schematics are loaded through `collection.json` (23 entries), not through a barrel. **It cannot simply be deleted, though:** `schematics:build-package` uses `@nx/js:tsc`, whose `main` option is required, and `project.json` points it at this file. The executor writes the published `main` and `types` fields from it.

**Fixed: an unexplained empty entry point.** The file is now an explicit empty module (`export {};`), with a comment saying why it exists and that the package is used through `collection.json`.

**Found, tracked separately (#478): the published `types` field points at nothing.** `dist/modules/schematics/package.json` publishes `"main": "./src/index.js"` (exists) and `"types": "./src/index.d.ts"`, which does **not** exist, because the build has `declaration: false`. Turning `declaration` on in `tsconfig.build.json` was tried: it builds cleanly and emits `src/index.d.ts`. But it exposed a pre-existing build bug. `schematics:build-package` writes `schematics-core`'s compiled output into `schematics-core`'s **source** folder as well as into `dist/`. Isolated by running the steps one at a time: `schematics-core:build` alone left the folder clean, and `build-package` alone wrote the files. That is the long-unexplained source of the stray `.js` files there, which `.gitignore` hides. With declarations on it also writes 16 untracked `.d.ts` files, which it does not hide. So, as the repo owner chose, declarations stay off here, and #478 fixes the build first and then turns them on.

**New test:** `src/index.spec.ts` checks that the built package ships the file its `main` field names. A `types` case is to be added with #478. It checks only `dist` output, so it passes on both sides here: it pins the entry point, it does not prove a fix.

**This is the last file of the `schematics` module: 25/25.**

**Verification:** `CI=true yarn nx test schematics` passes (72 files, 563 tests, 0 type errors), `yarn nx lint schematics` has 0 errors (14 warnings), `yarn nx build schematics` is clean and leaves no file in `schematics-core`'s source folder with declarations off.

### [`actions/entity-action-factory.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/entity-action-factory.ts)

**low · Maintainability** — Fixed via [issue #481](https://github.com/Terrence721/platform-main/issues/481)

The factory every `@ngrx/data` action goes through: `create()` in its two forms (name, op, data, options; or a whole payload), `createFromAction()` and `formatActionType()`.

**Weak test, fixed.** `should throw if do not specify entityName` called `factory.create(null)`. `null` is not a string, so it is taken as the payload and `createCore` fails destructuring it (`TypeError: Cannot destructure property 'entityName' ... as it is null`, probe). A bare `.toThrow()` accepted that, so no test ever reached the `Missing entity name for new action` check. Both throw tests now assert the check's own message, through both forms of `create()`.

**Checked, not defects:**

- `createFromAction` copies the whole source payload, including the `error` and `skip` flags a reducer writes onto an action. Traced every caller (`entity-effects.ts`, `persistence-result-handler.service.ts`): the reducer sets `error` only when it threw, and then leaves the collection unchanged, so the cache reducer skipping the resulting ERROR action (`!payload.error`) loses nothing; nothing reads `skip` on a SUCCESS action.
- The payload form of `create()` uses the caller's object as `action.payload` without copying it, so reducer writes land on it. The only caller in the module (`entity-dispatcher-base.ts`) builds a new object per call.
- The name form spreads `options` first, so `entityName`, `entityOp` and `data` always win over it.

**Verification:** the spec passes (12 tests); the new assertions fail by construction without the checks (`create('', op)` would return an action).

### [`actions/entity-action-guard.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/entity-action-guard.ts)

**low · Maintainability / Reliability** — Fixed via [issue #483](https://github.com/Terrence721/platform-main/issues/483)

`EntityActionGuard` checks an action's payload shape (an entity, entities, a key, keys, an update, updates, and the two update-response forms) and throws when it is wrong. It is public API; the dispatcher throws its errors straight into app code (optimistic `add`/`update`), and the collection reducer catches them otherwise, so the message is the diagnostic. All three findings were probed against the unchanged source.

**Fixed:**

1. **`mustBeKeys` garbled its message.** It put the entity name into the message although `throwError` already adds it: `Hero EntityAction guard for "[Hero] op": payload Hero ', item 2, is not a valid entity key (id)` (the name twice and a stray quote). It now reads `..., item 2, is not a valid entity key (id)`, like its siblings.
2. **`mustBeKey` gave no context.** It was the only method throwing `new Error(...)` directly (`should be a single entity key`, `is not a valid key (id)`), with no entity name or action type. It now goes through `throwError` like the other seven.
3. **Malformed input crashed before the guard's own check.** A `null` item in `mustBeEntities`, a `null` item in `mustBeUpdates`/`mustBeUpdateResponses`, and an update without `changes` in all four update guards failed inside `selectId` with a raw `TypeError` (`Cannot read properties of undefined (reading 'id')`, `Cannot destructure property 'id' of 'item' as it is null`). A private `keyOf()` now reads a key only when there is an entity to read it from, so these get the guard's message.

**Checked, not defects:** the update guards require the key in both `update.id` and `update.changes`, which matches the module's design (every internal `Update` comes from `toUpdate`, which uses the whole entity as `changes`); an `id` that differs from `changes.id` is accepted on purpose, since `@ngrx/entity` supports changing a key that way.

**Tests:** a new `error messages` block asserts the full messages for all of the above. The existing tests matched fragments of each message, which is how #1 passed them.

**Verification:** the guard spec passes (36 tests), eslint is clean on both files, and `tsc` on the `data` spec config reports nothing in these files (its only errors are 2 in `spec/effects/marbles.ts`, unchanged here).

### [`actions/entity-action-operators.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/entity-action-operators.ts)

**medium · Correctness** — Fixed via [issue #485](https://github.com/Terrence721/platform-main/issues/485)

The two RxJS filters apps use on the actions stream: `ofEntityOp(...)` and `ofEntityType(...)`, each taking the allowed values as rest arguments or as one array, and meaning "any" with no arguments.

**Real bug, fixed: `ofEntityType(undefined)` selected exactly the wrong actions.** The first overload declares the list optional (`allowedEntityNames?: string[]`), so `ofEntityType(theChosen)` type-checks when `theChosen` is `undefined`. `flattenArgs([undefined])` returns `[undefined]`, which took the single-name branch and compared `undefined === action.payload.entityName`. Probe on the unchanged source, with a payload-less action, a string-payload action, an object payload without `entityName` and a real Hero EntityAction: `ofEntityType(undefined)` kept the two non-entity actions with a payload and dropped the Hero action; `ofEntityType()` kept only the Hero action. Missing entries are now dropped after flattening, so `undefined` means any entity type, like no arguments. `ofEntityOp` has the same code and gets the same fix: its overloads do not accept `undefined`, but a JavaScript caller or a cast can pass it.

**Coverage gap, closed:** `ofEntityOp`'s single-op branch had no test; the tests passed two ops or none. Also fixed a typo in the `ofEntityType` doc example ("ayn").

**Checked, not defects:** payload-less and string-payload actions are rejected by every branch; `ofEntityOp([])` and `ofEntityOp(...[])` mean any op, consistent with no arguments; matching is case-sensitive by design (already tested).

**Verification:** the operators spec passes (13 tests, 3 new; both `undefined` tests fail against the old code, per the probe), eslint is clean, no type errors.

### [`actions/entity-action.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/entity-action.ts)

**low · Maintainability** — Fixed via [issue #487](https://github.com/Terrence721/platform-main/issues/487)

Types only: `EntityAction`, `EntityActionOptions` and `EntityActionPayload`, checked against their consumers rather than in isolation.

**Doc gap, fixed:** `mergeStrategy` was the only option without a doc comment, so editors showed nothing for it. It now says what it controls and that its default depends on the operation, which matches `entity-change-tracker-base.ts` (query results default to `PreserveChanges`, save results to `OverwriteChanges`).

**Checked, not defects:**

- `error` and `skip` are deliberately not `readonly`, unlike every other option: the reducer writes them and `entity-effects.ts` reads them (traced in #481).
- `error` is typed `Error`, while the reducer stores whatever was thrown (`catch (error: any)`): its one reader, `handleError`, wraps anything that is not a `DataServiceError`, so a non-`Error` is still handled.
- `httpOptions`' `HttpParams` and `HttpHeaders` are plain serializable data (Angular's non-serializable `encoder` is left out on purpose), in line with actions having to be serializable.

**Verification:** eslint and prettier are clean; `tsc` on the `data` spec config reports nothing new (only the 2 existing errors in `spec/effects/marbles.ts`). A types-only file, so no spec of its own.

### [`actions/entity-cache-action.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/entity-cache-action.ts)

**medium · Correctness** — Fixed via [issue #489](https://github.com/Terrence721/platform-main/issues/489)

The actions for the entity cache as a whole: `ClearCollections`, `LoadCollections`, `MergeQuerySet`, `SetEntityCache`, and the `SaveEntities` family (save, cancel, canceled, error, success).

**Real bug, fixed: `SaveEntities` and `SaveEntitiesSuccess` wrote the tag onto the caller's `ChangeSet`.** Both constructors did `changeSet.tag = changeSet.tag || options.tag`, and `EntityCacheDispatcher.saveEntities` passes the app's own `ChangeSet` through uncopied, always with a tag (default `'Save Entities'`). Probe on the unchanged source:

- saving a `ChangeSet` with tag `A` left `tag: 'A'` on the app's object, so **saving the same `ChangeSet` again with tag `B` still produced tag `A`** (a retry, for example), and the `ChangeSet` sent to the server carried the stale tag;
- a frozen `ChangeSet` threw `TypeError: Cannot add property tag, object is not extensible`. NgRx's runtime checks skip `@ngrx…` actions, so dispatching does not freeze it; a `ChangeSet` kept in store state (frozen by `strictStateImmutability`) or frozen by the app does reach this;
- the constructors guarded `if (changeSet)` and then read `changeSet.tag` unguarded, so a missing `ChangeSet` threw a `TypeError` anyway.

The payload's `ChangeSet` now gets the tag on a copy (only when it differs), and the caller's object is never written. Nothing else in the module reads `changeSet.tag`.

**Smaller fixes:** `SaveEntitiesError` now declares `implements Action` like every other action class; `LoadCollections`' doc comment named a `querySet` parameter that is called `collections` and had its sentences out of order; an unused `ChangeSetOperation` import (the file's only lint warning; the name is re-exported by its own `export … from`) is removed.

**Checked, not defects:** `MergeQuerySet` defaults `mergeStrategy` only for `null`, leaving `undefined` in the payload, but the change tracker's default parameter turns `undefined` into `PreserveChanges`, so the documented default holds end to end; the `null` check covers exactly the case a default parameter does not.

**Tests:** new `entity-cache-action.spec.ts`, 6 cases run for both classes (tag from options, the change set's own tag wins, caller's change set untouched, a second save uses its new tag, a frozen change set, no change set). Four of them fail on the old code per the probe; the other two pin behaviour kept as is.

**Verification:** the new spec and the specs of every consumer (reducer, effects, entity services, dispatchers) pass, 10 files, 184 results, no type errors; eslint clean.

### [`actions/entity-cache-change-set.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/entity-cache-change-set.ts)

**medium · Correctness** — Fixed via [issue #491](https://github.com/Terrence721/platform-main/issues/491)

The `ChangeSet` model for multi-entity saves (`ChangeSetOperation`, the four item types, `ChangeSet`), the `changeSetItemFactory` that builds items, and `excludeEmptyChangeSetItems`, which the save effect runs before calling the server.

**Real bug, fixed: `changeSetItemFactory.delete('Hero', 0)` dropped the key.** A single key was wrapped with `keys ? [keys] : []`, so the valid key `0` gave an item with no entities (probe: `{"op":"Delete","entities":[]}`). `excludeEmptyChangeSetItems` then removes that empty item before the save, so **the delete never reached the server, and the save still reported success**. `0` is a key everywhere else in the module (`EntityActionGuard.mustBeKey` has a test for it). Only `null`/`undefined` now mean no key.

**Type defect, fixed: `update()` only accepted entity types with an `id` property.** Its signature was `update<T extends { id: string | number }>`, so an app whose entities use another key (`heroId`, with a custom `selectId`) could not call it: `TS2344: Type 'Hero' does not satisfy the constraint '{ id: string | number; }'` (checked with `tsc`). `Update<T>` itself has no such requirement, and nothing in the repo relied on it; the constraint is removed. Also fixed the `ChangeSetItem` doc comment ("A entities").

**Coverage gaps, closed:** `excludeEmptyChangeSetItems` had no test anywhere; `update()` and `upsert()` had none either. New tests cover a single key including `0`, a single update, an update for an entity keyed on something other than `id`, a single upsert, and `excludeEmptyChangeSetItems` (drops null and empty items in order, keeps `tag` and `extras`, handles a missing change set).

**Checked, not defects:** `add`/`upsert` wrapping with a truthiness check is fine, since entities are objects; `excludeEmptyChangeSetItems` returns a new object and does not modify its argument.

**Verification:** all `actions` specs plus the cache reducer and effects specs pass (14 files, 230 results, no type errors); eslint clean.

### [`actions/entity-op.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/data/src/actions/entity-op.ts)

**low · Maintainability** — Fixed via [issue #493](https://github.com/Terrence721/platform-main/issues/493)

`EntityOp` (59 ops), the `OP_SUCCESS`/`OP_ERROR` suffixes, and `makeSuccessOp`/`makeErrorOp`, which the effects and the persistence result handler use to build the result action of a persistence op.

**Unchecked invariant, now guarded.** The file's header said the suffixes and the enum's `/success` and `/error` members must match, and that this "cannot be done programmatically". It can. An op added without its pair would make `makeSuccessOp`/`makeErrorOp` return a string that is not an `EntityOp`, and no reducer method would handle the result action. A probe of the current enum found all 12 persistence ops with both results, no result op without its base op, and no duplicate values, so nothing is broken today. The new `entity-op.spec.ts` checks those properties (the ops in `persistOps` included), and the header now points at it. It passes on both sides, as a guard against future drift.

**Noted for `effects/entity-effects.ts`'s review, not changed here:** `persistOps` lists the four query ops and the four `SAVE_*_ONE` ops, but none of the `SAVE_*_MANY` ops, although those have result ops. Whether anything dispatches them belongs to that file.

**Verification:** the new spec passes (4 tests, no type errors); eslint clean.

### [`actions/merge-strategy.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/merge-strategy.ts)

**No findings** — reviewed in [issue #495](https://github.com/Terrence721/platform-main/issues/495)

`MergeStrategy` (`IgnoreChanges`, `PreserveChanges`, `OverwriteChanges`): how a query or save result is merged into entities that have unsaved changes.

It is a numeric enum, so `IgnoreChanges` is `0`, which JavaScript treats as false. The risk is any consumer writing `mergeStrategy || default` or `if (mergeStrategy)`, which would silently replace `IgnoreChanges` with the default. A search of all of `modules/data/src` found no truthiness test on a merge strategy: every default goes through `== null`, `=== null` or a default parameter, all of which keep `0`. `IgnoreChanges` is exercised 38 times across the dispatcher, cache reducer and change tracker specs. The doc comments match the code (query results default to `PreserveChanges`, save results to `OverwriteChanges`, confirmed in `entity-change-tracker-base.ts` during #487).

### [`actions/update-response-data.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/actions/update-response-data.ts)

**No defects** — reviewed in [issue #497](https://github.com/Terrence721/platform-main/issues/497); one doc typo fixed

`UpdateResponseData<T>`, the `SAVE_UPDATE_ONE_SUCCESS` payload: an `Update<T>` plus a `changed` flag. Types only, so it was checked against its producer and consumers.

The producer (`entity-effects.ts`, the `SAVE_UPDATE_ONE` case) sets `changed: true` only when the server returns entity data, merged over the `changes` that were sent, and `changed: false` otherwise, as the doc comment says. The one consumer of the flag (`mergeSaveUpdates` in `entity-change-tracker-base.ts`, through `filterChanged`) keeps only `r.changed === true` when it skips unchanged updates on an optimistic save, so a missing flag behaves as the documented default, `false`. `id` is the original key and `changes` may carry a changed key, matching the field comments. The only change is a typo in the interface's doc comment ("The is true if…").

### [`dataservices/data-service-error.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dataservices/data-service-error.ts)

**medium · Reliability** — Fixed via [issue #499](https://github.com/Terrence721/platform-main/issues/499)

`DataServiceError` wraps whatever a data service failed with, and `extractMessage` works out its `message` from the many shapes an error can take. Probed with real `HttpErrorResponse` objects against the unchanged source.

**Real bug, fixed: a missing error crashed the constructor.** `extractMessage` destructured its argument without checking it, so `new DataServiceError(null, …)` or `(undefined, …)` threw `TypeError: Cannot destructure property 'error' of 'sourceError'`. `DefaultPersistenceResultHandler.handleError` wraps every error that is not already a `DataServiceError` this way, so a custom data service that errors with `undefined` made the error handler itself throw instead of producing the ERROR action.

**Real bug, fixed: HTTP errors with an object body lost their message.** The function stopped at the first source that was _present_ instead of the first that held a message. An `HttpErrorResponse` whose `error` is an object without a `message` therefore got `""`, although the response's own `message` was right there. Probe: a 400 with a problem-details body (`{ title, detail }`) and a network failure (status 0, where `error` is a `ProgressEvent`) both gave `""`; they now give `Http failure response for /api/heroes: 400 Bad Request` and `…: 0 Unknown Error`. The sources and their order are unchanged (the `error` body, then `message`, then a `body` property); an empty one now falls through to the next.

**Tests:** 4 new cases (an object body with a message, one without, a network failure, a missing error). The last three fail on the old code, per the probe.

**Verification:** the `dataservices` and `effects` specs pass (12 files, 194 results, no type errors); eslint clean.

### [`dataservices/default-data-service-config.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dataservices/default-data-service-config.ts)

**No defects** — reviewed in [issue #501](https://github.com/Terrence721/platform-main/issues/501); two doc comments fixed

`DefaultDataServiceConfig`, the optional settings (and DI token) read by `DefaultDataService` and `EntityCacheDataService`. Types only, so it was checked against both readers.

Every documented default matches what the services apply (`root` `'api'`, `delete404OK` `true`, the delays and `timeout` `0`, `trailingSlashEndpoints` `false`), and the `@Optional()` config is defaulted to `{}` before `DefaultDataServiceFactory` reads `entityHttpResourceUrls`.

**Doc comments fixed:** `timeout` did not say what its default `0` means; both services apply a timeout only when it is non-zero, so `0` is no timeout (a stray `//` after it is also removed). `trailingSlashEndpoints` ("to keep leading & trailing slashes or not") now says what it does: keep the leading and trailing slashes of `root` as given instead of trimming them (`normalizeRoot`); the generated URLs end in `/` either way.

**Noted for `dataservices/default-data.service.ts`'s review, not changed here:** it times every request out at `timeout + saveDelay`, GETs included, and never adds `getDelay`, so a GET with `getDelay` at or above `timeout` would time out.

### [`dataservices/default-data.service.ts`](https://github.com/Terrence721/platform-main/blob/313a244b90575977f00d681ae0a0d8f81d09393b/modules/data/src/dataservices/default-data.service.ts)

**medium · Correctness** — Fixed via [issue #503](https://github.com/Terrence721/platform-main/issues/503)

`DefaultDataService`, the REST data service for one entity type, and `DefaultDataServiceFactory`. Both findings were shown by new tests failing against the unchanged source.

**Real bug, fixed: `getWithQuery` dropped its queryParams whenever `httpOptions.httpParams` was given.** `execute` took `httpParams` _instead of_ the params built from queryParams (`entityActionHttpClientOptions?.params ?? options?.params`), although `getWithQuery`'s own dev-mode warning says `httpParams` "will be merged with queryParams" and wins only "in the event of a conflict". `getWithQuery('name=A', { httpParams: { fromString: 'page=2' } })` sent only `?page=2`, so the filter was silently lost. The params are now merged, with `httpParams` replacing only the keys it has; the existing conflict test (`name=A` against `name=B` gives `B`) still passes.

**Real bug, fixed: GETs timed out at `timeout + saveDelay`, ignoring `getDelay`** (carried over from #501). With `{ timeout: 30, getDelay: 50 }` every GET timed out although the response arrived within the simulated latency. The timeout now allows for the delay the request was given: `getDelay` for a GET, `saveDelay` otherwise. A second new test pins that a GET slower than both still times out.

**Also:** the file's and its spec's pre-existing lint warnings are cleared (an unused `map` argument in `delete`; an unused import, an unused disable directive and six unused callback parameters in the spec).

**Checked, not defects:** the `key == null` guards keep a key of `0`; `delete` maps the result to the key, including on the DELETE-404-is-OK path; `handleDelete404` only ever sees an `HttpErrorResponse` or a `TimeoutError`, never `null`; the method switch's `default:` branch is unreachable by type.

**Follow-up, fixed via [issue #505](https://github.com/Terrence721/platform-main/issues/505) (the repo owner's decision):** keys were concatenated into the URL unencoded (`entityUrl + key`), so a string key containing `/`, `?`, `#` or a space changed the request's path or query (`getById('a/b ?#c')` requested `api/hero/a/b ?#c`). `getById`, `delete` and `update` now pass the key through `encodeURIComponent`, so it stays in its own path segment (`api/hero/a%2Fb%20%3F%23c`); numeric keys (including `0`) and plain string keys are unchanged. This is a behaviour change: an app that already encoded its keys should stop, or they will be encoded twice. The class doc comment says keys are encoded. 4 new tests; the whole `data` suite passes (60 files, 1,240 results, no type errors).

**Verification:** the `dataservices`, `effects` and `entity-services` specs pass (16 files, 332 results, no type errors); eslint clean on both files.

### [`dataservices/entity-cache-data.service.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dataservices/entity-cache-data.service.ts)

**low · Reliability** — Fixed via [issue #507](https://github.com/Terrence721/platform-main/issues/507)

`EntityCacheDataService.saveEntities` POSTs a `ChangeSet`, with each update flattened to its `changes`, and restores the updates in the response using each entity type's id selector.

**Bug, fixed: a timeout escaped the error handler.** `timeout()` was applied after `catchError`, so a timed-out save errored with a raw `TimeoutError` instead of a `DataServiceError` carrying the request data, unlike every other failure in this service and unlike `DefaultDataService`. `EntityCacheEffects` rewraps it as `new DataServiceError(err, null)`, which loses the method and URL; a direct caller of the service (it is public API) got the raw error. `timeout` now runs before `map` and `catchError`.

**Coverage gap, closed: the real service had no test.** The only spec that used it (`entity-cache-effects.spec.ts`) replaces it with a test double, so the HTTP call, `flattenUpdates`/`restoreUpdates`, error wrapping and the timeout were never exercised. The new `entity-cache-data.service.spec.ts` covers flattening and restoring (with a custom key), the empty-item filter, a 204 response, an HTTP failure and a timeout; the timeout test fails on the old code by construction.

**Doc gap, fixed:** only each update's `changes` is sent, not its `id`, so `changes` must include the entity's key; an update built as `{ id, changes: { name } }` reaches the server with no key. This is the service's protocol (it assumes the server does not understand `Update<T>`), so it is documented on `saveEntities` rather than changed.

**Verification:** the new spec and `entity-cache-effects.spec.ts` pass (18 results, no type errors); eslint clean.

**Follow-up, fixed via [issue #511](https://github.com/Terrence721/platform-main/issues/511) (the lookup pattern found in #509):** `getIdSelector` read the plain-object `idSelectors` cache without an own-property check, so for an entity named `toString` the cached "selector" was `Object.prototype.toString`, and `restoreUpdates` silently rebuilt every returned update with id `"[object Undefined]"` instead of the entity's key (checked); for `constructor` it was `Object`, which returns the entity itself. The lookup now uses `Object.hasOwn`, with a test for an entity named `toString`.

### [`dataservices/entity-data.service.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dataservices/entity-data.service.ts)

**low · Correctness** — Fixed via [issue #509](https://github.com/Terrence721/platform-main/issues/509)

`EntityDataService`, the registry of per-entity data services (`getService`, `registerService`, `registerServices`). Both findings were probed on the unchanged source.

**Bug, fixed: entity names that `Object.prototype` also has returned built-in functions.** The registry is a plain `{}`, and `getService` read `this.services[entityName]` without an own-property check. `getService('constructor')` therefore returned `Object` itself, and `toString` and `hasOwnProperty` returned those functions, instead of creating a data service; the caller then used a function as its data service. The lookup now uses `Object.hasOwn`.

**Bug, fixed: `registerServices` did not trim names.** `getService` and `registerService` trim the entity name; `registerServices({ ' Villain ': service })` stored the untrimmed key, so `getService('Villain')` never found it and created a default service instead. Its keys are now trimmed too.

**Also:** the pre-existing lint warnings in the spec's stub classes (unused parameters, an empty method) are cleared.

**Same lookup pattern elsewhere, for those files' reviews:** `http-url-generator.ts`, `entity-definition.service.ts`, `entity-services-base.ts`, `entity-collection-reducer-registry.ts`, `default-pluralizer.ts`, and the already-merged `entity-cache-data.service.ts` (`idSelectors`, #507), which needs a small follow-up.

**Verification:** the whole `data` suite passes (62 files, 1,252 results, no type errors); eslint clean on both files.

### [`dataservices/http-url-generator.ts`](https://github.com/Terrence721/platform-main/blob/b932b79fb8d94f0c160e10df9157f35b4f31f859/modules/data/src/dataservices/http-url-generator.ts)

**medium · Correctness** — Fixed via [issue #513](https://github.com/Terrence721/platform-main/issues/513)

`DefaultHttpUrlGenerator` builds, and caches, each entity type's single-entity and collection URLs from the configured `root`; `normalizeRoot` trims it. Both findings were probed on the unchanged source.

**Real bug, fixed: the configured root was lowercased along with the entity name.** Both URLs were built as `` `${root}/${name}/`.toLowerCase() ``, so root `api/V2` gave `api/v2/hero/`, and `https://Api.example.com/Tenant` gave `https://api.example.com/tenant/hero/`. URL paths are case-sensitive on most servers, so a mixed-case root pointed at a different, usually missing, path. Only the entity and collection segments are lowercased now; the root is used exactly as configured. This is a behaviour change for an app that relied on its root being lowercased.

**Bug, fixed: entity names that `Object.prototype` also has got `undefined` URLs.** It is the same plain-object lookup as #509: `knownHttpResourceUrls['constructor']` found `Object`, whose `entityResourceUrl` is `undefined`, so a data service for such an entity requested `undefined1`. The lookup now uses `Object.hasOwn`.

**Coverage gap, closed:** the file had no spec of its own. The new `http-url-generator.spec.ts` covers lowercase entity segments, the root's case being kept, root trimming and `trailingSlashEndpoints`, registered URLs returned as given, prototype-named entities, registering nothing, and `normalizeRoot`. Doc-comment typos are also fixed.

**Noted, not changed:** the cache is keyed by entity name only, so a later call with a different `root` or `trailingSlashEndpoints` gets the first call's URLs. `DefaultDataServiceFactory` always passes the one configured root, so this does not arise in the module's own use.

**Verification:** the whole `data` suite passes (64 files, 1,268 results, no type errors); eslint clean.

### [`dataservices/interfaces.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dataservices/interfaces.ts)

**No defects** — reviewed in [issue #515](https://github.com/Terrence721/platform-main/issues/515); stale doc comments fixed

Types only: `EntityCollectionDataService<T>`, `HttpMethods`, `RequestData`, `QueryParams`, `HttpOptions`, and the serializable `HttpHeaders`/`HttpParams` shapes, checked against their implementers and callers.

**Doc comments fixed:** `QueryParams` said Angular's `HttpParamsOptions` "at the time of writing was NOT exported at package level"; it is exported from `@angular/common/http` now, so the comment instead says what the type is (the shape of `HttpParamsOptions.fromObject`, kept as its own serializable type). `HttpParams`' comment had a grammar slip, and its redundant `declare` is removed.

**Checked, not defects:** `getWithQuery` takes `QueryParams | string` while `DefaultDataService` also accepts `undefined` (the call with only `httpOptions`), but every public caller (`EntityCommands`, the dispatcher, `EntityCollectionServiceBase`) declares the same narrower type, a wider implementation parameter is valid, and the deprecation warning says `queryParams` is going away. The local `HttpHeaders`/`HttpParams` share names with Angular's classes, but `default-data.service.ts` imports Angular's and only the local `HttpOptions`. `getById(id: any)` is looser than `delete(id: number | string)`, which is harmless now that keys are URL-encoded (#505).

### [`dataservices/persistence-result-handler.service.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dataservices/persistence-result-handler.service.ts)

**No defects** — reviewed in [issue #517](https://github.com/Terrence721/platform-main/issues/517); one coverage gap closed

`DefaultPersistenceResultHandler` turns a persistence result into the SUCCESS or ERROR `EntityAction` (through `createFromAction`), wrapping any error that is not a `DataServiceError` and logging failures.

Its parts were traced in earlier files: copying the original action's `error`/`skip` flags into the result action is harmless (#481); `new DataServiceError(err, null)` no longer crashes on a missing error (#499); `makeSuccessOp`/`makeErrorOp` always yield real ops, now guarded by a spec (#493).

**Coverage gap, closed:** both effects specs use the real handler, but every one of their tests fails with a `DataServiceError`, so the branch that wraps any other error, and the `logger.error` call, were never exercised. The new `persistence-result-handler.service.spec.ts` covers the success action (op, data and options carried over), a `DataServiceError` passed through and logged, and a plain `Error` wrapped (message kept, `requestData` null, original action attached).

**This completes `dataservices/` (8 files).**

### [`dispatchers/entity-cache-dispatcher.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/data/src/dispatchers/entity-cache-dispatcher.ts)

**low · Correctness** — Fixed via [issue #519](https://github.com/Terrence721/platform-main/issues/519)

`EntityCacheDispatcher` dispatches the cache-wide actions and turns `saveEntities` into an Observable of the server's response, matched by correlation id on the store's scanned actions.

**Bug, fixed: `cancelSaveEntities` rejected a correlation id of `0`.** It threw `Missing correlationId` for any falsy id (`!correlationId`), while `saveEntities` treats only `null`/`undefined` as missing and `EntityCacheEffects.saveEntitiesCancel$` accepts any id that is not `null`/`undefined`. A save started with `correlationId: 0` therefore could not be canceled. The check is now `== null`.

**Also fixed:** both error paths of the response Observable used the `throwError(value)` form that RxJS 7 deprecates, now `throwError(() => …)`; `loadCollections`' doc comment had its sentences out of order (the same text as `LoadCollections`, fixed in #489).

**Coverage gap, closed:** the class had no spec anywhere. The new `entity-cache-dispatcher.spec.ts` covers the defaulted options on the dispatched `SaveEntities`, the response for the matching correlation id only, the error payload, `PersistenceCanceled` on a cancel, and `cancelSaveEntities` with `0` and with no id.

**Noted, not changed:** the response Observable is cold and `reducedActions$` replays only the latest action, so a caller that subscribes after both the response and a later action have been reduced never gets the response. Subscribing at the call, as every in-repo caller does, is fine.

**Follow-up, fixed via [issue #529](https://github.com/Terrence721/platform-main/issues/529) (found in #527):** the class kept a `shareReplay(1)` subscription to the scanned actions alive with no `ngOnDestroy` at all, and `shareReplay(1)` never releases its source anyway, so the subscription outlived the service (for example across TestBed resets). It now implements `OnDestroy`, uses `shareReplay({ bufferSize: 1, refCount: true })`, and unsubscribes its keep-alive subscriber in `ngOnDestroy`, the same fix as `EntityDispatcherFactory`; a new test covers the replay and the release.

**Verification:** the whole `data` suite passes (68 files, 1,286 results, no type errors); eslint clean.

### [`dispatchers/entity-commands.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dispatchers/entity-commands.ts)

**No defects** — reviewed in [issue #521](https://github.com/Terrence721/platform-main/issues/521); doc comments that contradicted the implementation fixed

Interfaces only: `EntityServerCommands<T>` (commands that call the server), `EntityCacheCommands<T>` (cache-only commands) and `EntityCommands<T>` (both), checked against their implementation in `EntityDispatcherBase`.

**Doc comments fixed:** `upsertOneInCache` and `upsertManyInCache` said "Pass the Update<T> structure as the payload", but `EntityDispatcherBase` dispatches the entities themselves, so the line is removed. `getByKey` said it returns "the queried entities that are in the collection"; it returns one entity, looked up in the collection by the key of the server's result. `delete(entity)` and `removeManyFromCache(entities)` documented their parameters under the wrong names, and a sentence in `updateManyInCache` ran into the next.

**Checked, not defects:** the `add` overloads (a partial entity when pessimistic, a full entity when optimistic) match `add`'s guard, which checks the entity only for an optimistic save; the cache commands' "ignored if already in cache" and "ignored if not in cache" match the entity adapter's behaviour.

### [`dispatchers/entity-dispatcher-base.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/data/src/dispatchers/entity-dispatcher-base.ts)

**medium · Correctness** — Fixed via [issue #523](https://github.com/Terrence721/platform-main/issues/523)

`EntityDispatcherBase<T>`, the default `EntityDispatcher`: it builds and dispatches every collection action, and turns query and save actions into Observables of the server's response.

**Real bug, fixed (the repo owner chose "replace"): `loadWithQuery` merged instead of replacing.** Its doc comment, and `EntityCommands`', says it "completely replace[s] the cached collection", like `load`, but it dispatched `QUERY_MANY`, whose success reducer merges the results (`mergeQueryResults`) exactly like `getWithQuery`; only `QUERY_LOAD_SUCCESS` replaces the collection (`setAll`, with `changeState` cleared). An existing test pinned the old op, with a `//?` next to its merge-strategy check. `loadWithQuery` now dispatches `QUERY_LOAD` with the query as its data, and `EntityEffects.callDataService` calls `getWithQuery(data)` for `QUERY_LOAD` when a query is present, and `getAll()` otherwise, which is what `load()` still gets. **This is a behaviour change:** after `loadWithQuery`, entities the query did not return are gone from the cache, and `changeState` is cleared. The pinning test is rewritten, two new effects tests cover `QUERY_LOAD` with and without a query, and the reducer tests already pin that `QUERY_LOAD_SUCCESS` replaces.

**Bugs, fixed: options silently dropped, and a correlation id of `0` rejected.** `cancel` threw for any falsy correlation id, while the query and save methods treat only `null`/`undefined` as missing (the same fix as #519), and it dispatched only `{ correlationId }`, losing a tag passed in `options`. `setFilter`, `setLoaded` and `setLoading` had no `options` parameter at all, although `EntityCommands` declares one for each, so their options were dropped too.

**Also:** `throwError(value)` (deprecated in RxJS 7) is now `throwError(() => …)`; the two `delete` overloads had their doc comments swapped, `getByKey` claimed to return "the collection", `upsertOneInCache` still said "Pass the Update<T>", and a comment in `removeManyFromCache` sat on the wrong branch; two unused imports are removed. In the spec, two tests built the expected `Update` payload without ever asserting it, and now do; with that, both files are lint-clean.

**Noted, not changed:** as in `EntityCacheDispatcher` (#519), the response Observables are cold and `reducedActions$` replays only the latest action, so a caller that subscribes after the response and a later action have both been reduced never gets the response; subscribing at the call is fine.

**Verification:** the whole `data` suite passes (68 files, 1,310 results, no type errors); eslint clean on the file and its spec.

### [`dispatchers/entity-dispatcher-default-options.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dispatchers/entity-dispatcher-default-options.ts)

**No defects** — reviewed in [issue #525](https://github.com/Terrence721/platform-main/issues/525); a misleading doc comment fixed

`EntityDispatcherDefaultOptions`: whether each kind of save is optimistic by default.

The class comment said it "initializes the defaults to the safest values", but `optimisticDelete` is `true`, and optimistic is the less safe choice. That default is deliberate, pinned by the dispatcher spec ("By default add and update are pessimistic and delete is optimistic"), so the comment now states it, and also names the per-entity override (`entityDispatcherOptions` in the entity's metadata, merged in by `EntityDispatcherFactory`).

**Checked:** all five options are read (`optimisticAdd`, `optimisticDelete`, `optimisticUpdate` and `optimisticUpsert` by `EntityDispatcherBase`, `optimisticSaveEntities` by `EntityCacheDispatcher`), and the class is provided in `provide-entity-data.ts`'s shared providers, so injecting it works although it has no `providedIn`.

### [`dispatchers/entity-dispatcher-factory.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/dispatchers/entity-dispatcher-factory.ts)

**low · Reliability** — Fixed via [issue #527](https://github.com/Terrence721/platform-main/issues/527)

`EntityDispatcherFactory` holds the shared `reducedActions$` stream (the store's scanned actions, replaying the latest one) and builds each entity type's `EntityDispatcherBase`, with that entity's options merged over the injected defaults.

**Bug, fixed: `ngOnDestroy` did not release the scanned actions.** `reducedActions$` used `shareReplay(1)`, which by default never unsubscribes from its source. `ngOnDestroy` only dropped the factory's own keep-alive subscriber, so the subscription to `ScannedActionsSubject` outlived the factory, for example across TestBed resets or when an environment injector is destroyed. A new test failed on the unchanged source: after `ngOnDestroy`, an action emitted on the scanned actions still reached `reducedActions$`. It is now `shareReplay({ bufferSize: 1, refCount: true })`: the keep-alive subscriber holds the replay for the service's lifetime, and `ngOnDestroy` releases the source.

**Coverage gap, closed:** the factory had no spec, and the merge of an entity's `entityDispatcherOptions` over the app-wide defaults was untested (the definition spec only checks that the options are stored). The new `entity-dispatcher-factory.spec.ts` covers the injected defaults, an entity override that changes only the options it names, the id selector being passed through, the replay to a late subscriber, and the release on destroy.

**Follow-up needed:** the already-merged `EntityCacheDispatcher` (#519) has the same keep-alive `shareReplay(1)` subscription and no `ngOnDestroy` at all.

**Verification:** the whole `data` suite passes (70 files, 1,318 results, no type errors); eslint clean.

### [`dispatchers/entity-dispatcher.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/data/src/dispatchers/entity-dispatcher.ts)

**low · Reliability** — Fixed via [issue #533](https://github.com/Terrence721/platform-main/issues/533)

The `EntityDispatcher<T>` interface, implemented by `EntityDispatcherBase`, and `PersistenceCanceled`, the error a canceled query or save fails with.

**Changed (the repo owner chose "extend Error"): `PersistenceCanceled` was not an `Error`.** It was a plain class, so it had no stack trace and `instanceof Error` was false, and error-reporting code treated a cancellation as something other than an error. It now extends `Error`, with `name` set to `'PersistenceCanceled'` and the same default message (`'Canceled by user'`). `instanceof PersistenceCanceled` and `.message` behave as before, and the two existing tests pass unchanged. This is a small public-API change: code that relied on it not being an `Error` would notice. A new `persistence-canceled.spec.ts` covers it.

**Doc comment fixed:** `toUpdate` said "`update...` and `upsert...` methods take `Update<T>` args", but only the `update...` methods use it; the upsert methods dispatch the entities themselves (#521). The same sentence in `entity-dispatcher-base.ts` is fixed too.

**This completes `dispatchers/` (6 files).**

**Verification:** the whole `data` suite passes (72 files, 1,324 results, no type errors); eslint clean.

### [`effects/entity-cache-effects.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/effects/entity-cache-effects.ts)

**medium · Correctness** — Fixed via [issue #535](https://github.com/Terrence721/platform-main/issues/535)

`EntityCacheEffects` performs `SAVE_ENTITIES`: it calls `EntityCacheDataService.saveEntities`, races a matching `SAVE_ENTITIES_CANCEL`, and maps the result to `SaveEntitiesSuccess`, `SaveEntitiesError` or `SaveEntitiesCanceled`.

**Real bug, fixed: an optimistic save that got no content back never reported success.** When the server answered without a `ChangeSet` (typically `204 No Content`), a pessimistic save got a `SaveEntitiesSuccess` built from the request's change set, but an optimistic one got only `SET_LOADING false` actions, one per collection, "to avoid cache grinding". That had two consequences. `EntityCacheDispatcher.saveEntities()` waits for a `SAVE_ENTITIES_SUCCESS`, `ERROR` or `CANCEL` with its correlation id, so its Observable never emitted or completed. And the success reducers (`SAVE_*_MANY_SUCCESS`, through the change tracker's `mergeSave…` methods) are what commit an optimistic save's tracked changes, so the saved entities stayed marked as unsaved in `changeState`, where a later undo would revert them. The effect now returns a `SaveEntitiesSuccess` with the request's change set in both cases. New tests cover both; the optimistic one fails (times out) on the old code.

**Also:** the dead code left from that branch is removed (the `merge` and `EntityOp` imports and an unused factory parameter), a typo is fixed, and three pre-existing lint warnings in the spec are cleared (unused `observeOn` and `asapScheduler`, and a stale disable directive).

**Checked, not defects:** a `SaveEntities` action that already carries a reducer `error` goes straight to the error handler; an empty change set succeeds without calling the server; cancellation matches on the correlation id; and `race` drops whichever of the cancel and the response loses.

**Verification:** the whole `data` suite passes (72 files, 1,327 results, no type errors); eslint clean on the file and its spec.

### [`effects/entity-effects-scheduler.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/effects/entity-effects-scheduler.ts)

**No defects** — reviewed in [issue #539](https://github.com/Terrence721/platform-main/issues/539); a dead link fixed

`ENTITY_EFFECTS_SCHEDULER`, the optional token through which a test provides an RxJS scheduler for the effects' response delays.

The comment linked to `github.com/ReactiveX/rxjs/blob/master/doc/marble-testing.md`, which no longer exists (404); it now links to `rxjs.dev/guide/testing/marble-testing`. The same dead link in the already-merged `entity-cache-effects.ts` is fixed too, and `entity-effects.ts` and its marbles spec get it in `entity-effects.ts`'s review. The doc comment now also says the token is optional and that both effects fall back to the `asyncScheduler` without it.

**Recorded for `index.ts`'s review, not changed here:** the token is not exported from the `@ngrx/data` barrel, although both effects document it as the way to mock the scheduler in tests, so an app cannot provide one; only this repo's own spec can reach it, through `src/`.

### [`effects/entity-effects.ts`](https://github.com/Terrence721/platform-main/blob/e76449f726bf64a032e91992176db778666b258d/modules/data/src/effects/entity-effects.ts)

**No defects** — reviewed in [issue #541](https://github.com/Terrence721/platform-main/issues/541); documentation, lint and a broken test helper fixed

`EntityEffects` performs every single-entity query and save (`persistOps`): it calls the entity's data service, races a matching `CANCEL_PERSIST`, and maps the result through the `PersistenceResultHandler`; skipped and already-failed actions short-circuit.

**`persistOps` and the `SAVE_*_MANY` ops, carried over from #493:** not a defect. Only `saveEntities` produces those ops, as collection actions that the entity cache reducer applies to itself without dispatching them, and they are persisted through `EntityCacheEffects`; the data-service interface has no many-item methods either. This is now documented on `persistOps`.

**Fixed:** `handleSkipSuccess$`'s comment said it waits "one tick (by using a promise)", but it delays by `responseDelay` on the (injected) scheduler; the dead RxJS marble-testing link (see #539) is fixed here and in the marbles spec; and the pre-existing lint warnings are cleared (an unused `id` parameter in `persist`, a stale disable directive in each spec, and an unused variable in the marbles spec).

**Test helper fixed: `spec/effects/marbles.ts` did not type-check**, the source of the two `tsc` errors noted throughout this review. It imported `TestMessage`, which is not public in RxJS 7, and its `vitest` `Assertion` augmentation declared one type parameter where Vitest 5 declares two (`TS2428`). It now defines `TestMessage` locally from RxJS's public `ObservableNotification`, and the augmentation matches Vitest's type parameters; `tsc` on the `data` spec config reports no errors.

**Checked:** the `QUERY_LOAD` change from #523 (`getAll` without a query, `getWithQuery` with one), the update response's `changed` flag (#497), the upsert falling back to the sent entity when the server returns nothing, and the `default:` throw being caught by `persist`'s `try`.

**Verification:** the whole `data` suite passes (72 files, 1,341 results, no type errors); eslint clean on the file and its three spec files.

### [`entity-data-config.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-data-config.ts)

**medium · Correctness** — Fixed via [issue #543](https://github.com/Terrence721/platform-main/issues/543)

`EntityDataModuleConfig`, the options object of `provideEntityData()` and `EntityDataModule.forRoot()`. Types only, so each field was traced to where it is used.

**Real bug, fixed: `initialEntityCacheState` was silently ignored.** `provideEntityDataConfig` (in `provide-entity-data.ts`, used by both `provideEntityData` and `forRoot`) provided every other field as its token but never `INITIAL_ENTITY_CACHE_STATE`, and nothing else read `config.initialEntityCacheState`. So `provideEntityData({ initialEntityCacheState: { Hero: … } })` started with an empty entity cache; only providing the token directly worked. The new `entity-data-config.spec.ts` showed it on the unchanged code: the cache was `{}` for both the value and the function form. `provideEntityDataConfig` now provides the token from the option when the option is set, and only then, so a directly provided token still applies otherwise.

**Doc comments added:** none of the fields had one. Each now says what it does; for example, only the cache meta-reducers accept an `InjectionToken` (resolved with `inject()`), and `pluralNames` feeds the pluralizer used to build collection URLs.

**Checked:** `entityMetadata`, both meta-reducer lists and `pluralNames` reach their tokens and consumers (`EntityDefinitionService`, `EntityCollectionReducerRegistry`, `DefaultPluralizer`).

**Verification:** the whole `data` suite passes (74 files, 1,347 results, no type errors); eslint clean.

### [`entity-data-without-effects.module.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-data-without-effects.module.ts)

**No defects** — reviewed in [issue #545](https://github.com/Terrence721/platform-main/issues/545); one coverage gap closed

`EntityDataModuleWithoutEffects`, the NgModule form of `@ngrx/data` without effects or HTTP data services: `BASE_ENTITY_DATA_PROVIDERS`, and `forRoot(config)`, which calls `provideEntityDataConfig`.

The base providers include the environment initializer that registers the entity cache reducer, so the module works without `EntityDataModule`, and none of the base services depend on the HTTP-side providers (`Pluralizer`, `HttpUrlGenerator`, `DefaultDataServiceFactory`), which only `ENTITY_DATA_EFFECTS_PROVIDERS` supplies.

**Coverage gap, closed:** `forRoot` had no test anywhere; the only spec using the module imports it plainly. The new `entity-data-without-effects.module.spec.ts` checks that the configured initial entity cache is registered (which also covers #543's fix through the `forRoot` path), that cache-only commands update the store with no effects or HTTP, and that neither `EntityEffects` nor `EntityDataService` is provided. The doc comment's grammar is fixed, and it now says to configure the module with `forRoot` and that `EntityDataModule` adds the effects.

**Verification:** the whole `data` suite passes (76 files, 1,353 results, no type errors); eslint clean.

### [`entity-data.module.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-data.module.ts)

**No code defect** — reviewed in [issue #547](https://github.com/Terrence721/platform-main/issues/547); a missing requirement documented

`EntityDataModule`: `EntityDataModuleWithoutEffects` plus `ENTITY_DATA_EFFECTS_PROVIDERS` (the HTTP data services and the two effects), configured with `forRoot`.

The module only registers its effects with `EffectSources.addEffects`; they run once the app sets up @ngrx/effects (`EffectsModule.forRoot()` or `provideEffects()`). Without that, nothing fails and nothing warns, but no query or save ever reaches the server. A throwaway probe (deleted afterwards) showed it: with `StoreModule.forRoot` and `EntityDataModule.forRoot`, `getAll()` sent no HTTP request at all; adding `EffectsModule.forRoot([])` made it send one. `provideEntityData`'s doc example includes `provideEffects()`, but this module's doc comment said only "Configure with `forRoot`". It now states the requirement and the silent failure mode, and points to `EntityDataModuleWithoutEffects` for opting out on purpose.

A dev-mode warning was considered and not added: `EffectSources` and `EffectsRunner` are both `providedIn: 'root'`, and whether the runner has started is private, so there is no clean public signal to detect the missing setup.

**Checked:** `forRoot` provides the config once, over the imported `EntityDataModuleWithoutEffects`, through `provideEntityDataConfig` (fixed in #543); the existing module spec covers replaced effects and a cache meta-reducer.

### [`entity-metadata/entity-definition.service.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-metadata/entity-definition.service.ts)

**low · Correctness** — Fixed via [issue #549](https://github.com/Terrence721/platform-main/issues/549)

`EntityDefinitionService`, the registry of every entity type's `EntityDefinition`, which the dispatchers, selectors, reducers and `EntityCacheDataService` read through `getDefinition`. Both findings were probed on the unchanged source with a throwaway spec.

**Bug, fixed: entity names that `Object.prototype` also has returned built-in functions** (the lookup pattern found in #509). The registry was a plain `{}`, so `getDefinition('constructor')` returned `Object` instead of throwing "No EntityDefinition", and `getDefinition('toString', false)` returned a function instead of `undefined`; callers then read `selectId` and the rest from it. The registry now has no prototype (`Object.create(null)`), which also makes an entity named `__proto__` an ordinary key when registering.

**Bug, fixed: `registerDefinition(s)` did not trim names.** `getDefinition` trims the name it looks up, and the metadata path trims through `createEntityDefinition`, but `registerDefinitions({ ' Sidekick ': definition })` stored the untrimmed key, so `getDefinition('Sidekick')` then threw, and `registerDefinition` keyed on `definition.entityName` as given. Both trim now.

**Also:** three copy-pasted doc comments are fixed (`getDefinition` said "Get (or create) a data service", `registerMetadata` documented parameters it does not have, and `registerDefinition`'s example passed two arguments), and a pre-existing lint warning in the spec is cleared.

**Noted for `entity-definition.ts`'s review:** `createEntityDefinition` writes the trimmed name back onto the caller's metadata object.

**Verification:** the whole `data` suite passes (76 files, 1,357 results, no type errors); eslint clean.

### [`entity-metadata/entity-definition.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-metadata/entity-definition.ts)

**low · Reliability** — Fixed via [issue #551](https://github.com/Terrence721/platform-main/issues/551)

`EntityDefinition` and `createEntityDefinition`, which turns an entity type's `EntityMetadata` into its definition: the entity adapter, `selectId`, `sortComparer`, the initial collection state and the dispatcher options.

**Bug, fixed (carried over from #549): `createEntityDefinition` modified the caller's metadata.** It wrote `metadata.entityName = entityName.trim()` and `metadata.sortComparer = … || false` into the object it was given, and kept that same object as `def.metadata`. A throwaway probe on the unchanged source showed the caller's object coming back with a trimmed name and a new `sortComparer: false`, and a frozen metadata object making it throw `TypeError: Cannot assign to read only property 'entityName'`. `registerMetadataMap`, the `provideEntityData` path, spreads each entry into a new object first, so only direct `registerMetadata(...)` callers were affected. The definition now gets a normalized copy (`{ ...metadata, entityName, sortComparer }`); the existing `def.metadata.sortComparer` test still holds, and the one runtime reader (`EntityCollectionServiceElementsFactory`) only reads it. A new test uses frozen metadata. Pre-existing lint warnings in the spec (an unused interface and unused stub parameters) are also cleared.

**Noted, not changed:** `additionalCollectionState` is spread after the core collection fields, so it can override `entityName`, `changeState`, `loaded` and the like; that looks deliberate, since it lets an app start a collection as loaded.

**Verification:** the whole `data` suite passes (76 files, 1,359 results, no type errors); eslint clean.

### [`entity-metadata/entity-filters.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-metadata/entity-filters.ts)

**medium · Correctness** — Fixed via [issue #553](https://github.com/Terrence721/platform-main/issues/553)

`EntityFilterFn` and `PropsFilterFnFactory`, which builds the filter behind a collection's `filteredEntities` selector: a RegExp, or a RegExp string, tested against the given props of each entity. All three findings were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: a global or sticky RegExp skipped matches.** `RegExp.test` is stateful for the `g` and `y` flags, so `lastIndex` carried over from one entity to the next; `/al/gi` over Alpha, Alfred and Alice returned only Alpha and Alice. The filter now tests a copy of the RegExp from index 0 for every value, which keeps the sticky flag's meaning (anchored at the start of each value) and leaves the caller's RegExp and its `lastIndex` untouched. A first version of the fix dropped the `g`/`y` flags instead, which would have unanchored a sticky pattern; a test now pins the anchoring.

**Bug, fixed: an invalid string pattern threw inside the selector.** A string pattern is compiled with `new RegExp(pattern, 'i')`, so a search-box value like `a(` threw `SyntaxError: Unterminated group` from `filteredEntities`. A string that is not a valid RegExp is now matched literally and case-insensitively; this is a small behaviour change, since such input used to throw.

**Bug, fixed: a missing prop matched the text "undefined" or "null".** `test(undefined)` tests the string "undefined", so searching "undef" returned an entity with no `name`. `null` and `undefined` values no longer match.

**Verification:** the whole `data` suite passes (76 files, 1,367 results, no type errors); eslint clean.

### [`entity-metadata/entity-metadata.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-metadata/entity-metadata.ts)

**medium · Correctness** — Fixed via [issue #559](https://github.com/Terrence721/platform-main/issues/559)

`ENTITY_METADATA_TOKEN`, the `EntityMetadata` interface (the per-entity settings an app passes to @ngrx/data) and `EntityMetadataMap`. All six metadata fields are used. The findings were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: an `additionalCollectionState` key named like a built-in one silently corrupted the collection.** The extra state is spread over the built-in initial state and its selectors over the built-in ones, so `{ loaded: 'oops' }` made the initial `loaded` `'oops'` and replaced `selectLoaded`. `createEntityDefinition` now throws, naming the entity and the key(s), for `ids`, `entities`, `entityName`, `filter`, `loaded`, `loading` or `changeState`; this is a behaviour change, since such metadata used to be accepted. Names only `Object.prototype` has, such as `toString`, are still allowed.

**Type bug, fixed: the token was typed as one map but always holds an array.** Every provider uses `multi: true`, so injecting it gives `EntityMetadataMap[]`, which is how `EntityDefinitionService` already injected it. The token is now `InjectionToken<EntityMetadataMap[]>`.

**Bug, fixed: providing the token without `multi` crashed** with `entityMetadataMaps.forEach is not a function`. `EntityDefinitionService` now also accepts a single map.

**Docs and lint:** the token and every field now have doc comments, including the reserved names, and the `S extends object = {}` default (a `no-empty-object-type` warning) is now `= object`.

**Verification:** the whole `data` suite passes (76 files, 1,377 results, no type errors); spec and build type checks and eslint clean.

### [`entity-services/entity-collection-service-base.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-services/entity-collection-service-base.ts)

**medium · Correctness** — Fixed via [issue #561](https://github.com/Terrence721/platform-main/issues/561)

`EntityCollectionServiceBase`, the base class of every entity collection service: it forwards each command to the collection's `EntityDispatcher` and exposes its selectors$. Compared member by member against `EntityCommands`, `EntityDispatcher` and `EntitySelectors$`, every command and selector is exposed. The findings were probed on the unchanged source with a throwaway spec and a recording fake dispatcher.

**Real bug, fixed: four commands dropped their options.** `clearCache`, `setFilter`, `setLoaded` and `setLoading` had no `options` parameter and called the dispatcher without one, although `EntityCommands` declares it and the dispatcher puts it on the action (tag, correlationId, mergeStrategy). They now take and forward `options`.

**Type bug, fixed: `add` of a partial entity required explicit options.** The service demanded `{ isOptimistic: false }`, while the dispatcher allows a partial entity with no options, since add is pessimistic by default; `service.add({ name })` failed type checking. The overloads now match `EntityCommands`.

**Docs, fixed:** a nonexistent parameter in the class doc, wrong parameter names on `delete(entity)` and `removeManyFromCache(entities)`, upsert docs that said to pass `Update<T>` (they take entities), and a comment in `updateOneInCache` claiming it builds the `Update<T>` (the dispatcher does).

**Verification:** the whole `data` suite passes (78 files, 1,381 results, no type errors); spec and build type checks and eslint clean.

### [`entity-services/entity-collection-service-elements-factory.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-services/entity-collection-service-elements-factory.ts)

**No defects** — reviewed in [issue #563](https://github.com/Terrence721/platform-main/issues/563); one coverage gap closed

`EntityCollectionServiceElementsFactory` builds the core elements of an entity collection service (dispatcher, selectors, selectors$) from the entity type's registered definition; `EntityCollectionServiceElements` is their shape.

Every call matches its callee, and a throwaway probe confirmed the behaviour: an entity's own `entityDispatcherOptions` (e.g. `optimisticAdd: true`) reach its dispatcher while other types keep the defaults, the name is trimmed consistently across all elements, and an unknown type throws a clear "No EntityDefinition" error. `create(undefined)` fails with a TypeError on `trim`, but the parameter is typed `string`, so it was left as is.

**Coverage gap, closed:** the file had no spec, and nothing tested that per-entity dispatcher options reach the dispatcher, although this factory is the only place that passes them. The new `entity-collection-service-elements-factory.spec.ts` covers that, the trimmed name across all elements, and the unknown-type error. The interface's four fields also got doc comments.

**Verification:** the whole `data` suite passes (80 files, 1,387 results, no type errors); spec and build type checks and eslint clean.

### [`entity-services/entity-collection-service-factory.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-services/entity-collection-service-factory.ts)

**low · Types** — Fixed via [issue #565](https://github.com/Terrence721/platform-main/issues/565)

`EntityCollectionServiceFactory.create<T, S$>(entityName)` builds an `EntityCollectionServiceBase` for an entity type from the elements factory.

**Type bug, fixed: the custom selectors$ type was lost.** `create<T, S$>` returned `EntityCollectionService<T>`, whose `selectors$` is plain `EntitySelectors$<T>`. That interface has a catch-all index signature, so a custom selector$ such as `foo$` for `additionalCollectionState.foo` came back as `any` instead of the `Observable<string>` declared in `S$`; a throwaway probe showed `foo$.subscribe(v => ...)` failing type checking on the implicit `any` while `foo$` emitted its value at runtime. The return type is now `EntityCollectionServiceBase<T, S$>`, the class actually returned, whose `selectors$` is exactly `S$`. The change is type-only and more specific, so callers holding the interface are unaffected; an intersection with `{ selectors$: S$ }` would not have worked, since `any & X` is `any`.

**Coverage gap, closed:** the file had no spec. The new `entity-collection-service-factory.spec.ts` checks the created class, the custom selectors$ type (an `expectTypeOf` test, shown to fail against the old `any`) and value, and the unknown-type error. `create` now documents its return value and its error, and an unused import is gone.

**Carry-over:** `entity-services-base.ts` passes `S$` through `getEntityCollectionService` and `createEntityCollectionService` but still returns the interface, losing it the same way; to be fixed in that file's review.

**Verification:** the whole `data` suite passes (82 files, 1,393 results, no type errors); spec and build type checks and eslint clean.

### [`entity-services/entity-collection-service.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-services/entity-collection-service.ts)

**medium · Correctness** — Fixed via [issue #567](https://github.com/Terrence721/platform-main/issues/567)

The `EntityCollectionService<T>` interface: the facade apps get from `EntityServices`, combining `EntityCommands<T>` and `EntitySelectors$<T>`. Both findings were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: custom selectors$ were offered on the service but missing.** The interface extends `EntitySelectors$<T>`, whose index signature exists for `additionalCollectionState` selectors$, so `service.foo$` type-checks; but `EntityCollectionServiceBase` copied only the built-in selectors$ onto itself, so `service.foo$` was `undefined` and only `service.selectors$.foo$` existed. The base class now also puts the custom selectors$ on the service, skipping any name the service already has, so they can never replace a command or a built-in selector$. This is an additive behaviour change.

**Type bug, fixed: `createEntityAction` was typed by the entity, not the data.** The interface returned `EntityAction<T>` for any payload, so for `QUERY_BY_KEY` with key `42`, `action.payload.data!.name` type-checked as a `string` but was `undefined`. It now matches the dispatcher: `createEntityAction<P>(op, data?: P, options?): EntityAction<P>`.

**Not changed:** the same index signature lets a typo such as `service.entitties$` type-check as `any`; it comes from `EntitySelectors$` and is noted for the `selectors/entity-selectors$.ts` review.

**Verification:** the whole `data` suite passes (82 files, 1,397 results, no type errors); spec and build type checks and eslint clean.

### [`entity-services/entity-services-base.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-services/entity-services-base.ts)

**medium · Correctness** — Fixed via [issue #569](https://github.com/Terrence721/platform-main/issues/569)

`EntityServicesBase`, the default `EntityServices`: the registry of entity collection services (get-or-create, register) plus the cache-wide observables. The findings were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: an entity named like an `Object.prototype` member got `Object` back.** The registry was a plain `{}`, so `getEntityCollectionService('constructor')` found the inherited `Object.prototype.constructor` and returned `Object` itself instead of creating the entity's service. The registry now has no prototype, as in `EntityDefinitionService`; this closes the `{}[entityName]` carry-over for this file.

**Bug, fixed: names were not trimmed.** The rest of the module trims entity names, but the registry used them raw, so after registering a custom `Hero` service, `get(' Hero ')` quietly created a second, default one. Names are now trimmed when storing and looking up.

**Types, fixed where sound:** `createEntityCollectionService<T, S$>`, which always builds through the factory, now returns `EntityCollectionServiceBase<T, S$>`, so its `selectors$` keep `S$` (the carry-over from the factory review). `getEntityCollectionService` still returns the interface, because it may return a registered service of any class; its doc now explains that and how to reach typed custom selectors$. The spec's unused lint directive and variable are also gone.

**Verification:** the whole `data` suite passes (82 files, 1,403 results, no type errors); spec and build type checks and eslint clean.

### [`entity-services/entity-services-elements.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-services/entity-services-elements.ts)

**low · Docs** — Fixed via [issue #572](https://github.com/Terrence721/platform-main/issues/572)

`EntityServicesElements`, the injectable bundle `EntityServicesBase` reads through its getters: the collection service factory, the store, `entityActionErrors$`, `entityCache$` and `reducedActions$`.

**Docs, fixed: the store was described as "scoped to the EntityCache".** It is the root store: a throwaway probe found its state keys were `['entityCache']`, and `store.select(c => c['Hero'])` type-checked, since the store is typed `Store<EntityCache>`, but emitted `undefined`. The doc here and on `EntityServicesBase.store` now says it is the root store and how to read the cache (`entityCache$` or `ENTITY_CACHE_SELECTOR_TOKEN`). The `Store<EntityCache>` type is used across the module, including the public `EntityDispatcher.store`, so retyping it is tracked separately in [#571](https://github.com/Terrence721/platform-main/issues/571).

**Coverage gap, closed:** the file had no spec. The new `entity-services-elements.spec.ts` pins the root store with the cache under `entityCache`, `entityCache$` as that cache, and `reducedActions$` replaying the most recent reduced action to a late subscriber.

**Verification:** the whole `data` suite passes (84 files, 1,407 results, no type errors); spec and build type checks and eslint clean.

### [`entity-services/entity-services.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/entity-services/entity-services.ts)

**low · Types** — Fixed via [issue #574](https://github.com/Terrence721/platform-main/issues/574)

The abstract `EntityServices` class, the contract and DI token apps inject, for which `EntityServicesBase` is provided; also `EntityCollectionServiceMap`. Every member matches `EntityServicesBase` except one.

**Type bug, fixed: the contract could not register a service under a name.** `registerEntityCollectionService(service)` had no name parameter, while the provided `EntityServicesBase` accepts an optional `serviceName`; a throwaway probe showed `registerEntityCollectionService(service, 'Name')` on an `EntityServices` failing type checking. The abstract method now declares `serviceName?: string`, which is non-breaking, since a subclass that ignores it still satisfies the contract. An unused `eslint-disable` directive was also removed.

**Verification:** the whole `data` suite passes (84 files, 1,409 results, no type errors); spec and build type checks and eslint clean. A new test registers under a given name through the `EntityServices` contract.

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/index.ts)

**low · API** — Fixed via [issue #576](https://github.com/Terrence721/platform-main/issues/576)

The public API barrel of `@ngrx/data`, compared with every exported name under `src/`.

**API gap, fixed: `ENTITY_EFFECTS_SCHEDULER` was not public.** The token's doc says to provide it to inject a test scheduler during marble tests, but the barrel did not export it, so the repo's own marble spec had to deep-import it from `src/`, a path apps cannot import from the published package. It is now exported, and the marble spec imports it from the package root; this closes the carry-over from the `effects/entity-effects-scheduler.ts` review.

**Deliberately left private:** `BASE_ENTITY_DATA_PROVIDERS`, `ENTITY_DATA_EFFECTS_PROVIDERS` and `provideEntityDataConfig` are internal building blocks of `provideEntityData`; `HttpParams` and `HttpHeaders` are the field types of the exported `HttpOptions`, and exporting them would shadow Angular's classes of the same names (apps can write `HttpOptions['httpParams']`). Every other exported name is in the barrel.

**Verification:** the whole `data` suite passes (84 files, 1,409 results, no type errors); spec and build type checks and eslint clean.

### [`provide-entity-data.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/provide-entity-data.ts)

**medium · Correctness** — Fixed via [issue #578](https://github.com/Terrence721/platform-main/issues/578)

The standalone API (`provideEntityData`, `withEffects`) and the provider lists and config providers it shares with both `forRoot` NgModule methods, which call `provideEntityDataConfig` too.

**Real bug, fixed: meta-reducers provided directly were silently dropped.** `provideEntityDataConfig` always provided `ENTITY_CACHE_META_REDUCERS` and `ENTITY_COLLECTION_META_REDUCERS`, as `[]` when the config had none, so an app providing these public tokens directly before `provideEntityData(...)` lost them; a throwaway probe showed such meta-reducers never running, while the same providers placed after it ran. They are now provided only when the config sets them, the same fix made for `initialEntityCacheState` in the `entity-data-config.ts` review; their consumers already treat a missing token as none. A doc typo ("should to be used") is also fixed.

**Verification:** the whole `data` suite passes (84 files, 1,413 results, no type errors); spec and build type checks and eslint clean. New tests cover meta-reducers from the config and meta-reducer tokens provided before `provideEntityData`.

### [`reducers/constants.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/constants.ts)

**medium · Correctness** — Fixed via [issue #580](https://github.com/Terrence721/platform-main/issues/580)

`ENTITY_CACHE_NAME` and the public tokens for the cache name, the cache and collection meta-reducers and the initial cache state; none was documented.

**Real bug, fixed: a custom cache name provided before `provideEntityData` was silently ignored.** The base providers always provided `ENTITY_CACHE_NAME_TOKEN` with the default, so an app's own name applied only when provided after them; a throwaway probe showed the cache staying under `entityCache` in that case, while the same provider placed after put it under `myCache`. The default provider is removed, since both consumers already inject the token optionally and fall back to `ENTITY_CACHE_NAME`, so a custom name now applies in any order. This is a behaviour change: app code that injects the token without `optional` now fails when no custom name is set, which the token's doc now warns about.

**Types and docs, fixed:** `ENTITY_CACHE_META_REDUCERS` now admits `InjectionToken`s of meta-reducers, as the config and the cache initializer already did, and every constant and token is documented, including which config option sets it.

**Verification:** the whole `data` suite passes (84 files, 1,418 results, no type errors); spec and build type checks and eslint clean. New tests cover a custom cache name provided before and after `provideEntityData`, and the default.

### [`reducers/entity-cache-reducer.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-cache-reducer.ts)

**high · Correctness** — Fixed via [issue #582](https://github.com/Terrence721/platform-main/issues/582)

`EntityCacheReducerFactory`: the reducer for the whole entity cache, handling the cache-level actions and passing every collection `EntityAction` to that collection's reducer. The findings were probed on the unchanged source with throwaway specs.

**Real bug, fixed: a collection-reducer error stopped the store under NgRx's default runtime checks.** The reducer reported a failure by writing `action.payload.error` on the dispatched action, for the entity effects to read, but NgRx's default dev checks freeze actions, so the write threw inside the reducer; a probe showed "Cannot add property error, object is not extensible" and the next action never applied. With `strictActionImmutability: false` the same sequence worked. A small internal side channel now records the error on the payload when it is writable, as before, and otherwise in a `WeakMap` keyed by the action; the reducer writes through it and both entity effects read through it, so they still skip the server call.

**Bug, fixed: a save cancel or error for a collection not in the cache crashed** with "Cannot read properties of undefined (reading 'loading')"; such collections are now skipped.

**Also fixed:** the clear, load and merge reducers now pass `tag` on to the collection actions they create, as the save reducers already did (clearing three lint warnings), and the spec's `expectLoadingFlags` helper, which checked nothing when given names, now checks them.

**Verification:** the whole `data` suite passes (84 files, 1,426 results, no type errors); spec and build type checks and eslint clean.

### [`reducers/entity-cache.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-cache.ts)

**No defects** — reviewed in [issue #584](https://github.com/Terrence721/platform-main/issues/584); a documentation gap closed

The `EntityCache` interface: the @ngrx/data state, every cached collection keyed by entity name.

**Documentation gap, closed:** the index signature says every name maps to an `EntityCollection`, but a collection only exists once an action for its type has been reduced or the initial state included it; that mismatch is how the `clearLoadingFlags` crash fixed in the `entity-cache-reducer.ts` review passed type checking. Every access inside the module already copes with a missing collection, and making the public type `EntityCollection<any> | undefined` would break app code such as `cache['Hero'].entities`, so the type is unchanged and the interface is now documented instead: what it holds, where it lives in the root state, and that a name can be missing.

**Verification:** the whole `data` suite passes (84 files, 1,426 results, no type errors); build type check and eslint clean.

### [`reducers/entity-change-tracker-base.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-change-tracker-base.ts)

**medium · Correctness** — Fixed via [issue #586](https://github.com/Terrence721/platform-main/issues/586)

`EntityChangeTrackerBase`, the default change tracker: it records unsaved changes before the collection reducer applies them, merges query and save results by `MergeStrategy`, and commits or undoes tracked changes. Both bugs were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: `PreserveChanges` merges updated only the first tracked entity.** Behind `mergeQueryResults`, `mergeSaveAdds` and `mergeSaveUpserts`, a tracked entity's `originalValue` was set only on the first pass through the batch, so with two locally updated heroes, the second kept a stale original and an undo would restore stale data. Every tracked entity is now updated, as `mergeSaveUpdates` already did.

**Bug, fixed: `mergeSaveUpdates` with `PreserveChanges` lost tracking when the saved changes omitted the key.** It read the new id from the changes, so a missing `id` moved the tracked change to the key `"undefined"`; a missing key now means the id did not change.

**Coverage gap, closed:** `mergeSaveUpdates` and `mergeSaveDeletes` had no tests; new tests cover each merge strategy for both, plus both fixes. A parameter doc ("entities keys") and four unused names (one in the source, three in the spec) are also fixed.

**Verification:** the whole `data` suite passes (84 files, 1,440 results, no type errors); spec and build type checks and eslint clean.

### [`reducers/entity-change-tracker.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-change-tracker.ts)

**No defects** — reviewed in [issue #588](https://github.com/Terrence721/platform-main/issues/588); doc comments fixed

The `EntityChangeTracker` interface, implemented by `EntityChangeTrackerBase`; the class `implements` it, so the compiler already checks that the signatures match.

**Doc comments fixed:** the interface doc pointed to "EntityChangeTracker docs" from inside `EntityChangeTracker` itself and now names the default implementation; two parameters were documented under the wrong names (`keys`, `entity`); `mergeSaveUpdates` documented `collection` out of order; and two sentences had grammar slips. Three of these slips were also in `entity-change-tracker-base.ts`, missed in its own review, and are fixed there too.

**Verification:** the whole `data` suite passes (84 files, 1,440 results, no type errors); build type check and eslint clean.

### [`reducers/entity-collection-creator.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-collection-creator.ts)

**No defects** — reviewed in [issue #590](https://github.com/Terrence721/platform-main/issues/590); weak tests tightened, one coverage gap closed

`EntityCollectionCreator`, which gives an entity type its starting collection (its definition's initial state, else an empty collection), and `createEmptyEntityCollection`. The empty collection's `filter: undefined`, where registered types start with `''`, is allowed by the type and filters the same way, so it is left as is.

**Tests tightened and a gap closed:** the two empty-collection tests only checked that `ids` existed, so a wrong entity name or leftover state would have passed; they now compare the whole collection. Creating a collection with no `EntityDefinitionService`, which is what `EntitySelectorsFactory` does when the creator is not injected, had no test and now has one. The class and the helper also got doc comments.

**Verification:** the whole `data` suite passes (84 files, 1,442 results, no type errors); build type check and eslint clean.

### [`reducers/entity-collection-reducer-methods.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-collection-reducer-methods.ts)

**high · Correctness** — Fixed via [issue #592](https://github.com/Terrence721/platform-main/issues/592)

`EntityCollectionReducerMethods`, the per-`EntityOp` reducer methods of a collection (queries, saves and their results, cache-only operations, change tracking), and its factory; 1,242 lines, read in full. The findings were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: a batch delete that included a never-saved entity skipped the server delete for every key.** `saveDeleteMany` marked the whole action to skip as soon as one key was an unsaved add, although its doc says the keys are still sent; deleting `[unsaved 1, saved 2]` removed both locally and never deleted entity 2 on the server, so it would return on the next load. The server call is now skipped only when every key is an unsaved add.

**Bug, fixed: deleting a never-saved entity failed under NgRx's default runtime checks.** The delete methods wrote `action.payload.skip` on the frozen dispatched action, which threw, so the entity stayed and the effect reported an error. As with reducer errors in the `entity-cache-reducer.ts` review, the skip is now recorded on the payload when writable and otherwise in a `WeakSet`, and `EntityEffects` reads it through the same helper.

**Also fixed:** `addAll`'s doc claimed it preserved unsaved changes (it clears them); an unused variable, a stray `TODO` region and a mislabelled region are gone; and 15 unused `action` parameters on protected methods, kept for subclasses, are renamed `_action`.

**Verification:** the whole `data` suite passes (86 files, 1,452 results, no type errors); spec and build type checks and eslint clean. New tests cover both delete fixes in the reducer and the effect.

### [`reducers/entity-collection-reducer-registry.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-collection-reducer-registry.ts)

**medium · Correctness** — Fixed via [issue #594](https://github.com/Terrence721/platform-main/issues/594)

`EntityCollectionReducerRegistry`: the per-entity collection reducers, each wrapped in the collection meta-reducers. Both bugs were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: a padded name replaced an app's custom reducer with a default one.** `registerReducer` stored under the trimmed name, but `getOrCreateReducer` looked up the raw name, missed, and registered a fresh default reducer under the trimmed name, so after `registerReducer('Hero', custom)`, a lookup of `' Hero '` silently replaced `custom`. The lookup now trims too.

**Bug, fixed: an entity named like an `Object.prototype` member got `Object` as its reducer.** The map was a plain `{}`, so `getOrCreateReducer('constructor')` returned `Object`, which hands the collection back unchanged, and every action for that entity did nothing. The map now has no prototype, as in the definition and services registries; this closes the `{}[entityName]` carry-over for this file.

**Also fixed:** a redundant second store in `getOrCreateReducer`, and dead code in the spec (two unused helpers with a stale lint directive, an unused class, import, variables and parameter).

**Verification:** the whole `data` suite passes (86 files, 1,456 results, no type errors); spec and build type checks and eslint clean. New tests cover both fixes.

### [`reducers/entity-collection-reducer.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-collection-reducer.ts)

**low · Correctness** — Fixed via [issue #596](https://github.com/Terrence721/platform-main/issues/596)

`EntityCollectionReducerFactory`: the default collection reducer, which calls the reducer method for the action's `entityOp`.

**Bug, fixed: an `entityOp` named like an `Object.prototype` member corrupted the collection.** The method map is a plain object literal, so the lookup also found inherited functions; a throwaway probe showed an action with `entityOp: 'toString'` replacing the Hero collection with the string `"[object Undefined]"`. Only the map's own methods are called now. Real `EntityOp` values never collide, so this guards malformed or hand-built actions.

**Lint:** dead code in the spec (an unused class, two unused variables, an unused helper with its import, and a stale directive) is removed.

**Verification:** the whole `data` suite passes (86 files, 1,458 results, no type errors); spec and build type checks and eslint clean. A new test covers the prototype-named ops.

### [`reducers/entity-collection.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/reducers/entity-collection.ts)

**No defects** — reviewed in [issue #598](https://github.com/Terrence721/platform-main/issues/598); doc comments that contradicted the reducers fixed

`ChangeType`, `ChangeState`, `ChangeStateMap` and the `EntityCollection` interface: types only. Their doc comments were checked against what the reducer methods actually do.

**Doc comments fixed:** `loaded` claimed only a query-all sets it, but query-many, load and `ADD_ALL` do too, and only `REMOVE_ALL` clears it; `loading` implied it tracks every operation in progress, but it is a single flag that the first operation to finish turns off; and `ChangeType.Unchanged` is now noted as never stored. `filter` is typed `string` although `setFilter` accepts any pattern the filter function understands, including a `RegExp`; that is documented rather than widened, since widening a public type could break apps.

**Verification:** the whole `data` suite passes (86 files, 1,458 results, no type errors); build type check and eslint clean.

### [`selectors/entity-cache-selector.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/selectors/entity-cache-selector.ts)

**No defects** — reviewed in [issue #600](https://github.com/Terrence721/platform-main/issues/600); one coverage gap closed

The token, provider, type and factory for the feature selector of the EntityCache, for the name in the optional `ENTITY_CACHE_NAME_TOKEN` or `ENTITY_CACHE_NAME`; the fallback agrees with the cache initializer.

**Coverage gap, closed:** the specs used `createEntityCacheSelector()` only as a setup helper with the default name, so the custom-name path was covered only indirectly by the `reducers/constants.ts` review's end-to-end test. The new `entity-cache-selector.spec.ts` covers the default and a custom name, and the provider with and without the name token. The four exports also got doc comments.

**Verification:** the whole `data` suite passes (88 files, 1,466 results, no type errors); build type check and eslint clean.

### [`selectors/entity-selectors$.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/selectors/entity-selectors$.ts)

**medium · Correctness** — Fixed via [issue #602](https://github.com/Terrence721/platform-main/issues/602)

The `EntitySelectors$` interface and the factory that turns a collection's selectors into observables, plus the action and error streams.

**Bug, fixed: `errors$` replayed an old error to every new subscriber.** The shared error stream behind every collection's `errors$` (and `EntityServices.entityActionErrors$`) ended in `shareReplay(1)`, so a page that subscribed after a failure immediately received that old error as if it had just happened; a throwaway probe confirmed it. It also stayed subscribed to every action for the life of the app. It now uses `share()`, so subscribers get only errors that happen while subscribed, like `entityActions$`; this is a behaviour change for code that relied on getting the last error on subscribe.

**Typo safety, documented:** the index signature lets any property name type-check, so a typo such as `service.entitties$` compiles as `any`. It is kept because it is what types custom selectors$ on the service, and its doc now states the trade-off and how to get typed custom selectors$ instead. Unused test values were also removed.

**Verification:** the whole `data` suite passes (88 files, 1,468 results, no type errors); build type check and eslint clean. A new test covers a late subscriber.

### [`selectors/entity-selectors.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/selectors/entity-selectors.ts)

**medium · Correctness** — Fixed via [issue #604](https://github.com/Terrence721/platform-main/issues/604)

`CollectionSelectors`, `EntitySelectors` and `EntitySelectorsFactory`: a collection's selectors, from the collection and from the store root through the cache. Both bugs were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: an extra state key could silently replace a built-in selector.** Extra selectors are spread over the built-in ones, and the `entity-metadata.ts` review only rejected names of built-in state; `additionalCollectionState: { count: 'not a number' }` was accepted, and `selectCount` then returned that string instead of the entity count. `createEntityDefinition` now also rejects the names whose selectors or selectors$ the collection already has (`count`, `keys`, `entityMap`, `filteredEntities`, `collection`, `entityCache`, `entityActions`, `errors`), and the metadata doc lists them.

**Bug, fixed: selectors of an entity named like an `Object.prototype` member crashed before its collection existed**, because the cache lookup found the inherited member; for `constructor`, `selectEntities` threw. The lookup now reads own properties only.

**Docs and lint:** two "much have" typos, loading/loaded docs aligned with `EntityCollection`, a stale comment and three unused lint directives.

**Verification:** the whole `data` suite passes (88 files, 1,472 results, no type errors); spec and build type checks and eslint clean. New tests cover both fixes.

### [`utils/correlation-id-generator.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/utils/correlation-id-generator.ts)

**No defects** — reviewed in [issue #606](https://github.com/Terrence721/platform-main/issues/606); doc comments fixed

`CorrelationIdGenerator`, the counter behind default correlation ids (`CRID1`, `CRID2`, ...), provided once with the other base @ngrx/data providers and injected by the dispatchers.

**Docs:** the prefix doc read `'CRID;`, and the uniqueness note claimed ids were unique "for a single client browser instance", when they are unique only among one instance's ids (one per app); both are fixed.

**Correction (from the `utilities.ts` review):** this entry first said the class had no direct test and that a new `correlation-id-generator.spec.ts` closed that gap. That was wrong: `utils.spec.ts` already tested the sequence and per-instance counting, so the new spec was a duplicate and has been removed.

**Verification:** the whole `data` suite passes (90 files, 1,476 results, no type errors); build type check and eslint clean.

### [`utils/default-logger.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/utils/default-logger.ts)

**low · Correctness** — Fixed via [issue #608](https://github.com/Terrence721/platform-main/issues/608)

`DefaultLogger`, the default `Logger`, writing to the console; this review also closes coverage issue [#340](https://github.com/Terrence721/platform-main/issues/340), since every spec had replaced it with a mock.

**Bug, fixed: falsy messages and extra values were dropped.** The methods guarded with `if (message)` and `if (extra)`, so a throwaway probe showed `log('saved count', 0)` writing only the text and `log(0)` writing nothing. Now only a missing message (`null` or `undefined`) is skipped, and an extra value is written whenever it is given; the module's own calls pass error objects, so they were unaffected.

**Coverage gap, closed:** the new `default-logger.spec.ts` runs the real `error`, `log` and `warn` against spied console methods: message alone, with an extra value, falsy values, and no message.

**Verification:** the whole `data` suite passes (92 files, 1,492 results, no type errors); build type check and eslint clean.

### [`utils/default-pluralizer.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/utils/default-pluralizer.ts)

**medium · Correctness** — Fixed via [issue #610](https://github.com/Terrence721/platform-main/issues/610)

`DefaultPluralizer`, which pluralizes entity names for the HTTP URLs, from registered plural names or English rules. Both bugs were probed on the unchanged source with a throwaway spec.

**Real bug, fixed: names ending in any `h` or `c` got "-es".** The "-es" rule was the character class `/[s|ss|sh|ch|x|z]$/`, which matches single characters rather than the listed endings, so `Month`, `Path` and `Graph` became `Monthes`, `Pathes` and `Graphes`, and those became wrong collection URLs. It is now `/(?:s|sh|ch|x|z)$/`; `Buses`, `Wishes`, `Batches` and `Boxes` are unchanged. Default URLs for the affected names change to the correct plural, which an app can override by registering a plural name.

**Bug, fixed: an entity named like an `Object.prototype` member got a function as its plural**, because the registered-names lookup found the inherited member; it now reads own properties only. This closes the last `{}[entityName]` carry-over.

**Docs and tests:** irregular plurals such as `hero` → `heroes` are now documented as needing registration, and a mislabelled test name is fixed.

**Verification:** the whole `data` suite passes (92 files, 1,498 results, no type errors); build type check and eslint clean. New tests cover both fixes.

### [`utils/guid-fns.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/utils/guid-fns.ts)

**medium · Correctness** — Fixed via [issue #612](https://github.com/Terrence721/platform-main/issues/612)

`getGuid`, `getGuidComb` (a GUID ending in a 12-digit time part, for sorting) and `guidComparer`: public helpers not used by @ngrx/data itself, and untested until now.

**Bug, fixed: `getGuidComb`'s time part was short for small or zero seeds, breaking its sort order.** It padded the time with only two zeros, so any time under 10 hex digits gave a shorter GUID whose last 12 characters mixed random digits with the time; a throwaway probe showed `getGuidComb(1)` ending in random digits and `001`, so `guidComparer` compared noise. `seed || now` also ignored a seed of `0`. The time part is now always 12 digits and uses `seed ?? now`; current timestamps were unaffected.

**Docs, tests and lint:** the header's "32-character UUID" claim is corrected (28 and 29 hex characters, not standard UUIDs, from `Math.random`), `guidComparer` is documented, the new `guid-fns.spec.ts` covers formats, seeds and ordering, and four unused `no-bitwise` directives are removed.

**Verification:** the whole `data` suite passes (94 files, 1,508 results, no type errors); build type check and eslint clean.

### [`utils/interfaces.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/utils/interfaces.ts)

**low · Types** — Fixed via [issue #614](https://github.com/Terrence721/platform-main/issues/614)

The `Logger` and `Pluralizer` contracts, `EntityPluralNames` and `PLURAL_NAMES_TOKEN`. Both findings were probed with a throwaway spec.

**Fixed: `PLURAL_NAMES_TOKEN` was typed as one map but always holds an array, and a non-multi provider crashed** `DefaultPluralizer` with "pluralNames.forEach is not a function", the same two issues the metadata token had in the `entity-metadata.ts` review. The token is now typed as an array, and `DefaultPluralizer` also accepts a single map, as `EntityDefinitionService` does.

**Fixed: `DefaultLogger` dropped arguments the `Logger` contract allows.** The contract takes any number of values after the message, but the default logger wrote only one; `error('msg', 'second', 'third')` wrote `msg second`. It now passes every value through, still writing nothing without a message; this was missed in the `default-logger.ts` review. The three contracts also got doc comments.

**Verification:** the whole `data` suite passes (94 files, 1,514 results, no type errors); spec and build type checks and eslint clean. New tests cover both fixes.

### [`utils/utilities.ts`](https://github.com/Terrence721/platform-main/blob/fdf4a0b3b29c33e8cd862f3bec0a3958bf93a59d/modules/data/src/utils/utilities.ts)

**No defects** — reviewed in [issue #616](https://github.com/Terrence721/platform-main/issues/616); one coverage gap closed

`defaultSelectId`, `flattenArgs` and `toUpdateFactory`, small helpers used across the module; each behaves as documented, including falsy ids and an empty argument list.

**Coverage gap, closed:** none of the three was tested directly; `utils.spec.ts`, although titled "Utilities (utils)", only tested `CorrelationIdGenerator`, and now covers all three. The inner `toUpdate` also documented a parameter it does not have, and now documents its `entity` parameter and its error.

**Correction:** the `correlation-id-generator.ts` entry above first claimed that class was untested and added a spec for it; `utils.spec.ts` already covered it, so the duplicate spec is removed and that entry is corrected.

**This completes `data` (61 files).**

**Verification:** the whole `data` suite passes (92 files, 1,526 results, no type errors); build type check and eslint clean.

### [`configs/all-type-checked.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/configs/all-type-checked.ts)

**No defects** — reviewed in [issue #618](https://github.com/Terrence721/platform-main/issues/618); a documentation gap closed

The `all-type-checked` flat config: every @ngrx rule, including the type-aware ones. It is generated by `scripts/generate-config.ts`; regenerating all nine configs produced no diff, and it enables all 35 rules.

**Documentation gap, closed:** the config includes the four type-aware rules, which fail without type information; a throwaway probe showed ESLint throwing "You have used a rule which requires type information" when the config is used as provided. Leaving `parserOptions` to the user follows typescript-eslint's own convention, but nothing in the repo said so, since the upstream usage docs were in the excluded `www` site. The generator's template now gives each `-type-checked` config a header note with the `parserOptions` to add; the other six configs are unchanged.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 546 results, no type errors); build type check and eslint clean.

### [`configs/all.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/configs/all.ts)

**No defects** — reviewed in [issue #620](https://github.com/Terrence721/platform-main/issues/620); a test coverage gap closed

The `all` flat config: every @ngrx rule that runs without type information. It matches a fresh regeneration; its 31 rules are exactly the rules not marked `requiresTypeChecking`, and a throwaway probe linted a file with it and no `parserOptions` without a fatal error.

**Coverage gap, closed:** the only test on `all` checked that it has fewer rules than `all-type-checked`, so a type-aware rule added to it by mistake (which would crash users without type information) or a missing rule would pass. `spec/exported-rules.spec.ts` now checks that `all` holds exactly the rules without type checking and that it lints a file with no type information.

**Verification:** `spec/exported-rules.spec.ts` passes (6 tests, no type errors); eslint and Prettier clean.

### [`configs/component-store.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/configs/component-store.ts)

**No defects** — reviewed in [issue #622](https://github.com/Terrence721/platform-main/issues/622); a test coverage gap closed

The `component-store` flat config: the @ngrx/component-store rules. It matches a fresh regeneration; its 4 rules are exactly the rules under `rules/component-store/`, none of which needs type information. The generator picks rules by `meta.docs.ngrxModule`, and all 35 rules carry the module of their folder.

**Coverage gap, closed:** no test covered this config, so a rule dropped from it, or one from another module added to it, would pass. `spec/exported-rules.spec.ts` now checks that it holds exactly the `component-store` rules without type checking, as a table the other module configs can join when they are reviewed.

**Verification:** `spec/exported-rules.spec.ts` passes (7 tests, no type errors); eslint and Prettier clean.

### [`configs/effects-type-checked.ts`](https://github.com/Terrence721/platform-main/blob/9c645c85d6294d06911d3b7b892bfb149818ffd1/modules/eslint-plugin/src/configs/effects-type-checked.ts)

**No defects** — reviewed in [issue #624](https://github.com/Terrence721/platform-main/issues/624); a test coverage gap closed

The `effects-type-checked` flat config: every @ngrx/effects rule, including the two type-aware ones (`avoid-cyclic-effects`, `no-multiple-actions-in-effects`). It matches a fresh regeneration, and its 7 rules are exactly the rules under `rules/effects/`. A throwaway probe confirmed the header note added in #618: on a small project the config as provided threw "You have used a rule which requires type information", and with the note's `parserOptions` it ran and `no-multiple-actions-in-effects` reported an effect returning two actions.

**Coverage gap, closed:** no test covered this config's rules. The config table in `spec/exported-rules.spec.ts` now takes a type-checked flag and has an `effectsTypeChecked` row, which checks that it holds exactly the `effects` rules, type-aware ones included.

**Verification:** `spec/exported-rules.spec.ts` passes (8 tests, no type errors); eslint and Prettier clean.

### [`configs/effects.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/configs/effects.ts)

**No defects** — reviewed in [issue #626](https://github.com/Terrence721/platform-main/issues/626); a test coverage gap closed

The `effects` flat config: the @ngrx/effects rules that run without type information. It matches a fresh regeneration, and its 5 rules are exactly the rules under `rules/effects/` except the two type-aware ones.

**Coverage gap, closed:** no test covered this config's rules, so a type-aware rule added to it (which would crash users without type information) or a dropped rule would pass. The config table in `spec/exported-rules.spec.ts` now has an `effects` row, which checks that it holds exactly the `effects` rules without type checking.

**Verification:** `spec/exported-rules.spec.ts` passes (9 tests, no type errors); eslint and Prettier clean.

### [`configs/operators.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/configs/operators.ts)

**No defects** — reviewed in [issue #628](https://github.com/Terrence721/platform-main/issues/628); a test coverage gap closed

The `operators` flat config: the @ngrx/operators rules. It matches a fresh regeneration; its one rule, `prefer-concat-latest-from`, is the only rule under `rules/operators/` and needs no type information.

**Coverage gap, closed:** no test covered this config's rules, so a dropped rule, or one from another module added to it, would pass. The config table in `spec/exported-rules.spec.ts` now has an `operators` row, which checks that it holds exactly the `operators` rules without type checking.

**Verification:** `spec/exported-rules.spec.ts` passes (10 tests, no type errors); eslint and Prettier clean.

### [`configs/signals-type-checked.ts`](https://github.com/Terrence721/platform-main/blob/9c645c85d6294d06911d3b7b892bfb149818ffd1/modules/eslint-plugin/src/configs/signals-type-checked.ts)

**No defects** — reviewed in [issue #630](https://github.com/Terrence721/platform-main/issues/630); a test coverage gap closed

The `signals-type-checked` flat config: every @ngrx/signals rule, including the two type-aware ones (`signal-state-no-arrays-at-root-level`, `with-state-no-arrays-at-root-level`). It matches a fresh regeneration, and its 5 rules are exactly the rules under `rules/signals/`. The type-aware two only ask for type information when the argument is not a literal array, so without `parserOptions` ESLint fails only on some files; a throwaway probe showed `withState(initial)` throwing without them and reported with the header note's `parserOptions`, so the note is unchanged.

**Coverage gap, closed:** no test covered this config's rules. The config table in `spec/exported-rules.spec.ts` now has a `signalsTypeChecked` row, which checks that it holds exactly the `signals` rules, type-aware ones included.

**Verification:** `spec/exported-rules.spec.ts` passes (11 tests, no type errors); eslint and Prettier clean.

### [`configs/signals.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/configs/signals.ts)

**No defects** — reviewed in [issue #632](https://github.com/Terrence721/platform-main/issues/632); a test coverage gap closed

The `signals` flat config: the @ngrx/signals rules that run without type information. It matches a fresh regeneration, and its 3 rules are exactly the rules under `rules/signals/` except the two type-aware ones.

**Coverage gap, closed:** no test covered this config's rules, so a type-aware rule added to it (which would crash users without type information on some files) or a dropped rule would pass. The config table in `spec/exported-rules.spec.ts` now has a `signals` row, which checks that it holds exactly the `signals` rules without type checking.

**Verification:** `spec/exported-rules.spec.ts` passes (12 tests, no type errors); eslint and Prettier clean.

### [`configs/store.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/configs/store.ts)

**No defects** — reviewed in [issue #636](https://github.com/Terrence721/platform-main/issues/636); a test coverage gap closed

The `store` flat config: the @ngrx/store rules. It matches a fresh regeneration, and its 18 rules are exactly the rules under `rules/store/`; none needs type information, which is why there is no `store-type-checked` config.

**Coverage gap, closed:** no test covered this config's rules, so a dropped rule, or one from another module added to it, would pass. The config table in `spec/exported-rules.spec.ts` now has a `store` row, which checks that it holds exactly the `store` rules without type checking. With it, every one of the nine configs has its rules pinned by a test.

**Verification:** `spec/exported-rules.spec.ts` passes (13 tests, no type errors); eslint and Prettier clean.

### [`index.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/index.ts)

**1 real bug, fixed** — reviewed in [issue #639](https://github.com/Terrence721/platform-main/issues/639)

The plugin's entry point: the plugin object (`meta` from `package.json`, the rules), the nine flat configs, and the exports.

**Bug, fixed (medium, API):** the configs registered an internal plugin object under `@ngrx`, but the default export was a different object, and ESLint rejects two different objects under one plugin name. So spreading a preset and registering the default export under `@ngrx` to change a rule's options threw `Cannot redefine plugin "@ngrx"` (confirmed by a throwaway probe). The default export is now that same object, with `configs` added; the named exports are unchanged. A new test in `spec/exported-rules.spec.ts` registers the default export next to the `store` preset and checks that the severity change applies.

**Checked and fine:** `meta` reads `../package.json`, which the CommonJS build resolves to the published package's own `package.json`; `typescript-eslint` is a peer dependency. Outside this file, the build compiles `spec/utils/*` and `scripts/generate-config.ts` into the published package (follow-up #638).

**Verification:** the whole `eslint-plugin` suite passes (78 files, 560 results, no type errors); build type check, eslint and Prettier clean.

### [`rule-creator.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rule-creator.ts)

**No defects** — reviewed in [issue #641](https://github.com/Terrence721/platform-main/issues/641); a test coverage gap closed

The rule factory every rule uses (`createRule`, typescript-eslint's `RuleCreator` with the plugin's `ngrxModule` and `requiresTypeChecking` docs fields), the `NgRxRule` type, and each rule's docs URL on ngrx.io. All 35 rules take their `name` from their file name and have a `description`. Whether each ngrx.io page exists could not be checked over HTTP: the site is a single-page app that answers 200 with the same page for any path.

**Coverage gap, closed:** no test covered the docs URL, which ESLint shows to users. `spec/exported-rules.spec.ts` now checks that every exported rule's `meta.docs.url` is the ngrx.io page for its name and that it has a description.

**Verification:** `spec/exported-rules.spec.ts` passes (15 tests, no type errors); eslint and Prettier clean.

### [`rules/component-store/avoid-combining-component-store-selectors.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/component-store/avoid-combining-component-store-selectors.ts)

**2 real bugs, fixed** — reviewed in [issue #643](https://github.com/Terrence721/platform-main/issues/643)

Reports a `combineLatest` over two or more component-store `select` calls (`this.select` in a store class, or `select` on an injected store), every one after the first.

**Bug, fixed (false positive):** the injected-store selector matched any method call on the store, so `combineLatest([this.store.getA(), this.store.getB()])` was reported as combining selectors. It now requires a `select` call.

**Bug, fixed (missed case):** the object form `combineLatest({ a: select(...), b: select(...) })` was never reported, because the rule found repeats with a sibling check and property values are not siblings. Select values in an object passed to `combineLatest` are now reported after the first in their object, tracked per object so a nested `combineLatest` between them does not reset the count. A piped select is still not counted, by design.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 567 results, no type errors); new valid and invalid cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/component-store/avoid-mapping-component-store-selectors.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/component-store/avoid-mapping-component-store-selectors.ts)

**2 real bugs, fixed** — reviewed in [issue #645](https://github.com/Terrence721/platform-main/issues/645)

Reports a `map` in the `.pipe(...)` of a component-store select, since the mapping belongs in the selector.

**Bug, fixed (false positives):** in a store class the rule matched any `pipe` with a `this.select` anywhere inside it (`:has` searches the arguments too), so a select inside `switchMap` or inside `map`'s callback was reported though the piped stream was not a select.

**Bug, fixed (false positive):** on an injected store any method counted as a select, so `this.store.loadAll().pipe(map(...))` was reported (the same pattern as #643).

The piped stream itself must now be the select call; the handler's parameter is typed as the `map` call it receives. Trade-off: a select piped twice (`.pipe(...).pipe(map(...))`) is no longer caught; it was only caught through the over-broad match.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 569 results, no type errors); new valid cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/component-store/require-super-ondestroy.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/eslint-plugin/src/rules/component-store/require-super-ondestroy.ts)

**3 real bugs, fixed** — reviewed in [issue #647](https://github.com/Terrence721/platform-main/issues/647)

Reports an `ngOnDestroy` in a `ComponentStore` subclass that does not call `super.ngOnDestroy()`, without which the store's own cleanup never runs.

**Bugs, fixed (missed cases):** an aliased import (`import { ComponentStore as Store }`) was never checked, because the class check used the literal name; and an arrow-function property (`ngOnDestroy = () => { ... }`) was never checked, though it replaces the store's `ngOnDestroy` just the same.

**Bug, fixed (false positives):** the method was matched anywhere inside the class, so a nested class's own `ngOnDestroy`, and a `static ngOnDestroy`, were reported.

The rule now records the local names `ComponentStore` is imported as and matches only the class's own non-static `ngOnDestroy` members with a body.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 573 results, no type errors); new valid and invalid cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/component-store/updater-explicit-return-type.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/component-store/updater-explicit-return-type.ts)

**No code defects** — reviewed in [issue #650](https://github.com/Terrence721/platform-main/issues/650); a wrong message fixed, 1 follow-up

Reports an arrow function passed to a component-store `updater` without an explicit return type. The spec already covers `this.updater`, injected stores (property, `inject()`, constructor parameter), generic `updater<T>` and look-alike names.

**Wrong message, fixed:** the example users see never closed the `updater(` call (`this.store.updater((state, value): State => {}`); it now ends `{})`.

**Follow-up #649:** a store class extending `ComponentStore` imported under an alias without "Store" in it is missed, here and in the two selector rules, which all match the superclass name against `/Store/`.

**Verification:** the rule's spec passes (14 results, no type errors); eslint and Prettier clean.

### [`rules/effects/avoid-cyclic-effects.ts`](https://github.com/Terrence721/platform-main/blob/044dfb1e7be76f9df7a9c2fe965b4b4a292ba6e1/modules/eslint-plugin/src/rules/effects/avoid-cyclic-effects.ts)

**3 real bugs, fixed** — reviewed in [issue #652](https://github.com/Terrence721/platform-main/issues/652)

A type-aware rule: reports an effect whose output includes an action its own `ofType(...)` filters for.

**Bug, fixed (missed case, high):** functional effects (`createEffect((actions$ = inject(Actions)) => ..., { functional: true })`, NgRx's current style) were never checked, because the rule found the actions stream by an injected class member's name. No rule in the plugin handles them; each effects rule gets it in its own review.

**Bug, fixed (false positive):** a `firstPipe` flag meant to check only the effect's outer pipe was reset by any inner `pipe(...)`, so a nested `actions$.pipe(ofType(foo), take(1))` inside `switchMap` was reported as cyclic, or not, depending on whether another pipe came first.

**Bug, fixed (missed case):** a `{ dispatch: false }` object anywhere in the effect's body switched the check off (`:has` searched the body, not just the config).

The actions stream is now recognized by its type (an `Actions` class from `@ngrx/effects`), each effect's outermost `Actions` pipe is checked, and `dispatch: false` is read from `createEffect`'s second argument only.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 579 results, no type errors); 6 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/effects/no-dispatch-in-effects.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/effects/no-dispatch-in-effects.ts)

**1 real bug, fixed** — reviewed in [issue #654](https://github.com/Terrence721/platform-main/issues/654)

Reports `store.dispatch(...)` inside `createEffect`, with a suggestion that removes the call.

**Bug, fixed (missed case, high):** functional effects were never checked. Stores were found by class-member name only (a constructor parameter typed `Store`, or a property set with `inject(Store)`), so a functional effect's `store = inject(Store)` parameter, or a `const store = inject(Store)` in its body, was never reported (the same gap as #652). A bare `<name>.dispatch(...)` inside `createEffect` is now resolved to its variable, which counts when it is typed `Store` or set to `inject(Store)`, with `Store` taken from the `@ngrx/store` import (aliases work).

**Verification:** the whole `eslint-plugin` suite passes (78 files, 582 results, no type errors); 3 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/effects/no-effects-in-providers.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/effects/no-effects-in-providers.ts)

**2 real bugs, fixed** — reviewed in [issue #657](https://github.com/Terrence721/platform-main/issues/657)

Reports an effect class listed in `providers` when it is already registered as an effect, and removes the entry (auto-fix).

**Bug, fixed (high, the auto-fix broke code):** any identifier anywhere inside `providers` counted, so with `EffectsModule.forFeature([FooEffects])` in `imports`, `eslint --fix` turned `{ provide: TOKEN, useClass: FooEffects }` and `{ provide: FooEffects, useClass: Mock }` into syntax errors and `provideSomething(FooEffects)` into `provideSomething()`. Only direct entries count now.

**Missed case, fixed:** standalone registration (`providers: [provideEffects(FooEffects), FooEffects]` in `bootstrapApplication`, an app config, route providers or an NgModule) was never checked; the rule now covers it with the same fix, and a class registered both ways is reported once.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 587 results, no type errors); 5 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/effects/no-multiple-actions-in-effects.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/effects/no-multiple-actions-in-effects.ts)

**2 real bugs, fixed** — reviewed in [issue #659](https://github.com/Terrence721/platform-main/issues/659)

A type-aware rule: reports an effect whose `switchMap`/`mergeMap`/`concatMap`/`exhaustMap` returns an array, since each item is dispatched as its own action. Functional effects were already covered (it matches by position inside `createEffect`).

**Bug, fixed (missed case):** only the first top-level `return` was checked, so an array returned inside an `if` branch was never reported. Every returned value in the callback is now checked, not those of nested functions.

**Bug, fixed (false positive):** any array counted, so flattening ids (`mergeMap(() => ids)`, later collected into one action) was reported. An array now counts when its items can be actions (skipped when the item type is known and has no `type` property); readonly tuples now count too.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 590 results, no type errors); 3 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/effects/prefer-action-creator-in-of-type.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/effects/prefer-action-creator-in-of-type.ts)

**2 real bugs, fixed** — reviewed in [issue #661](https://github.com/Terrence721/platform-main/issues/661)

Reports a string passed to `ofType(...)`, where an action creator should be used.

**Bug, fixed (false positives):** any literal anywhere inside `ofType(...)` was reported, so the index in `ofType(creators[0])` and the key in `ofType(fromBooks['load'])` were flagged as strings.

**Bug, fixed (missed case):** a template-literal string (``ofType(`[Books] Load`)``) was never reported.

Each argument is now checked for the strings it can evaluate to (directly, or in a branch of a conditional or of `||`/`??`). The rule's spec was also moved from `spec/rules/store/` to `spec/rules/effects/`, next to its rule (the only misplaced spec).

**Verification:** the whole `eslint-plugin` suite passes (78 files, 592 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/effects/prefer-effect-callback-in-block-statement.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/effects/prefer-effect-callback-in-block-statement.ts)

**1 real bug, fixed** — reviewed in [issue #663](https://github.com/Terrence721/platform-main/issues/663)

Reports an effect callback with an expression body and wraps it in `{ return ... }` (auto-fix). Functional effects were already covered.

**Bug, fixed (the auto-fix broke code):** the fix stepped outside at most one pair of parentheses, so a body in two pairs (`() => ((this.actions$.pipe()))`) became `() => ({ return (...) })`, which does not parse. It now steps outside every pair around the body.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 594 results, no type errors); 2 new cases with fix output in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/effects/use-effects-lifecycle-interface.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/effects/use-effects-lifecycle-interface.ts)

**3 real bugs, fixed** — reviewed in [issue #665](https://github.com/Terrence721/platform-main/issues/665)

Reports a class with an effects lifecycle hook that does not implement the matching interface, and adds the `implements` clause and the import (auto-fix).

**Bug, fixed (the auto-fix wrote broken code):** the hook names were matched without anchors, so a method like `ngrxOnInitEffectsLegacy()` was reported with interface `undefined`, and the fix wrote `import { undefined, undefined, ... }` and `implements undefined, ...`.

**Bug, fixed (false positive):** a `static` hook-named member was reported. **Missed case, fixed:** an arrow-function property (`ngrxOnInitEffects = () => ...`) was never checked.

The name must now match exactly, and only the class's own non-static methods and properties count.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 596 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/index.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/index.ts)

**No defects** — reviewed in [issue #667](https://github.com/Terrence721/platform-main/issues/667)

The hand-maintained rule registry. Its 35 keys and 35 imports are exactly the 35 rule files. Drift is already tested: a missing rule fails the count test, and a key paired with the wrong import fails the docs-URL test from #641. One nit fixed: a section comment was missing its space (`//effects`).

**Verification:** `spec/exported-rules.spec.ts` passes; eslint and Prettier clean.

### [`rules/operators/prefer-concat-latest-from.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/operators/prefer-concat-latest-from.ts)

**2 real bugs, fixed** — reviewed in [issue #669](https://github.com/Terrence721/platform-main/issues/669)

Reports `withLatestFrom` in an effect and fixes it to `concatLatestFrom(() => ...)` (auto-fix; `strict` checks the whole effect, not just the actions pipe).

**Bug, fixed (missed case, high):** by default functional effects were never checked, because the actions stream was found by class-member name (the same gap as #652, #654). A bare `actions$` typed `Actions` or set to `inject(Actions)` now counts.

**Bug, fixed (the auto-fix changed behaviour, high):** in strict mode any second argument was treated as the deprecated projector, so `withLatestFrom(a$, b$)` became `concatLatestFrom(() => a$,), map( b$)`, and a real projector `(action, x) => ...` was moved into `map`, which passes one `[action, x]` argument (`x` undefined). An existing test locked that output in. Only single-argument calls are fixed now; the rest are reported without a fix.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 598 results, no type errors); new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/signals/enforce-type-call.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/signals/enforce-type-call.ts)

**1 real bug, fixed** — reviewed in [issue #671](https://github.com/Terrence721/platform-main/issues/671)

Reports `type<T>` from `@ngrx/signals` used without being called, and adds the `()` (auto-fix).

**Bug, fixed (missed case):** `type<T>` passed as an argument (`signalStoreFeature(type<{ state: State }>, ...)`) was never reported, because any `type<T>` whose parent is a call was skipped; it is now skipped only when it is the callee. A namespace import (`signals.type<Book>`) is now checked too.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 600 results, no type errors); 2 new cases with fix output in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/signals/prefer-protected-state.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/signals/prefer-protected-state.ts)

**1 real bug, fixed** — reviewed in [issue #673](https://github.com/Terrence721/platform-main/issues/673)

Reports `protectedState: false` in a `signalStore(...)` config, with a suggestion that removes it.

**Bug, fixed (the suggestion broke code):** when the config held only `protectedState: false`, the suggestion removed the object but not the comma after it, so `signalStore({ protectedState: false }, withState(...))` became `signalStore(, withState(...))`. The comma is removed too now. A quoted key (`'protectedState': false`) is also reported now.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 602 results, no type errors); 2 new suggestion cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/signals/signal-state-no-arrays-at-root-level.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/signals/signal-state-no-arrays-at-root-level.ts)

**2 real bugs, fixed** — reviewed in [issue #675](https://github.com/Terrence721/platform-main/issues/675)

A type-aware rule: reports `signalState(...)` given a value that is not a record (an array, a `Set`/`Map`/`Date`/..., a function).

**Bug, fixed (missed case):** the call was matched by the literal name `signalState`, so an aliased import (`state([1, 2, 3])`) or a namespace import (`signals.signalState(...)`) was never checked. Both count now, and the bare name still does.

**Bug, fixed (missed case):** a value typed `string[] | null` passed, since a union is not an array type. Each member other than `null`/`undefined` is now checked.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 605 results, no type errors); 3 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/signals/signal-store-feature-should-use-generic-type.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/signals/signal-store-feature-should-use-generic-type.ts)

**3 real bugs, fixed** — reviewed in [issue #677](https://github.com/Terrence721/platform-main/issues/677)

Reports a custom `signalStoreFeature(...)` with an input when the function creating it has no type parameter, and adds an unused `<_>` (auto-fix).

**Bug, fixed (the fix broke code):** `async () => signalStoreFeature(...)` was fixed to `<_>async () => ...`, which does not parse.

**Bug, fixed (false positive, double report):** for an arrow inside a function declaration the declaration's selector matched too, so a generic arrow's enclosing function was reported and fixed to `outer<_>`, and a non-generic arrow was reported twice with both functions fixed. **Missed case, fixed:** function expressions were never checked.

Each call is now reported once, against the nearest function around it, and `<_>` goes right before the parameter list.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 610 results, no type errors); 5 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/signals/with-state-no-arrays-at-root-level.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/signals/with-state-no-arrays-at-root-level.ts)

**2 real bugs, fixed** — reviewed in [issue #679](https://github.com/Terrence721/platform-main/issues/679)

A type-aware rule: reports `withState(...)` given a value, or a factory returning one, that is not a record. The same two gaps as its twin (#675):

**Bug, fixed (missed case):** the call was matched by the literal name `withState`, so an aliased import or a namespace import (`signals.withState(...)`) was never checked. Both count now, and the bare name still does.

**Bug, fixed (missed case):** a union (`string[] | null`, or a factory returning `string[] | undefined`) passed. Each member other than `null`/`undefined` is now checked, after unwrapping a factory.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 614 results, no type errors); 4 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/avoid-combining-selectors.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/avoid-combining-selectors.ts)

**2 real bugs, fixed** — reviewed in [issue #681](https://github.com/Terrence721/platform-main/issues/681)

Reports a `combineLatest` over two or more store selects (`store.select(...)` or `store.pipe(select(...))`), every one after the first. The store counterpart of #643.

**Bug, fixed (missed case):** the object form `combineLatest({ a: store.select(a), b: store.select(b) })` was never reported, since repeats were found with a sibling check (as in #643).

**Bug, fixed (missed case):** stores held in variables (`const store = inject(Store)` in a functional resolver or guard, or a `store = inject(Store)` parameter) were never checked; only injected class members were.

Each `combineLatest` is now checked directly (the array's items, the object's values or the arguments), and a store is `this.<injected store>` or a variable typed `Store` or set to `inject(Store)`.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 617 results, no type errors); 3 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/avoid-dispatching-multiple-actions-sequentially.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/avoid-dispatching-multiple-actions-sequentially.ts)

**2 real bugs, fixed** — reviewed in [issue #683](https://github.com/Terrence721/platform-main/issues/683)

Reports two or more `store.dispatch(...)` statements in the same block.

**Bug, fixed (missed case):** dispatches were collected in one list cleared when any block ended, so a nested block between two dispatches (`dispatch(a()); if (x) { ... } dispatch(b());`) dropped the first and the pair was never reported. Dispatches are now grouped by their own block.

**Bug, fixed (missed case):** stores held in variables (`const store = inject(Store)` in a functional initializer) were never checked, as in #681; a variable typed `Store` or set to `inject(Store)` counts now.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 619 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/avoid-duplicate-actions-in-reducer.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/avoid-duplicate-actions-in-reducer.ts)

**3 real bugs, fixed** — reviewed in [issue #685](https://github.com/Terrence721/platform-main/issues/685)

Reports an action handled by more than one `on(...)` in a `createReducer`, with a suggestion that removes the duplication.

**Bug, fixed (missed case, high):** the report loop used `break` instead of `continue`, so it stopped at the first action handled once and later duplicates were never reported.

**Bug, fixed (missed case, high):** only an identifier first argument counted, so `on(BooksActions.load, ...)` (action groups) was never checked, and neither was any action after the first in `on(a, b, reducer)`.

Every action argument of `on` (all but the reducer) now counts, by name or dotted name; the suggestion removes just that action when its `on` handles others, otherwise the whole `on(...)`.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 620 results, no type errors); a new case with both suggestion outputs in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/avoid-mapping-selectors.ts`](https://github.com/Terrence721/platform-main/blob/5df179632c6785fc1e6e634a3a8aa5b8fc6628e7/modules/eslint-plugin/src/rules/store/avoid-mapping-selectors.ts)

**2 real bugs, fixed** — reviewed in [issue #687](https://github.com/Terrence721/platform-main/issues/687)

Reports a `map` in a store-select pipe, since the mapping belongs in a selector; effects are skipped. The store counterpart of #645.

**Bug, fixed (missed case):** the whole pipe was skipped when any operator used `this`, so `takeUntil(this.destroy$)` beside a pure `map((user) => user.name)` hid it. Only the `map`'s own use of `this` exempts it now.

**Bug, fixed (missed case):** stores held in variables (`const store = inject(Store)` in a functional guard) were never checked, as in #681 and #683.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 623 results, no type errors); 3 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/good-action-hygiene.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/good-action-hygiene.ts)

**2 real bugs, fixed** — reviewed in [issue #689](https://github.com/Terrence721/platform-main/issues/689)

Reports a `createAction(...)` type that does not follow the "[Source] Event" format.

**Bug, fixed (missed case):** only single-quoted strings were checked (the selector required the raw text to start with `'`), so double-quoted and template-literal types never were.

**Bug, fixed (missed case):** the pattern was not anchored, so `'Load [Customer] Now'` and `'[] Load Customer'` passed. It now requires a non-empty `[Source]` at the start, then the event. The unused `actionCreatorWithLiteral` selector is removed.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 629 results, no type errors); 6 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/no-multiple-global-stores.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/no-multiple-global-stores.ts)

**2 real bugs, fixed** — reviewed in [issue #691](https://github.com/Terrence721/platform-main/issues/691)

Reports a class that injects the global `Store` more than once, with a suggestion that removes a reference.

**Bug, fixed (missed case, high):** injected stores were grouped by their parent node, and each `store = inject(Store)` property is its own parent, so two injected properties (or a property plus a constructor parameter) were never reported: the `inject()` style was not checked at all.

**Bug, fixed (suggestion):** for an injected property the reported, and removed, node was just its name, which would have left `= inject(Store)`.

Stores in a class are now grouped by the class, and an injected property is reported and removed as a whole.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 631 results, no type errors); 2 new cases with suggestion outputs in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/no-reducer-in-key-names.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/no-reducer-in-key-names.ts)

**2 real bugs, fixed** — reviewed in [issue #693](https://github.com/Terrence721/platform-main/issues/693)

Reports the word "reducer" in the keys of a reducer map, with a suggestion that removes it.

**Bug, fixed (missed case, high):** only an object passed as a call's first argument was checked, so the real `StoreModule.forFeature('books', { ... })` map (second argument) and the standalone `provideStore` and `provideState` were never checked.

**Bug, fixed (suggestion broke code):** a key that is only `reducer` became `{ : books }`. No suggestion is offered now when no name would be left.

The reducer-map argument of each call is checked (a `{ name, reducer }` feature slice and a `metaReducers` config are not); the unused `storeActionReducerMap` selector is removed.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 637 results, no type errors); 6 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/no-store-subscription.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/no-store-subscription.ts)

**2 real bugs, fixed** — reviewed in [issue #695](https://github.com/Terrence721/platform-main/issues/695)

Reports a `.subscribe(...)` on the global store, since the `async` pipe is preferred.

**Bug, fixed (missed case, high):** the rule reached back from `subscribe` through at most one call, so the classic `this.store.select(x).pipe(takeUntil(this.destroy$)).subscribe(...)` was never reported. The whole chain is followed back to its start now.

**Bug, fixed (missed case):** stores held in variables (`const store = inject(Store)` in a functional initializer) were never checked, as in #681, #683 and #687.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 639 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/no-typed-global-store.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/no-typed-global-store.ts)

**1 real bug, fixed** — reviewed in [issue #697](https://github.com/Terrence721/platform-main/issues/697)

Reports the global `Store` given a generic, with a suggestion that removes it.

**Bug, fixed (missed cases):** only a typed constructor parameter and `inject(Store<S>)` on a property were checked, so `inject<Store<S>>(Store)`, a typed property (`store: Store<S> = inject(Store)`) and `inject(Store<S>)` in a function were never reported. Every use of the imported `Store` in an annotation or an `inject(...)` call is checked now; other uses (`somethingElse(Store<{}>)`) stay allowed. The ngrx/platform#3950 crash guard still passes, and the rewrite no longer reads the type annotation whose absence caused it.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 642 results, no type errors); 3 new cases with suggestion outputs in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/on-function-explicit-return-type.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/on-function-explicit-return-type.ts)

**1 real bug, fixed** — reviewed in [issue #699](https://github.com/Terrence721/platform-main/issues/699)

Reports an arrow-function reducer in `on(...)` without an explicit return type, with a suggestion that adds `: State`.

**Bug, fixed (suggestion broke code):** with a trailing comma, `(state, action,) => ...` became `(state, action,: State) => ...`; the comma is skipped now to reach the closing parenthesis. The message's example also closes the `on(` call now (as in #650).

**Verification:** the whole `eslint-plugin` suite passes (78 files, 643 results, no type errors); a new case with suggestion output in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/prefer-action-creator-in-dispatch.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/prefer-action-creator-in-dispatch.ts)

**2 real bugs, fixed** — reviewed in [issue #701](https://github.com/Terrence721/platform-main/issues/701)

Reports a plain object or a `new` class instance passed to `store.dispatch(...)`.

**Bug, fixed (false positive):** every object inside the `dispatch(...)` call was checked, so an action's nested payload object (`{ type, payload: { page: 1 } }`) was reported a second time. Only the dispatched value is checked now (the argument, or the branches of a conditional or `||`/`??`, through a type assertion).

**Bug, fixed (missed case):** stores held in variables (`const store = inject(Store)` in a functional initializer) were never checked, as in #681, #683, #687 and #695.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 645 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/prefer-action-creator.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/prefer-action-creator.ts)

**1 real bug, fixed** — reviewed in [issue #703](https://github.com/Terrence721/platform-main/issues/703)

Reports a class that implements NgRx's `Action` and has a `type` property, since action creators are preferred.

**Bug, fixed (wrong class reported):** the whole class was searched for `implements Action` and a `type` property, so a service containing an action class was reported itself, and the nested action class (a class expression) never was. Each class is now checked on its own `implements` and members. An aliased `Action` import is recognized too.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 647 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/prefer-inline-action-props.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/prefer-inline-action-props.ts)

**1 real bug, fixed** — reviewed in [issue #705](https://github.com/Terrence721/platform-main/issues/705)

Reports a named type in `props<...>()`, since an inline type is preferred, with a suggestion that wraps it in `{ name: ... }`.

**Bug, fixed (missed case):** only `props<...>()` directly in `createAction(...)` was checked, so the modern `createActionGroup({ source, events: { 'Load': props<Customer>() } })` was never reported. A shared selector now covers `createActionGroup`'s events with the same type check.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 649 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/prefer-one-generic-in-create-for-feature-selector.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/prefer-one-generic-in-create-for-feature-selector.ts)

**No code defects** — reviewed in [issue #707](https://github.com/Terrence721/platform-main/issues/707); 1 missed case fixed

Reports the two-generic `createFeatureSelector<AppState, FeatureState>(...)`, with a suggestion that removes the first generic. The suggestion produced valid code in every layout probed.

**Missed case, fixed:** a namespace import (`fromStore.createFeatureSelector<...>`) was never checked; a member call now counts when its object is a namespace import of `@ngrx/store`.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 651 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/prefer-selector-in-select.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/prefer-selector-in-select.ts)

**1 real bug, fixed** — reviewed in [issue #709](https://github.com/Terrence721/platform-main/issues/709)

Reports a string or an inline function passed to the store's `select`, where a selector should be used.

**Bug, fixed (missed case):** stores held in variables (`const store = inject(Store)` in a functional resolver) were never checked, for `store.select(...)` or `store.pipe(select(...))`, as in #681 and later. A template-literal string is also reported now.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 653 results, no type errors); 2 new cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/prefix-selectors-with-select.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/prefix-selectors-with-select.ts)

**2 real bugs, fixed** — reviewed in [issue #711](https://github.com/Terrence721/platform-main/issues/711)

Reports a selector whose name does not start with `select`, with a suggestion that renames it.

**Bug, fixed (the suggestion broke code):** only the declaration was renamed, so a selector used later in the same file (the usual composition) was left pointing at a name that no longer exists. The suggestion now renames every use in the file, keeping a shorthand's key and an export's public name.

**Bug, fixed (the suggestion changed behaviour):** a shorthand destructuring (`{ allItems }` from `getSelectors`) was renamed to read a different property; it now becomes `{ allItems: selectAllItems }` (two existing expected outputs updated).

**Verification:** the whole `eslint-plugin` suite passes (78 files, 654 results, no type errors); a new case with suggestion output in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/select-style.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/select-style.ts)

**6 real defects, fixed** — reviewed in [issue #713](https://github.com/Terrence721/platform-main/issues/713)

Enforces `store.select(s)` (method mode, the default) or `store.pipe(select(s))` (operator mode), with a fix both ways.

**Bug, fixed (the fix broke code):** a `select` after another operator was moved to the front, giving a syntax error or filtering after selecting instead of before. Only a store's first operator is reported now.

**Bug, fixed (the fix broke code):** once one store used the operator, every use of the import was fixed, so `other$.pipe(select(s))` became `other$.select(s)`. Only store uses are reported, and the import goes only when all of its uses do.

**Bug, fixed (operator mode):** an aliased `select` import left the fix calling a `select` that was not in scope, and a `select` from another module got a clashing second import.

**Bug, fixed (types):** type arguments were carried across, but the operator takes `<T, K>` and the method `<K>`; such calls are reported without a fix.

**Gaps, fixed:** stores held in variables (`inject(Store)` in functional code) were never checked in either mode, an aliased import was never reported, and the method fix left stray parentheses (six existing expected outputs updated).

**Verification:** the whole `eslint-plugin` suite passes (78 files, 664 results, no type errors); new valid and invalid cases in the rule's spec; build type check, eslint and Prettier clean.

### [`rules/store/use-consistent-global-store-name.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/rules/store/use-consistent-global-store-name.ts)

**4 real defects, fixed** — reviewed in [issue #715](https://github.com/Terrence721/platform-main/issues/715)

Reports a global store not named as configured (`store` by default), with a suggestion that renames it.

**Bug, fixed (stores missed):** the loop `return`ed at the first store already named `store`, so every store after it in the file was never checked.

**Bug, fixed (the suggestion broke code):** only the declaration was renamed, leaving `this.appStore` and a parameter's uses naming something that no longer exists. Every use is renamed now (not inside a nested class), and a shorthand keeps its key.

**Bug, fixed (the suggestion broke code):** when the class already had a `store`, the suggestion declared it twice (two existing expected outputs). There is no suggestion when the new name is taken.

**Gap, fixed:** stores held in variables and parameter defaults set to `inject(Store)`, as in functional resolvers and guards, were never checked.

**Verification:** the whole `eslint-plugin` suite passes (78 files, 669 results, no type errors); new cases with suggestion output in the rule's spec; build type check, eslint and Prettier clean.

### [`utils/helper-functions/folder.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/utils/helper-functions/folder.ts)

**No defects** — reviewed in [issue #717](https://github.com/Terrence721/platform-main/issues/717)

`traverseFolder`, the recursive walk that lists the rule and config files for the config generator and `spec/exported-rules.spec.ts`. It recurses, filters by extension and yields the right folder, name and path; its order is deterministic across platforms, so regenerated configs don't reorder. Not reachable today: a `.d.ts` file would match `.ts`. Nothing tested it directly, so a spec now does.

**Verification:** the whole `eslint-plugin` suite passes (80 files, 673 results, no type errors) with the new `spec/helper-functions/folder.spec.ts`; eslint and Prettier clean.

### [`utils/helper-functions/guards.ts`](https://github.com/Terrence721/platform-main/blob/044dfb1e7be76f9df7a9c2fe965b4b4a292ba6e1/modules/eslint-plugin/src/utils/helper-functions/guards.ts)

**1 latent bug, fixed; dead code removed** — reviewed in [issue #719](https://github.com/Terrence721/platform-main/issues/719)

The AST node-type guards and the TypeScript `isTypeReference` guard.

**Bug, fixed (latent):** `isTypeReference` tested for an own `target` property, which an instantiated type alias and a mapped type also have, so it claimed `ts.TypeReference` for them. Its one caller (`avoid-cyclic-effects`) got no type arguments and returned early, so no rule misbehaved. It now checks TypeScript's `ObjectFlags.Reference`.

**Dead code removed:** `isCallExpressionWith` and its `equalTo` helper (no callers since #702), `isClassDeclaration` (none since #714) and `isThisExpression` (only used by `isCallExpressionWith`).

**Verification:** the whole `eslint-plugin` suite passes (82 files, 681 results, no type errors) with the new `spec/helper-functions/guards.spec.ts`; build type check, eslint and Prettier clean.

### [`utils/helper-functions/index.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/utils/helper-functions/index.ts)

**No defects** — reviewed in [issue #721](https://github.com/Terrence721/platform-main/issues/721)

The `helper-functions` barrel. Its four modules have no export-name clashes and no import cycle, and `rules.ts` is rightly left out: it loads every rule when imported, so exporting it would make each rule load all the others. One nit fixed: a comment now says why `rules.ts` is left out.

**Verification:** the whole `eslint-plugin` suite passes (82 files, 681 results, no type errors); build type check, eslint and Prettier clean.

### [`utils/helper-functions/ngrx-modules.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/utils/helper-functions/ngrx-modules.ts)

**No defects** — reviewed in [issue #723](https://github.com/Terrence721/platform-main/issues/723)

`NGRX_MODULE_PATHS` and the `NGRX_MODULE` type. The five package names are right, and the keys are the five rule folders the config generator takes each rule's module from; every rule's declared `ngrxModule` matches its folder. Not changed here: six already-reviewed rules spell out `'@ngrx/...'` in selectors instead of using the constant (the values are correct). Nothing checked a rule's module against its folder, so `spec/exported-rules.spec.ts` now does.

**Verification:** the whole `eslint-plugin` suite passes (82 files, 683 results, no type errors); eslint and Prettier clean.

### [`utils/helper-functions/rules.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/utils/helper-functions/rules.ts)

**No defects; dead code removed** — reviewed in [issue #725](https://github.com/Terrence721/platform-main/issues/725)

`rulesForGenerate`, the rule list `scripts/generate-config.ts` writes the configs from. Running the generator reproduces all nine checked-in configs with no content change. `configsForGenerate` and its `configsDir` had no users and are removed.

**Verification:** the generator run before and after; the whole `eslint-plugin` suite passes (82 files, 683 results, no type errors); build type check, eslint and Prettier clean.

### [`utils/helper-functions/utils.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/utils/helper-functions/utils.ts)

**5 real defects, fixed; 9 copies consolidated** — reviewed in [issue #727](https://github.com/Terrence721/platform-main/issues/727)

The shared rule helpers: import lookup and fixes, the injected `Store`/`Actions`/`ComponentStore` lookup, `getRawText`.

**Bug, fixed (rules silently off):** the injected-class lookup compared the import's variable name with `'Store'`, so `import { Store as AppStore }` (or an aliased `Actions`/`ComponentStore`) turned off the 14 rules built on it.

**Bug, fixed (a suggestion changed behaviour):** `getRawText` read only a template literal's first chunk, so `no-reducer-in-key-names` suggested ``[`foo`]`` for ``[`fooReducer${x}`]``, dropping `${x}`. A template with expressions now has no raw text.

**Bugs, fixed (low):** `getImportAddFix` joined the new import to the file's first line; `getImportRemoveFix` broke `import ngrx, { select }` (latent); the `inject(...)` check ignored which `inject` was imported.

**Consolidated:** nine rules each carried the same "variable typed `Store`/`Actions` or set to `inject(...)`" function; it is now one helper, `isVariableOfClass`. Dead `getNearestUpperNodeFrom` and `getDecoratorName` removed.

**Verification:** the whole `eslint-plugin` suite passes (84 files, 706 results, no type errors) with the new `spec/helper-functions/utils.spec.ts` and new rule cases (nine expected outputs now have the import on its own line); build type check, eslint and Prettier clean.

### [`utils/index.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/src/utils/index.ts)

**No defects** — reviewed in [issue #729](https://github.com/Terrence721/platform-main/issues/729)

The top-level `utils` barrel that 30 of the 35 rules import through. Its two re-exported barrels share no export names and have no import cycle, and only the config generator reaches past it (into `helper-functions/rules`, on purpose). No change.

**Verification:** the whole `eslint-plugin` suite passes (84 files, 706 results, no type errors).

### [`utils/selectors/index.ts`](https://github.com/Terrence721/platform-main/blob/fe0eb00f1d96110e798a0907b89ec00fb06c588a/modules/eslint-plugin/src/utils/selectors/index.ts)

**No defects; dead code removed** — reviewed in [issue #731](https://github.com/Terrence721/platform-main/issues/731)

The shared esquery selectors the rules match on. Each one in use was exercised, and four changed, while its rules were reviewed (#658, #690, #694, #706). `effectCreator`, `effectDecorator` and `propertyDefinitionWithEffectDecorator` never had a user (the last two target the removed `@Effect()` decorator) and are removed.

**Verification:** the whole `eslint-plugin` suite passes (84 files, 706 results, no type errors); build type check, eslint and Prettier clean.

## Migrations review ([#106](https://github.com/Terrence721/platform-main/issues/106))

The `migrations/` folders — the code `ng update` runs to rewrite a user's app — were outside #32. Each of the 31 files is reviewed on its own sub-issue and PR, with its module's `migration.json`.

### [`component-store/migrations/18_0_0-beta/index.ts`](https://github.com/Terrence721/platform-main/blob/044dfb1e7be76f9df7a9c2fe965b4b4a292ba6e1/modules/component-store/migrations/18_0_0-beta/index.ts)

**6 real bugs fixed, 1 gap closed** — reviewed in [issue #764](https://github.com/Terrence721/platform-main/issues/764)

Moves `tapResponse` from `@ngrx/component-store` to `@ngrx/operators`.

**Bugs, fixed (broken apps after the upgrade):** an aliased `tapResponse as tr` was not migrated, because it was matched by its local name; and the other specifiers were rebuilt from their local names, so `ComponentStore as CS` became `import { CS }` and an existing `concatLatestFrom as clf` became `import { clf, … }`. It now matches the imported name and keeps every specifier as written.

**Bugs, fixed:** a `type` modifier was dropped; an import on the last line without a line break crashed the migration (it edited one character past the end); Windows line endings left a blank line. Edits now follow the actual line break (none, LF or CRLF).

**Gap, closed:** a namespace import (`cs.tapResponse`) was skipped silently; the migration now warns. The module is also matched exactly instead of with `includes()`.

**`migration.json`:** one entry; name, version and factory path correct.

**Verification:** the migration's spec passes (17 tests, 11 new; 34 results with the typecheck pass); `nx run-many -t lint,test -p component-store` passes.

### [`entity/migrations/6_0_0/index.ts`](https://github.com/Terrence721/platform-main/blob/623ed2e13764bd545942c643c22afdb4b5ca0906/modules/entity/migrations/6_0_0/index.ts)

**2 real bugs fixed** — reviewed in [issue #766](https://github.com/Terrence721/platform-main/issues/766)

Bumps `@ngrx/entity` to `6.0.0` in `package.json`. The file only calls `updatePackage('entity')` from `schematics-core/utility/update.ts`, which the `6_0_0` migrations of effects, entity, router-store, schematics, store-devtools and store share, so the fix went there.

**Bugs, fixed:** `package.json` was always rewritten, even when the package was not listed or already on `6.0.0`; and each rewrite re-indented it to 2 spaces, dropped its final line break and turned CRLF into LF. It is now written only when a version changes, keeping the file's indentation (spaces or tabs), line endings and final line break.

**No defect:** the version logic — `dependencies` and `devDependencies`, `^`, `~` and exact versions.

**`migration.json`:** one entry; name and factory path correct. Its version "5.2" for a 6.0.0 migration is legacy numbering, noted only.

**Verification:** the migration's spec passes (8 tests, 5 new); `nx run-many -t lint,test` passes for the six modules that use `updatePackage`.

### [`eslint-plugin/migrations/22_0_0-beta_0-rename-eslint-plugin-v9-imports/index.ts`](https://github.com/Terrence721/platform-main/blob/0030609da0cf9886036977907311161171d122f9/modules/eslint-plugin/migrations/22_0_0-beta_0-rename-eslint-plugin-v9-imports/index.ts)

**1 real bug fixed** — reviewed in [issue #769](https://github.com/Terrence721/platform-main/issues/769)

Renames `@ngrx/eslint-plugin/v9` imports and requires to `@ngrx/eslint-plugin` in `.ts` and `.js` files of every module flavour.

**Bug, fixed (performance):** it used `tree.visit`, which lists every file in the workspace, all of `node_modules` included, before the callback can skip them, so a real `ng update` walked every installed package for nothing. It now walks directories itself and never enters `node_modules`, like the shared `schematics-core` visitor.

**No defect:** the root export offers the same default plugin and named `configs`, `meta` and `rules` as the old `/v9` entry, so renamed imports keep working; line endings are kept; files without the old import are left untouched.

**`migration.json`:** one entry; version and factory path correct; the package's `ng-update.migrations` points at it and the build copies it to `dist`.

**Verification:** the migration's spec passes (9 tests, 3 new; the `node_modules` case failed before the fix); `nx run-many -t lint,test -p eslint-plugin` passes.

---

_The audit is complete: all 13 modules were reviewed file by file. `store`, `entity`, `effects`, `router-store`, `store-devtools`, `component-store`, `component`, `operators`, `schematics-core`, `signals`, and `schematics` are complete — `store` found 3 real bugs (all fixed), `entity` and `effects` found none, `router-store` found 7 (all fixed) across 12/12 files, `store-devtools` found 6 (all fixed) plus 1 minor cleanup across 11/11 files, `component-store` found 1 real gap (fixed) across 4/4 files, `component` found 1 real bug plus 2 barrel-export gaps (all fixed) across 10/10 files, `operators` found 2 barrel-export gaps (fixed) across 4/4 files, `schematics-core` found 9 real bugs plus 13 barrel-export gaps (all fixed) across 16/16 files. `signals` found 14 defects (all fixed, 2 of them high severity) plus 1 barrel-export gap and 2 test-coverage gaps across 18/18 files (`index.ts` three types that exported members are made of were missing from the barrel, `with-state.ts` the types promised the prototype members of a class instance passed as the state, now a dev-mode warning also in `signalState`, `with-props.ts` the types promised members that a class instance returned as the props silently loses, now a dev-mode warning, `with-methods.ts` no findings, `with-linked-state.ts` a state slice signal returned as-is was aliased instead of linked, so writing the linked slice silently wrote its source (fixed in `isWritableSignal`), `with-hooks.ts` hooks were called without their receiver, so `this` was `undefined` in a hook written as a method (fixed, plus a new type spec), `with-feature.ts` no bug, a coverage gap closed (symbol keys and injection context), `with-computed.ts` a quadratic build fixed (the same defect also fixed in the closed `signal-state.ts`, whose "no findings" this corrects), `ts-helpers.ts` 1 type-level gap fixed (template-literal dictionaries were classified as known records), `state-source.ts` 4 real defects fixed (a quadratic `getState`, and three `watchState` registration bugs), `deep-computed.ts`, `signal-method.ts`, and `signal-state.ts` no findings, `deep-signal.ts` 1 severe real bug fixed, `signal-store-assertions.ts` a false-positive warning fixed in its callers, `signal-store-feature.ts` a parameter-name typo fixed, `signal-store-models.ts` a symbol-key type gap fixed, `signal-store.ts` a coverage gap closed). `schematics` is complete (25/25 files — `action/index.ts` the generated file had an unused import and whitespace-only lines by default, and a missing name crashed with a raw `TypeError` because the schema did not require it, both fixed, plus a coverage gap closed, `action/schema.ts` `prefix` was declared required although it has a default, plus three wrong doc comments, all fixed, `component-store/index.ts` `component` and `module` shared the alias `-m`, so `--component` also set `module` and provided the store twice in a file holding both a component and its NgModule, a missing name crashed, and the store template had a stray semicolon, all fixed, plus a vacuous test and a coverage gap fixed, `component-store/schema.ts` two wrong doc comments fixed (`flat` backwards, `component`/`module` said "declaring" for a store that is provided), types already right, `container/index.ts` the generated spec did not compile with default options (it imported `FooComponent` from `./foo.component` though Angular 22 generates `Foo` in `foo.ts`, used `spyOn` and an unimported `Store`, and declared a standalone component), `viewEncapsulation` offered `Native` and not `ShadowDom`, `project`/`prefix` shared `-p`, and a missing name crashed, all fixed, plus two weak tests tightened, `container/schema.ts` the declared `stateInterface` option did nothing and now types the store (`Store<fromStore.State>`), `testDepth` narrowed to its enum, and wrong doc comments fixed, `data/index.ts` the generated service spec failed when run (`NG0201`, it provided one factory without the rest of `@ngrx/data` or the store), and a missing name crashed, both fixed, plus three coverage gaps closed, `data/schema.ts` four wrong doc comments fixed, types already right, `effect/index.ts` with `--flat false --group` the NgModule imported a file that does not exist, a missing name wrote nameless files, the generated effects had unused imports and blank runs, and a test ran a schematic that does not exist, all fixed, `effect/schema.ts` `name` was typed required though `--root --minimal` runs without it, now optional, plus five wrong doc comments fixed, `entity/index.ts` failed in a standalone app (no NgModule to auto-register in, with an error naming an option it does not have) and a missing name crashed, both fixed, `entity/schema.ts` seven doc comments fixed, types already right, the hidden `feature` option recorded as having no effect, `feature/index.ts` `--entity` with `--api` or `--prefix` generated effects referencing actions the entity file does not declare (`TS2339`), fixed, plus the reducer schematic's broken nested-and-grouped import and standalone-app failure confirmed and left to its review, `feature/schema.ts` two undocumented options documented and five descriptions fixed, types already right, `ng-add/index.ts` running it again listed `@ngrx/schematics` twice in `angular.json`, fixed, `ng-add/schema.ts` an empty interface still flagged by `no-empty-object-type` behind a disable comment for the deprecated `no-empty-interface`, replaced with `Record<string, never>`, `ngrx-push-migration/index.ts` high severity: it imported the removed `PushModule` (`TS2305` in every migrated NgModule), left standalone components without `PushPipe`, and its regex rewrote `a || asyncValue` and `| asyncDate`, all fixed, `ngrx-push-migration/schema.ts` the same empty-interface lint warning as `ng-add/schema.ts`, fixed, `reducer/index.ts` a plain `ng generate reducer` did not compile (`TS2307`, an unconditional actions import), nested-and-grouped registrations imported a path that does not exist (a `schematics-core` path helper now takes the real path), and it failed in standalone apps, all fixed, plus the `name`/`prefix` schema gaps, `reducer/schema.ts` nine doc comments fixed, types already right, `selector/index.ts` without `--feature` the output was two unused imports and a spec whose test did nothing (now a real `createFeatureSelector` and a real test, the repo owner's choice), and a missing name wrote nameless files, both fixed, `selector/schema.ts` the now-required `name` had no prompt, so interactive `ng generate` failed instead of asking, plus three doc comments, fixed, `store/index.ts` failed in standalone apps, its state file imported three unused names, and three tests could not catch what they described, all fixed, `store/schema.ts` `name` typed required though `--root` runs without it, `flat`/`skipTests` documented as having no effect, `statePath` given a description, and the rest of the docs fixed, `src/index.ts` the empty package entry point documented as such, and the published `types` field that points at nothing tracked in #478 with the build bug behind it). `data` is complete (61/61: `actions/entity-action-factory.ts` a throw test that never reached the check it named, fixed, `actions/entity-action-guard.ts` a garbled and two context-free error messages, and `TypeError` crashes on malformed payloads, fixed, `actions/entity-action-operators.ts` `ofEntityType(undefined)` selected the non-entity actions instead of the entity ones, fixed, plus a coverage gap, `actions/entity-action.ts` types only, one undocumented option documented, `actions/entity-cache-action.ts` `SaveEntities` wrote the tag onto the caller's change set, so a second save kept the old tag and a frozen change set threw, fixed, `actions/entity-cache-change-set.ts` deleting the entity with key `0` was silently dropped from a save, and `update()` rejected entities not keyed on `id`, both fixed, `actions/entity-op.ts` no defect, the success/error op pairing it relies on is now checked by a spec, `actions/merge-strategy.ts` no findings, `actions/update-response-data.ts` no defects, a doc typo, `dataservices/data-service-error.ts` a missing error crashed the constructor, and HTTP errors with an object body got an empty message, both fixed, `dataservices/default-data-service-config.ts` no defects, two doc comments, `dataservices/default-data.service.ts` `getWithQuery` dropped its queryParams whenever `httpParams` was given, and GETs timed out ignoring `getDelay`, both fixed, keys now URL-encoded, `dataservices/entity-cache-data.service.ts` a timeout escaped the error handler, fixed, and the real service got its first tests, `dataservices/entity-data.service.ts` entity names like `constructor` returned built-in functions, and batch registration did not trim names, both fixed, `dataservices/http-url-generator.ts` the configured root was lowercased with the entity name, and prototype-named entities got `undefined` URLs, both fixed, `dataservices/interfaces.ts` no defects, stale doc comments, `dataservices/persistence-result-handler.service.ts` no defects, its error-wrapping branch got its first test, `dispatchers/entity-cache-dispatcher.ts` a save with correlation id `0` could not be canceled, and the class held a subscription it never released, both fixed, `dispatchers/entity-commands.ts` no defects, doc comments that contradicted the implementation, `dispatchers/entity-dispatcher-base.ts` `loadWithQuery` merged instead of replacing the collection, now replaces, and dropped options and a rejected correlation id of `0`, fixed, `dispatchers/entity-dispatcher-default-options.ts` no defects, a misleading doc comment, `dispatchers/entity-dispatcher-factory.ts` `ngOnDestroy` did not release the scanned actions, fixed, and the factory got its first spec, `dispatchers/entity-dispatcher.ts` `PersistenceCanceled` now extends `Error`, `effects/entity-cache-effects.ts` an optimistic save answered with no content never reported success, fixed, `effects/entity-effects-scheduler.ts` no defects, a dead link, `effects/entity-effects.ts` no defects, documentation and a test helper that did not type-check, `entity-data-config.ts` `initialEntityCacheState` was silently ignored, fixed, `entity-data-without-effects.module.ts` no defects, `forRoot` got its first test, `entity-data.module.ts` no code defect, its doc now says @ngrx/effects must be set up (without it, nothing reaches the server), `entity-metadata/entity-definition.service.ts` entity names like `constructor` returned built-in functions, and batch registration did not trim names, both fixed, `entity-metadata/entity-definition.ts` it modified the caller's metadata (and threw on frozen metadata), fixed, `entity-metadata/entity-filters.ts` a global RegExp skipped matches, an invalid search string threw, and missing props matched "undefined", all fixed, `entity-metadata/entity-metadata.ts` an extra collection-state key named like a built-in one corrupted the collection, the token was mistyped, and a non-multi provider crashed, all fixed, `entity-services/entity-collection-service-base.ts` four commands dropped their options and a partial `add` failed type checking, fixed, `entity-services/entity-collection-service-elements-factory.ts` no defects; per-entity dispatcher options now covered by a spec, `entity-services/entity-collection-service-factory.ts` custom selectors$ lost their type (came back `any`), fixed, `entity-services/entity-collection-service.ts` custom selectors$ were offered on the service but undefined, and `createEntityAction` was typed by the entity, both fixed, `entity-services/entity-services-base.ts` an entity named "constructor" got `Object` back and untrimmed names made duplicate services, both fixed, `entity-services/entity-services-elements.ts` the root store was documented as scoped to the cache, fixed (type follow-up #571), `entity-services/entity-services.ts` the contract could not register a service under a name, fixed, `index.ts` `ENTITY_EFFECTS_SCHEDULER` was not public, fixed, `provide-entity-data.ts` meta-reducers provided directly were silently dropped, fixed, `reducers/constants.ts` a custom cache name provided before `provideEntityData` was ignored, fixed, `reducers/entity-cache-reducer.ts` a reducer error stopped the store under NgRx's default runtime checks, fixed, `reducers/entity-cache.ts` no defects; documented that a collection can be missing, `reducers/entity-change-tracker-base.ts` preserve-changes merges updated only the first tracked entity, and a keyless saved change lost its tracking, both fixed, `reducers/entity-change-tracker.ts` no defects; doc comments fixed, `reducers/entity-collection-creator.ts` no defects; weak tests tightened, a coverage gap closed, `reducers/entity-collection-reducer-methods.ts` a batch delete with one unsaved entity skipped the server delete for all, and deleting unsaved entities failed on frozen actions, both fixed, `reducers/entity-collection-reducer-registry.ts` a padded name replaced a custom reducer, and "constructor" got `Object` as its reducer, both fixed, `reducers/entity-collection-reducer.ts` an op named like an `Object.prototype` member corrupted the collection, fixed, `reducers/entity-collection.ts` no defects; doc comments that contradicted the reducers fixed, `selectors/entity-cache-selector.ts` no defects; custom-name coverage and docs added, `selectors/entity-selectors$.ts` `errors$` replayed an old error to new subscribers, fixed, `selectors/entity-selectors.ts` an extra state key could replace a built-in selector, and "constructor" selectors crashed, both fixed, `utils/correlation-id-generator.ts` no defects; docs fixed, `utils/default-logger.ts` falsy messages and extra values were dropped, fixed (closes #340), `utils/default-pluralizer.ts` names ending in any h or c got "-es", and "constructor" got a function as its plural, both fixed, `utils/guid-fns.ts` `getGuidComb`'s time part was short for small seeds, breaking its sort, fixed, `utils/interfaces.ts` the plural names token was mistyped and crashed without multi, and the default logger dropped arguments, both fixed, `utils/utilities.ts` no defects; helpers now tested); `eslint-plugin` is complete (55/55: `configs/all-type-checked.ts` no defects; type-information requirement documented, `configs/all.ts` no defects; exact-rules test added, `configs/component-store.ts` no defects; exact-rules test added, `configs/effects-type-checked.ts` no defects; exact-rules test added, header note confirmed, `configs/effects.ts` no defects; exact-rules test added, `configs/operators.ts` no defects; exact-rules test added, `configs/signals-type-checked.ts` no defects; exact-rules test added, header note confirmed, `configs/signals.ts` no defects; exact-rules test added, `configs/store.ts` no defects; exact-rules test added, all nine configs now pinned, `index.ts` the default export could not be registered next to a preset (ESLint "Cannot redefine plugin"), fixed, `rule-creator.ts` no defects; docs-URL test added, `rules/component-store/avoid-combining-component-store-selectors.ts` any injected-store method counted as a select, and the object form of `combineLatest` was never reported, both fixed, `rules/component-store/avoid-mapping-component-store-selectors.ts` a select inside an operator's callback, and any injected-store method, counted as a mapped selector, both fixed, `rules/component-store/require-super-ondestroy.ts` aliased imports and arrow-function properties were never checked, and nested-class and static members were reported, all fixed, `rules/component-store/updater-explicit-return-type.ts` no code defects; its message's example fixed, aliased store classes follow-up #649, `rules/effects/avoid-cyclic-effects.ts` functional effects were never checked, nested Actions pipes were checked inconsistently, and a `dispatch: false` object in the body disabled the check, all fixed, `rules/effects/no-dispatch-in-effects.ts` functional effects were never checked, fixed, `rules/effects/no-effects-in-providers.ts` the auto-fix removed identifiers from inside provider objects and calls, breaking code, and standalone `provideEffects` was never checked, both fixed, `rules/effects/no-multiple-actions-in-effects.ts` only the first top-level return was checked, and arrays of non-actions were reported, both fixed, `rules/effects/prefer-action-creator-in-of-type.ts` literals used as an index or key were reported, and template-literal strings were missed, both fixed, `rules/effects/prefer-effect-callback-in-block-statement.ts` the auto-fix broke a body in more than one pair of parentheses, fixed, `rules/effects/use-effects-lifecycle-interface.ts` look-alike names made the fix write `implements undefined`, static members were reported, and arrow properties were missed, all fixed, `rules/index.ts` no defects; the registry matches the rule files, `rules/operators/prefer-concat-latest-from.ts` functional effects were never checked, and strict mode rewrote multi-source and projector calls wrongly, both fixed, `rules/signals/enforce-type-call.ts` an uncalled `type<T>` passed as an argument was missed, fixed (namespace imports too), `rules/signals/prefer-protected-state.ts` the suggestion left `signalStore(, ...)` when features followed the config, fixed, `rules/signals/signal-state-no-arrays-at-root-level.ts` aliased and namespace imports, and union-typed values, were never checked, both fixed, `rules/signals/signal-store-feature-should-use-generic-type.ts` the fix broke async arrows, arrows inside functions were reported twice or against the wrong function, and function expressions were missed, all fixed, `rules/signals/with-state-no-arrays-at-root-level.ts` aliased and namespace imports, and union-typed values, were never checked, both fixed (as in its twin), `rules/store/avoid-combining-selectors.ts` the object form of `combineLatest`, and stores held in variables, were never checked, both fixed, `rules/store/avoid-dispatching-multiple-actions-sequentially.ts` a nested block between two dispatches hid them, and stores held in variables were never checked, both fixed, `rules/store/avoid-duplicate-actions-in-reducer.ts` a `break` stopped at the first non-duplicate, and action-group members and later `on` arguments were never checked, all fixed, `rules/store/avoid-mapping-selectors.ts` any operator using `this` hid the map, and stores held in variables were never checked, both fixed, `rules/store/good-action-hygiene.ts` only single-quoted types were checked, and the pattern was not anchored, both fixed, `rules/store/no-multiple-global-stores.ts` injected `inject(Store)` properties were never grouped, and the suggestion removed only the property name, both fixed, `rules/store/no-reducer-in-key-names.ts` the real `forFeature` map and `provideStore`/`provideState` were never checked, and a bare `reducer` key got a broken suggestion, both fixed, `rules/store/no-store-subscription.ts` a subscription more than one call after the store, and stores held in variables, were never reported, both fixed, `rules/store/no-typed-global-store.ts` a generic on `inject`, a typed property and a store in a function were never reported, fixed, `rules/store/on-function-explicit-return-type.ts` the suggestion broke a trailing-comma parameter list, fixed, and its message example fixed, `rules/store/prefer-action-creator-in-dispatch.ts` a nested payload object was reported too, and stores held in variables were never checked, both fixed, `rules/store/prefer-action-creator.ts` a class containing an action class was reported instead of it, fixed (aliased `Action` too), `rules/store/prefer-inline-action-props.ts` `createActionGroup` events were never checked, fixed, `rules/store/prefer-one-generic-in-create-for-feature-selector.ts` no code defects; a namespace import is checked now, `rules/store/prefer-selector-in-select.ts` stores held in variables were never checked, fixed (template strings too), `rules/store/prefix-selectors-with-select.ts` the rename suggestion left uses of the old name behind and changed shorthand destructurings, both fixed, `rules/store/select-style.ts` the fix moved a later `select` to the front, rewrote non-store observables, ignored aliases and type arguments, and missed stores held in variables, all fixed, `rules/store/use-consistent-global-store-name.ts` stopped at the first well-named store, renamed only the declaration, could declare `store` twice, and missed stores held in variables, all fixed, `utils/helper-functions/folder.ts` no defects; a direct spec added, `utils/helper-functions/guards.ts` `isTypeReference` accepted type aliases and mapped types (latent, fixed), and four unused guards removed, `utils/helper-functions/index.ts` no defects; a comment now says why `rules.ts` is left out, `utils/helper-functions/ngrx-modules.ts` no defects; a test now checks each rule declares its folder's module, `utils/helper-functions/rules.ts` no defects (the generator reproduces the configs), unused `configsForGenerate` removed, `utils/helper-functions/utils.ts` an aliased `Store`/`Actions`/`ComponentStore` import turned off 14 rules, template keys lost their expressions, and the import fixes joined or broke lines, all fixed; the store-variable helper copied into nine rules is now one, `utils/index.ts` no defects, `utils/selectors/index.ts` no defects, three unused `@Effect`-era selectors removed). See [todo.md](../todo.md) for the per-file tables and the follow-ups still open._
