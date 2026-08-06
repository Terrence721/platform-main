# ⚙️ Senior Frontend Engineering Demonstration

[![Quality](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml)
[![CodeQL](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml)

Last updated: August 6, 2026

This repository is a personal demonstration workspace: real, MIT-licensed NgRx source ported module by module, with specific pieces **redesigned by choice** — not copied verbatim — where the goal is to show a defensible, different architectural call instead of reproducing an existing one.

This repo is **not affiliated with, and not published by, the upstream [@ngrx/platform](https://github.com/ngrx/platform) project.** See [LICENSE](./LICENSE) for why the original copyright notice is still intact despite that.

## 🧭 Start Here

- **[`todo.md`](todo.md)** — the phase-by-phase log of everything done and everything still open. This is the source of truth for progress.
- **[GitHub Project board](https://github.com/users/Terrence721/projects/2)** — a lighter-weight, at-a-glance view of the same work, kept in sync with `todo.md`.
- **[`docs/architecture.md`](docs/architecture.md)** — the reasoning behind this repo's architectural decisions (context, alternatives, what each one actually cost), not just what changed.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development setup, testing commands, commit conventions.

## 🧭 Why This Matters

Anyone can `cp -r` a well-known open-source library. The more useful exercise — and the point of this repo — is knowing _which_ parts of a mature codebase to leave alone and _which_ to challenge.

**Porting real source where fidelity matters.** `modules/store`'s implementation, tests, and schematics are the actual ngrx source, adapted where necessary (package metadata, build tooling, editor config) and left alone everywhere else. It's a large, battle-tested surface; rewriting it for its own sake would trade correctness for no real benefit.

**Redesigning where the tradeoff earns naming out loud.** Five of the real ngrx `store` classes — `Store`, `ActionsSubject`, `ReducerManager`, `State`, `ScannedActionsSubject` — extend RxJS's `Observable`/`Subject` types directly. That's a real Interface Segregation violation, not a style nitpick: it hands every consumer the entire RxJS operator surface (`pipe`, `lift`, `toPromise`, ...) when each class's actual contract is much narrower. Finding them wasn't a one-pass job — the first sweep caught the three obvious ones; a second pass, re-running the same check after the first landed, caught two more; a third pass audited every `extends` in every file in the module, not only the classes already under suspicion, to confirm none were missed. This repo replaces each one with composition, one class at a time, fully verified before moving to the next, with the reasoning — and what was left alone on purpose, like the DI-token classes that don't have this problem — recorded in `docs/architecture.md` and the commit that makes each change. The discipline generalizes past this one module: re-auditing the whole surface instead of trusting the first pass is the approach this repo applies wherever fidelity to the real source isn't the point.

## 🏗 What's Here So Far

An [Nx](https://nx.dev/) workspace (`modules/` for libraries, `projects/` for apps — none ported yet), using yarn, Vitest, and ESLint's flat config.

```text
modules/
  store/              ← added (real source); 5 classes redesigned to
                         composition over inheritance, see docs/architecture.md
  schematics-core/     ← added (real source), shared schematic/AST utilities
  entity/              ← added (real source); audited clean, no RxJS-extending
                         classes to redesign
```

10 more modules (`effects`, `router-store`, `store-devtools`, `data`, `operators`, `component-store`, `signals`, `component`, `eslint-plugin`, `schematics`) come next — see `todo.md`'s "Still to do" table for sequencing and why.

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

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more, including the commit-message convention this repo's history follows.

## License

MIT — see [LICENSE](./LICENSE).
