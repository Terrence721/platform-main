# @ngrx/router-store

Added from the real [NgRx](https://github.com/Terrence721/platform-main) project into this demo workspace. Not affiliated with, and not published by, the upstream project — see the root [README.md](../../README.md).

## `@ngrx/router-store/data-persistence`

A secondary entry point with four RxJS operators for effects: `pessimisticUpdate` (update the server first), `optimisticUpdate` (update the client first, undo on failure), `fetch` (ordered, or per id with `id`, where a newer fetch for the same id cancels the running one) and `navigation` (run when a navigation activates a given component). All four are deprecated in favour of plain RxJS operators, and kept for apps that still use them.

`fetch` and `navigation` take an optional `onError`: without one, a failing `run` errors the stream with its own error.

License: MIT
