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

_More findings are appended here as each file's PR merges. Review of the `entity` module is in progress — see [todo.md](../todo.md) for the full per-file table._
