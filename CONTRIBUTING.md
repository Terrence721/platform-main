# Developing

## Setup

This repo uses [Yarn](https://yarnpkg.com) 4. [Corepack](https://nodejs.org/api/corepack.html) provisions the exact version pinned in the `packageManager` field of `package.json`, so enable it once and then install:

```shell
corepack enable
yarn install
```

## Testing

```shell
yarn test
```

### Testing for a specific library

```shell
yarn nx test effects --watch
yarn nx test <module-name> --watch
```

### Testing for a specific schematic unit test

```shell
yarn vitest modules/schematics/src/effect/index.spec.ts --watch
yarn vitest <relative path> --watch
```

### Testing the repo scripts

```shell
yarn test:scripts
```

## Running the Helpdesk app

```shell
yarn start:helpdesk
```

Starts the dev server and opens the app in a window of its own, using a separate Edge (or Chrome) profile so it runs as its own browser process. Closing that window, or Ctrl+C, stops the dev server's whole process tree and releases its port, so no server is left running from an earlier session. If port 4200 is taken it uses the next free one. `yarn nx serve helpdesk` still starts the server on its own, for a normal browser tab; stop it with Ctrl+C. The launcher's logic is `scripts/app-launcher.ts`, tested by `yarn test:scripts`.

## End-to-end tests (Helpdesk)

`projects/helpdesk-e2e` tests the whole help desk in Chromium with Playwright, against the real app, API and PostgreSQL that `docker compose --profile full up` runs. The specs cover signing in as each role, one journey per role (an agent, a supervisor, an admin), customer requests and their files (`customer-requests.spec.ts`), live updates in two browsers at once (`live-updates.spec.ts`) and after the API restarts, a session that ends mid-shift, an admin emptying a team, phone layouts, and the web server's headers and caching. CI's `Docker images (helpdesk)` job runs them against the stack it builds, and keeps the report as an artifact when one fails.

```shell
yarn e2e:helpdesk
```

Installs Chromium if it's missing, starts a fresh stack (its own seeded database), runs every spec, and removes the stack again, data included. The stack's start-up is `src/stack.ts`, Playwright's global setup. It refuses to start when a help desk already answers on port 8088, so a test never runs against old data by mistake. To test a stack that's already running, set `E2E_BASE_URL=http://localhost:8088`: the tests then use it as it is, and nothing is started or removed.

**The virus scan ([#1293](https://github.com/Terrence721/platform-main/issues/1293)):** `virus-scan.spec.ts` attaches the standard antivirus test file, harmless but flagged by every virus scanner, and checks that the request is refused and never reaches a supervisor. It needs ClamAV, so it's skipped unless you ask for it:

```shell
E2E_SCAN=1 yarn e2e:helpdesk   # in PowerShell: $env:E2E_SCAN = '1'; yarn e2e:helpdesk
```

The stack then starts with Compose's `scan` profile and the API pointed at ClamAV. The start takes a few minutes longer while ClamAV loads its signatures. CI leaves the scan off, so run this after changing anything around attachments.

**From VS Code:** the Playwright extension (recommended in `.vscode/extensions.json`) lists the specs in the Testing view. Clicking ▶ doesn't start the stack by itself, so:

1. In the Playwright panel, under Setup, click **Run global setup**, and wait for it to finish: a minute or two once the images are built, longer the first time. `docker ps` then shows the three `helpdesk-` containers as healthy.
2. Run any test or file with ▶, as often as you like. The stack stays up between runs.
3. Click **Run global teardown** when you're done.

**Show browser** shows the tests clicking through the app, and **Show trace viewer** steps through a run action by action. Don't run `yarn e2e:helpdesk` while the panel's stack is up: the two runs would share one database and trip over each other.

**Writing a spec:** the specs share one database and run one at a time, in any order, so each keeps to its own team:

| Spec                   | Team               |
| ---------------------- | ------------------ |
| `agent.spec.ts`        | Beacon             |
| `supervisor.spec.ts`   | Comet              |
| `admin.spec.ts`        | Delta              |
| `live-updates.spec.ts` | Atlas (Chris, Sam) |

Pick tickets from what's on screen, never by a fixed number, and get agents from the API (`/api/teams/mine`): the seed generates every agent's name except Sam's. Shared helpers (signing in, a ticket's row, a snack bar) are in `src/support.ts`.

## Dependency ranges

Each module declares its own dependency and peer-dependency ranges. `yarn check:versions` (also run in CI) checks that a package declared by several modules uses the same range in all of them, and that the version this repo develops against (the root `package.json`) falls inside every module's range. A range that has to differ can be listed, and pinned, in `scripts/check-version-ranges.ts`; none does today.

## Submitting pull requests

Please follow these steps to simplify review:

- Rebase your branch against the current `main`.
- Run `yarn install` to make sure your development dependencies are current.
- Run the test suite before submitting.
- Add tests for any new functionality.

## Submitting bug reports

- Search existing issues on this repo before opening a new one.
- Include a small reproduction where possible.
- State the affected browser(s)/OS and the Angular, Node, and package manager versions in use.

## Submitting new features

- Keep the API surface small and concise.
- Open an issue describing the proposal before submitting a PR.

## Commit message guidelines

Commit messages follow a fixed format so history stays readable.

### Format

Each commit message has a header, an optional body, and an optional footer:

```text
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The header is mandatory; scope is optional. No line may exceed 100 characters.

Example:

```text
fix(store): avoid re-emitting selector on identical state
```

### Revert

A revert commit starts with `revert:` followed by the header of the reverted commit, with `This reverts commit <hash>.` in the body.

### Type

One of: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `style`, `test`.

### Scope

The module or app affected, matching its folder under `modules/` or `projects/`:

- **component**
- **component-store**
- **data**
- **effects**
- **entity**
- **eslint-plugin**
- **operators**
- **router-store**
- **schematics**
- **schematics-core**
- **signals**
- **store**
- **store-devtools**
- **helpdesk** (`projects/helpdesk`)
- **helpdesk-api** (`projects/helpdesk-api`)
- **helpdesk-contract** (`projects/helpdesk-contract`)
- **helpdesk-e2e** (`projects/helpdesk-e2e`)
- **helpdesk-server** (`projects/helpdesk-server`)

Changes that span the repo use a scope naming the area instead, such as `deps` for dependency updates, `scripts` for the repo's tooling scripts, `lint`, `ci` or `todo`.

### Subject and body

Imperative, present tense ("change" not "changed"/"changes"), no capital letter or trailing period on the subject. The body explains motivation and contrasts with previous behavior.

### Footer

Reference closed issues and note breaking changes here, starting with `BREAKING CHANGE:`.
