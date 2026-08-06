# platform-main — NgRx Internals, Rebuilt Under Review

[![Quality](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml)
[![CodeQL](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml)

Last updated: August 6, 2026

This repository is a personal demonstration workspace: real, MIT-licensed NgRx source ported module by module, with specific pieces **redesigned by choice** — not copied verbatim — where the goal is to show a defensible, different architectural call instead of reproducing an existing one.

This repo is **not affiliated with, and not published by, the upstream [@ngrx/platform](https://github.com/ngrx/platform) project.** See [LICENSE](./LICENSE) for why the original copyright notice is still intact despite that.

## 🧭 Start Here

- **[`todo.md`](todo.md)** — the phase-by-phase log of everything done and everything still open. This is the source of truth for progress.
- **[GitHub Project board](https://github.com/users/Terrence721/projects)** — a lighter-weight, at-a-glance view of the same work, kept in sync with `todo.md`.
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development setup, testing commands, commit conventions.

## 🧭 Why This Matters

Anyone can `cp -r` a well-known open-source library. The more useful exercise — and the point of this repo — is knowing _which_ parts of a mature codebase to leave alone and _which_ to challenge.

**Porting real source where fidelity matters.** `modules/store`'s implementation, tests, and schematics are the actual ngrx source, adapted where necessary (package metadata, build tooling, editor config) and left alone everywhere else. It's a large, battle-tested surface; rewriting it for its own sake would trade correctness for no real benefit.

**Redesigning where the tradeoff earns naming out loud.** The real `Store`, `ActionsSubject`, and `ReducerManager` classes extend RxJS's `Observable`/`Subject` types directly — a real Interface Segregation violation, not a style nitpick, since it hands every consumer the entire RxJS operator surface (`pipe`, `lift`, `toPromise`, ...) when the actual contract is much narrower. This repo replaces that with composition, one class at a time, each fully verified before moving to the next, with the reasoning for the change written down in the commit that makes it — see `todo.md`'s "`Store` composition-over-inheritance redesign" section.

## 🏗 What's Here So Far

An [Nx](https://nx.dev/) workspace (`modules/` for libraries, `projects/` for apps — none ported yet), using yarn, Vitest, and ESLint's flat config.

```text
modules/
  store/              ← ported (real source); Store/ActionsSubject/ReducerManager
                         mid-redesign to composition over inheritance
  schematics-core/     ← ported (real source), shared schematic/AST utilities
```

11 more modules (`entity`, `effects`, `router-store`, `store-devtools`, `data`, `operators`, `component-store`, `signals`, `component`, `eslint-plugin`, `schematics`) come next — see `todo.md`'s "Still to do" table for sequencing and why.

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
