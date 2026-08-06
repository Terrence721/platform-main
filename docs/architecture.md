# Architecture Decisions

Last updated: August 6, 2026

This document records the architectural decisions made in this repo that deviate from the real ngrx/platform source — not a general description of how NgRx works. For what was ported verbatim vs. redesigned, and why, see the [README](../README.md#-why-this-matters). For the phase-by-phase build log, see [todo.md](../todo.md).

## Composition over inheritance: `Store`, `ActionsSubject`, `ReducerManager`

**Status:** Done — [`99612ab`](https://github.com/Terrence721/platform-main/commit/99612ab) (`ActionsSubject`), [`7c200db`](https://github.com/Terrence721/platform-main/commit/7c200db) (`ReducerManager`), [`374e658`](https://github.com/Terrence721/platform-main/commit/374e658) (`Store`).

### Context

The real ngrx/platform `Store`, `ActionsSubject`, and `ReducerManager` extend RxJS's `Observable`/`BehaviorSubject`/`Subject` types directly:

```ts
export class Store<T = object> extends Observable<T> implements Observer<Action> { ... }
export class ActionsSubject extends BehaviorSubject<Action> implements OnDestroy { ... }
export class ReducerManager extends BehaviorSubject<ActionReducer<any, any>> implements OnDestroy { ... }
```

Each of these classes has a narrow, specific job — `Store` dispatches actions and exposes selectable state; `ActionsSubject` is an internal action bus; `ReducerManager` tracks the combined reducer and reacts to feature (un)registration. Extending an RxJS type hands the class the _entire_ Observable/Subject operator surface as a side effect of inheritance — `pipe`, `lift`, `toPromise`, `forEach`, `asObservable`, and everything else — regardless of whether that surface is part of the class's actual contract. `Store` even had to override `lift()` for no functional reason of its own: RxJS's internal operator-chaining machinery calls `lift()` on the source object when you `.pipe()` a subclassed Observable, and without the override it would silently hand back a plain `Observable` instead of a `Store`, breaking every subsequent method call in the chain. That override existing at all is a symptom of the design, not a feature of it.

### Decision

Each of the three classes now **composes** an RxJS subject internally — holds it as a private field — instead of extending one:

- `ActionsSubject` holds a private `BehaviorSubject<Action>`. Its public surface is hand-picked to match what an action bus actually needs: `next()` (with the same runtime validation as before), `subscribe()`, `error()`, `complete()`, `asObservable()`, `ngOnDestroy()`. No `pipe`, no `lift`, not an `instanceof Observable`.
- `ReducerManager` holds a private `BehaviorSubject<ActionReducer>`, exposed via a new `asObservable()` method. The codebase already had a separate `ReducerObservable` DI token for consumers that need the Observable view (used by `state.ts`, `store_module.ts`, `provide_store.ts`) — its provider wiring changed from `{ provide: ReducerObservable, useExisting: ReducerManager }` to a factory calling `.asObservable()`, so none of those three consumers needed to change at all.
- `Store` holds the injected `StateObservable` as a private field, exposed publicly as `state$: Observable<T>`. `select()` keeps its full overload set (including the deprecated props-based variants) and now derives from `state$` instead of `this`. `selectSignal()` is unaffected — it never depended on Store being an Observable.

Unlike the other two, the `Store` change **removes capability**, not just relocates it: `Store` no longer implements RxJS's `Observer<Action>` interface, so `next()`, `error()`, `complete()`, `subscribe()`, and `pipe()` are gone from its public surface entirely. A caller that wants the raw state stream uses `store.state$` directly; there is no equivalent for "pass `store` itself to `.subscribe()` as a dispatch sink," a capability the real ngrx `Store` has purely as a side effect of extending `Observable`/implementing `Observer`, not as a documented, load-bearing feature.

### Why this is the right call, not just a different one

- **It's a real Interface Segregation Principle violation, not a style preference.** Every consumer of `Store` — every component, every effect, every test — depends on the entire RxJS Observable/Subject contract whether it uses it or not. ISP says clients shouldn't be forced to depend on interfaces they don't use; extending `Observable` for a `dispatch()`/`select()` API is exactly that.
- **The `lift()` override is direct evidence the fit was wrong.** A class that has to special-case its own base class's internal machinery just to keep its own subclass identity intact through a `.pipe()` call is fighting its own design, not benefiting from it.
- **Composition doesn't cost real functionality.** Every actual use in this codebase — dispatch, select, selectSignal, subscribe to the action bus, subscribe to the reducer stream — has an equally direct replacement (`state$`, `asObservable()`) that doesn't require inheriting from RxJS at all.
- **It's the kind of call a senior review would flag.** This is precisely the class of finding — "why does this class extend a library type it only partially needs" — that shows up in real architecture reviews of mature codebases, which is the point of redesigning it here rather than porting it unmodified like the rest of `store/src`.

### What it actually cost

- **`Store` losing the Observer interface is a real, deliberate behavior change**, not free. Two tests were deleted outright rather than adapted, because the capability they tested (`store.next()`/`store.error()` forwarding to the dispatcher, `result instanceof Store` after piping) no longer exists to test. Two more were trimmed to their still-valid half (`ActionsSubject`'s own "not completable" behavior, tested directly rather than through `Store`).
- **~40 call sites needed rewriting** across 6 spec files (`store.pipe(select(x))` → `store.select(x)`; `store.pipe(<other operator>)` → `store.state$.pipe(<operator>)`), split between the ergonomic method form and the standalone pipeable `select()` operator form (kept distinct on purpose — collapsing the "as operator" tests into `.select()` calls would have made them redundant with the adjacent "as property" tests instead of testing what they were written to test).
- **The build caught a ripple grep missed**: `MockStore`'s constructor already had its own private `state$: MockState<T>` field, which collided with `Store`'s new public `state$` once `MockStore extends Store` inherited it (TypeScript won't let a subclass narrow an inherited member's visibility). Renamed to `mockState$` — an internal-only name change, no public API impact on `MockStore` itself.

### Consequences going forward

`entity`, `effects`, `router-store`, `store-devtools`, and `data` — all still unported as of this writing — consume `Store`/`ActionsSubject`/`ReducerManager` directly. This redesign was deliberately finished, end to end, _before_ porting any of them, specifically so their own ports target the final shape once rather than needing a second pass. Anything in their source that relied on `Store extends Observable` (unlikely, but not yet verified) will surface as a build/test failure when each is ported, the same way this redesign's own blast radius did — checked via the same discipline: grep first, verify with the real build/test/lint, fix what grep missed.
