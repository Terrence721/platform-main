**[→ Read the one-page portfolio](https://terrence721.github.io/platform-main/portfolio.html)** — the 60-second version, with links back into this repo for anyone who wants to go deeper.

# ⚙️ Principal Frontend Engineering Demonstration

[![Quality](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml)
[![CodeQL](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml)

Last updated: August 12, 2026

This repository is a personal demonstration workspace: real, MIT-licensed NgRx source added module by module, with specific pieces **redesigned by choice** — not copied verbatim — where the goal is to show a defensible, different architectural call instead of reproducing an existing one.

This repo is **not affiliated with, and not published by, the upstream [@ngrx/platform](https://github.com/ngrx/platform) project.** See [LICENSE](./LICENSE) for why the original copyright notice is still intact despite that.

## 🧭 Start Here

- **[`todo.md`](todo.md)** — the phase-by-phase log of everything done and everything still open. This is the source of truth for progress.
- **[GitHub Project board](https://github.com/users/Terrence721/projects/2)** — a lighter-weight, at-a-glance view of the same work, kept in sync with `todo.md`.
- **[`docs/architecture.md`](docs/architecture.md)** — the reasoning behind this repo's architectural decisions (context, alternatives, what each one actually cost), not just what changed.
- **[`docs/case-study.md`](docs/case-study.md)** — problem, constraints, tradeoffs, and results, for anyone scanning this repo as a portfolio piece rather than reading it as documentation.
- **[Module Dependency Graph](https://terrence721.github.io/platform-main/diagrams/module-dependency-graph.html)** — the 13 modules and their 3 real dependency tiers, read from every `peerDependencies` field
- **[Composition Over Inheritance](https://terrence721.github.io/platform-main/diagrams/composition-over-inheritance.html)** — before/after for all 6 classes redesigned off RxJS inheritance, and what each change actually cost
- **[Code-Review Audit Pipeline](https://terrence721.github.io/platform-main/diagrams/code-review-audit-pipeline.html)** — the per-file table → issue → PR → merge process, plus live per-module status
- **[Effects Runtime Data Flow](https://terrence721.github.io/platform-main/diagrams/effects-runtime-data-flow.html)** — the startup ordering `EffectsRootModule` depends on, and why getting it wrong would fail silently
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development setup, testing commands, commit conventions.

On AI-assisted development: Commits co-authored as Claude are AI-assisted implementations directed, reviewed, and merged by Terrence Daniels — same process as every other change, documented in docs/code-review.md.

## 🧭 Why This Matters

Anyone can `cp -r` a well-known open-source library. The more useful exercise — and the point of this repo — is knowing _which_ parts of a mature codebase to leave alone and _which_ to challenge.

**Adding real source where fidelity matters.** Every added module's implementation, tests, and schematics are the actual ngrx source, adapted where necessary (package metadata, build tooling, editor config) and left alone everywhere else. It's a large, battle-tested surface; rewriting it for its own sake would trade correctness for no real benefit.

**Redesigning where the tradeoff earns naming out loud.** Six real ngrx classes across `store` and `effects` — `Store`, `ActionsSubject`, `ReducerManager`, `State`, `ScannedActionsSubject`, `EffectSources` — extend RxJS's `Observable`/`Subject` types directly. That's a real Interface Segregation violation, not a style nitpick: it hands every consumer the entire RxJS operator surface (`pipe`, `lift`, `toPromise`, ...) when each class's actual contract is much narrower. Finding them wasn't a one-pass job — the first sweep caught the three obvious ones; a second pass, re-running the same check after the first landed, caught two more; a third pass audited every `extends` in every file in the module, not only the classes already under suspicion, to confirm none were missed. This repo replaces each one with composition, one class at a time, fully verified before moving to the next, with the reasoning — and what was left alone on purpose, like the DI-token classes that don't have this problem — recorded in `docs/architecture.md` and the commit that makes each change. The discipline generalizes past this one module: re-auditing the whole surface instead of trusting the first pass is the approach this repo applies wherever fidelity to the real source isn't the point.

## 🏗 What's Here So Far

An [Nx](https://nx.dev/) workspace (`modules/` for libraries, `projects/` for apps — none added yet), using yarn, Vitest, and ESLint's flat config.

```text
modules/
  store/              ← added (real source); 5 classes redesigned to
                         composition over inheritance, see docs/architecture.md
  schematics-core/     ← added (real source), shared schematic/AST utilities
  entity/              ← added (real source); audited clean, no RxJS-extending
                         classes to redesign
  effects/             ← added (real source); EffectSources redesigned to
                         composition
  operators/            ← added (real source); pure functions, audited clean
  router-store/         ← added (real source); audited clean, adapted 3 call
                           sites in production code + specs to the composed
                           Store/ActionsSubject surface (state$/asObservable())
  store-devtools/       ← added (real source); 1 legitimate DI-token extends
                           reviewed clean, same composition ripple adapted,
                           plus a StateObservable-specific fix
  data/                 ← added (real source); largest module yet, audited
                           clean, found and fixed 2 real upstream bugs plus
                           the composition ripple in a third shape
  component-store/      ← added (real source); no @ngrx/store dependency,
                           audited clean, fixed a real TS strictness gap
  schematics/            ← added (real source); also consolidates all 8
                           other modules' ng-add schematic into one shared
                           package (module-qualified keys) instead of 8
                           duplicated copies — a deliberate DRY-over-fidelity
                           tradeoff, see docs/architecture.md
  signals/               ← added (real source); no @ngrx/store dependency,
                           audited clean; first module added the corrected
                           way from the start, ng-add went straight into the
                           shared schematics package
  component/              ← added (real source); LetDirective/PushPipe, no
                           @ngrx/store dependency, audited clean
  eslint-plugin/           ← added (real source); 27 lint rules + configs,
                           13th and last module — all module additions
                           complete
```

All 13 modules are added. A per-module code review audit is now in progress (`store` complete — 3 real bugs found and fixed; `entity` complete — 0 real bugs found; `effects` complete — 0 real bugs found; `router-store` in progress — 10/12 files reviewed, 7 real bugs found and fixed, see [`docs/code-review.md`](docs/code-review.md)). See `todo.md`'s "Still to do" table for what's left (9 modules' review remaining after `router-store`, plus the deferred `migrations/`-folder pass, tooling migration, containerization).

## 🖥 Getting Started

```shell
yarn install
yarn nx report
```

```shell
yarn lint    # ESLint across all projects
yarn test    # Vitest across all projects
yarn build   # ng-packagr build across all projects
```

The full-suite [HTML test report](https://terrence721.github.io/platform-main/) is deployed to GitHub Pages on every push to `main` (grows as more modules and test cases are added) — or see the [at-a-glance summary](https://terrence721.github.io/platform-main/summary.html) for just the pass/fail/slow breakdown. To generate either locally instead, run `yarn build && yarn test:report && yarn test:summary`, then `yarn test:report:view` to serve and open them.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more, including the commit-message convention this repo's history follows.

## License

MIT — see [LICENSE](./LICENSE).
