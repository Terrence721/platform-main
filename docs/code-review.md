# Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: August 29, 2026** (`component-store` module complete)

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

_More findings are appended here as each file's PR merges. `store`, `entity`, `effects`, `router-store`, `store-devtools`, and `component-store` are complete — `store` found 3 real bugs (all fixed), `entity` and `effects` found none, `router-store` found 7 (all fixed) across 12/12 files, `store-devtools` found 6 (all fixed) plus 1 minor cleanup across 11/11 files, `component-store` found 1 real gap (fixed) across 4/4 files. `component` is in progress. See [todo.md](../todo.md) for the live per-module status of the remaining modules._
