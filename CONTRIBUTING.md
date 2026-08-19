# Developing

## Setup

```shell
yarn install
```

## Testing

```shell
yarn test
```

### Testing for a specific library

```shell
yarn nx test effects --watchAll
yarn nx test <module-name> --watchAll
```

### Testing for a specific schematic unit test

```shell
yarn vitest modules/schematics/src/effect/index.spec.ts --watch
yarn vitest <relative path> --watch
```

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

Commit messages follow a fixed format so history stays readable and the `changelog` script can generate this repo's changelog from them.

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

One of: `build`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `style`, `test`.

### Scope

The package affected, matching the `modules/` layout as it gets built out:

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

### Subject and body

Imperative, present tense ("change" not "changed"/"changes"), no capital letter or trailing period on the subject. The body explains motivation and contrasts with previous behavior.

### Footer

Reference closed issues and note breaking changes here, starting with `BREAKING CHANGE:`.
