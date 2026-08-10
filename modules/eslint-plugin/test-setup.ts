// Deliberately empty: @typescript-eslint/rule-tester falls back to the
// ambient `afterAll` (already global via this repo's `globals: true` vitest
// config) when RuleTester.afterAll isn't explicitly set. Explicitly setting
// it to a captured `vitest.afterAll` reference (the real upstream setup)
// breaks under Nx's vitest-angular:test executor, which runs vitest
// in-process via the Node API rather than the CLI - that captured reference
// goes stale across files sharing the run, and RuleTester's suite-context
// tracking fails with "Vitest failed to find the current suite" for every
// spec file. Letting it fall through to the ambient global avoids that.
export {};
