<!-- The portfolio link comes before the title on purpose. -->
<!-- markdownlint-disable MD041 -->

**[→ Read the one-page portfolio](https://terrence721.github.io/platform-main/portfolio.html)** — the 60-second version, with links back into this repo for anyone who wants to go deeper.

# ⚙️ Principal Frontend Engineering Demonstration

[![Quality](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/quality.yml)
[![CodeQL](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml/badge.svg)](https://github.com/Terrence721/platform-main/actions/workflows/codeql.yml)
[![security](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Terrence721/Terrence721/main/badges/platform-main.json)](https://github.com/Terrence721/platform-main/security)

Last updated: October 6, 2026

This repository is a personal demonstration workspace: real, MIT-licensed NgRx source added module by module, with specific pieces **redesigned by choice** — not copied verbatim — where the goal is to show a defensible, different architectural call instead of reproducing an existing one.

This repo is **not affiliated with, and not published by, the upstream [@ngrx/platform](https://github.com/ngrx/platform) project.** See [LICENSE](./LICENSE) for why the original copyright notice is still intact despite that.

## 🧭 Start Here

- **[`todo.md`](todo.md)** — the phase-by-phase log of everything done and everything still open. This is the source of truth for progress.
- **[Platform Project board](https://github.com/users/Terrence721/projects/2)** — a lighter-weight, at-a-glance view of the same work, kept in sync with `todo.md`.
- **[HelpDesk project board](https://github.com/users/Terrence721/projects/11)** — the Helpdesk app's own board: its issues and PRs, from the scaffold through the landing page and on.
- **[`docs/architecture.md`](docs/architecture.md)** — the reasoning behind this repo's architectural decisions (context, alternatives, what each one actually cost), not just what changed.
- **[`docs/case-study.md`](docs/case-study.md)** — problem, constraints, tradeoffs, and results, for anyone scanning this repo as a portfolio piece rather than reading it as documentation.
- **[How It Fits Together](docs/how-it-fits-together.md)** — the big picture in one diagram: the 13 modules, the Helpdesk app built on them, how it runs (dev server or Docker), the in-browser demo, and the path from a pull request to the live site
- **[Module Dependency Graph](https://terrence721.github.io/platform-main/diagrams/module-dependency-graph.html)** — the 13 modules and their 3 real dependency tiers, read from every `peerDependencies` field
- **[Project Dependency Graph](https://terrence721.github.io/platform-main/diagrams/project-dependency-graph.html)** — the 5 Helpdesk projects and exactly which modules each one imports, read from every `import`
- **[Nx Project Graph](docs/diagrams/nx-project-graph.png)** — Nx's own graph of the 13 modules and the 5 Helpdesk projects (`nx graph`), including the implicit edges to `schematics` that order the builds
- **[Composition Over Inheritance](https://terrence721.github.io/platform-main/diagrams/composition-over-inheritance.html)** — before/after for all 6 classes redesigned off RxJS inheritance, and what each change actually cost
- **[Code-Review Audit Pipeline](https://terrence721.github.io/platform-main/diagrams/code-review-audit-pipeline.html)** — the per-file table → issue → PR → merge process, plus live per-module status
- **[Effects Runtime Data Flow](https://terrence721.github.io/platform-main/diagrams/effects-runtime-data-flow.html)** — the startup ordering `EffectsRootModule` depends on, and why getting it wrong would fail silently
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development setup, testing commands, commit conventions.

On AI-assisted development: much of this repo's implementation and review work is done with Claude (Claude Code), directed, reviewed, and merged by Terrence Daniels. Every change goes through a GitHub issue and a pull request that the repo owner reads and merges by hand — the process is documented in docs/code-review.md. Commits are not tagged with a co-author trailer (only one early commit is), so the commit history alone is not a marker of which changes were AI-assisted.

## 🧭 Why This Matters

Anyone can `cp -r` a well-known open-source library. The more useful exercise — and the point of this repo — is knowing _which_ parts of a mature codebase to leave alone and _which_ to challenge.

**Adding real source where fidelity matters.** Every added module's implementation, tests, and schematics are the actual ngrx source, adapted where necessary (package metadata, build tooling, editor config) and left alone everywhere else. It's a large, battle-tested surface; rewriting it for its own sake would trade correctness for no real benefit.

**Redesigning where the tradeoff earns naming out loud.** Six real ngrx classes across `store` and `effects` — `Store`, `ActionsSubject`, `ReducerManager`, `State`, `ScannedActionsSubject`, `EffectSources` — extend RxJS's `Observable`/`Subject` types directly. That's a real Interface Segregation violation, not a style nitpick: it hands every consumer the entire RxJS operator surface (`pipe`, `lift`, `toPromise`, ...) when each class's actual contract is much narrower. Finding them wasn't a one-pass job — the first sweep caught the three obvious ones; a second pass, re-running the same check after the first landed, caught two more; a third pass audited every `extends` in every file in the module, not only the classes already under suspicion, to confirm none were missed. This repo replaces each one with composition, one class at a time, fully verified before moving to the next, with the reasoning — and what was left alone on purpose, like the DI-token classes that don't have this problem — recorded in `docs/architecture.md` and the commit that makes each change. The discipline generalizes past this one module: re-auditing the whole surface instead of trusting the first pass is the approach this repo applies wherever fidelity to the real source isn't the point.

## 🏗 What's Here So Far

An [Nx](https://nx.dev/) workspace (`modules/` for libraries, `projects/` for apps), using Yarn 4, Vitest, and ESLint's flat config.

### The 13 modules (`modules/`)

Each is real, MIT-licensed NgRx source, added one module at a time and then reviewed file by file.

**Runtime modules**, used by apps:

| Module            | What it does                                        | What changed here                                                                                                                 |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `store`           | Global state: actions, reducers, selectors          | 5 classes redesigned from RxJS inheritance to composition ([why](docs/architecture.md)); 3 bugs fixed in review                   |
| `effects`         | Side effects that react to actions                  | `EffectSources` redesigned to composition; review found nothing to fix                                                            |
| `entity`          | Entity adapter for collections in the store         | Review found nothing to fix                                                                                                       |
| `router-store`    | Router state in the store, plus `data-persistence`  | Adapted to the composed `Store`; 7 bugs fixed in review; `data-persistence` ported as supported, not deprecated                   |
| `store-devtools`  | Redux DevTools integration                          | A `StateObservable` fix on port; 6 bugs and 1 cleanup in review                                                                   |
| `operators`       | `tapResponse`, `concatLatestFrom`, `mapResponse`    | 2 missing exports fixed in review                                                                                                 |
| `signals`         | Signal stores, signal state, entities, events       | 14 defects fixed in review, the worst in the audit: a state key named `set`, `update` or `asReadonly` silently broke `patchState` |
| `component-store` | Local state for a component, no global store needed | A TypeScript strictness gap fixed on port; 1 more gap fixed in review                                                             |
| `component`       | `ngrxLet` and `ngrxPush`                            | 1 bug and 2 missing exports fixed in review                                                                                       |
| `data`            | Entity data services over HTTP                      | 2 upstream bugs fixed on port; 42 of its 61 files fixed in review                                                                 |

**Tooling modules**, used while developing:

| Module            | What it does                                        | What changed here                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint-plugin`   | 38 lint rules and configs, including template rules | 38 of 55 files fixed: an aliased `Store` import had silently turned off 14 rules, and the rules now also cover functional effects, standalone providers and stores held in variables                             |
| `schematics`      | `ng add` and code generators for every module       | One shared copy instead of 11, while each module keeps its own `ng add` ([why](docs/architecture.md)); all 25 files reviewed, fixing standalone-app failures, generated code that didn't compile, and weak tests |
| `schematics-core` | Shared code-editing utilities for the schematics    | 9 bugs, 2 test gaps and 13 missing exports fixed                                                                                                                                                                 |

The code review covered all 270 source files, each with its own issue and pull request ([#32](https://github.com/Terrence721/platform-main/issues/32)); every finding is in [`docs/code-review.md`](docs/code-review.md). After it, the 31 `ng update` migrations were reviewed the same way (27 fixed, [#106](https://github.com/Terrence721/platform-main/issues/106)), and every module gained type-level tests of its public API (11 type defects and 3 runtime bugs fixed, [#162](https://github.com/Terrence721/platform-main/issues/162)).

### The Helpdesk app (`projects/`)

A real help desk built on the modules, so every module does real work in a real app ([#303](https://github.com/Terrence721/platform-main/issues/303)). [How It Fits Together](docs/how-it-fits-together.md) shows how the parts connect.

| Project             | What it is                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `helpdesk`          | The Angular app: a page per role (agent, supervisor, admin), the public Report an issue and Check my request pages, reports, live updates and sounds |
| `helpdesk-contract` | The types and rules the app and the API share                                                                                                        |
| `helpdesk-api`      | The NestJS API: sign-in, roles, tickets, teams, accounts, customer requests and their files, reports, live updates                                   |
| `helpdesk-server`   | The API's services, the PostgreSQL schema and migrations (Drizzle), and the seed data                                                                |
| `helpdesk-e2e`      | Playwright end-to-end tests against the real stack, run on every pull request                                                                        |

Customers report an issue on the public site with no account, and can attach up to three screenshots or files; pictures are redrawn on arrival, which removes hidden data such as a photo's location ([#1026](https://github.com/Terrence721/platform-main/issues/1026)). Each request gets a reference the customer can check with their email. Supervisors see new requests, with their files and possible duplicates, and turn each into a ticket or dismiss it; the Reports popup counts them.

It runs with only Docker installed ([#20](https://github.com/Terrence721/platform-main/issues/20)), and a [live demo](https://terrence721.github.io/platform-main/helpdesk/) runs entirely in the browser.

## 🖥 Getting Started

```shell
corepack enable    # once: provisions the Yarn version pinned in package.json
yarn install
yarn nx report
```

```shell
yarn lint    # ESLint across all projects
yarn test    # Vitest across all projects
yarn build   # ng-packagr build across all projects
```

To run the Helpdesk app on any machine, with only Docker installed:

```shell
docker compose --profile full up --build   # database + API + app, then open http://localhost:8088
docker compose --profile full down --volumes   # stop it and delete its data
```

On a machine with this repo's tools installed, `yarn start:helpdesk:docker` does the same and opens the app in its own window; closing it stops everything. The first build takes a few minutes; later ones reuse the installed packages. Sign in as `alex.morgan` (admin), `chris.taylor` (supervisor) or `sam.rivera` (agent), password `helpdesk-dev-only`.

To work on it, with instant reload:

```shell
yarn start:helpdesk   # database, API and app; the app opens in its own window, and closing it stops everything
```

It picks the next free port when 4200 is taken. `yarn nx serve helpdesk` still works for a normal browser tab.

To test it end to end, in a real browser against the real API and database:

```shell
yarn e2e:helpdesk   # starts a fresh stack in Docker, runs the Playwright tests in Chromium, then removes it
```

The tests sign in as each role, walk through each role's work, and check live updates in two browsers at once. CI runs them on every pull request. To test a stack that's already running, set `E2E_BASE_URL=http://localhost:8088` and the tests use it as it is. [CONTRIBUTING.md](./CONTRIBUTING.md#end-to-end-tests-helpdesk) covers running them from VS Code.

The full-suite [HTML test report](https://terrence721.github.io/platform-main/) is deployed to GitHub Pages on every push to `main` (grows as more modules and test cases are added) — or see the [at-a-glance summary](https://terrence721.github.io/platform-main/summary.html) for just the pass/fail/slow breakdown. To generate either locally instead, run `yarn build && yarn test:report && yarn test:summary`, then `yarn test:report:view` to serve and open them.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more, including the commit-message convention this repo's history follows.

## License

MIT — see [LICENSE](./LICENSE).
