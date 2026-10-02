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

Changes that span the repo use a scope naming the area instead, such as `deps` for dependency updates, `lint`, `ci` or `todo`.

### Subject and body

Imperative, present tense ("change" not "changed"/"changes"), no capital letter or trailing period on the subject. The body explains motivation and contrasts with previous behavior.

### Footer

Reference closed issues and note breaking changes here, starting with `BREAKING CHANGE:`.
