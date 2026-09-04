# VitePress Theme Structure Supplement

The package follows the repository-wide
[directory structure contract](../../directory-structure.md). This document
adds its public-entry, Node, Markdown, repository, and lifecycle boundaries.

## Scope

This convention applies to `packages/vitepress-theme-element-plus`. The package
is a reusable documentation product: runtime UI, Markdown transformation, Node
lifecycle code, repository providers, and consumer project configuration must
remain independently discoverable and must not leak through old internal paths.

## Layout

```text
packages/vitepress-theme-element-plus/
  index.ts                         # browser/runtime public API
  markdown.ts                      # Markdown public API
  node.ts                          # Node content public API
  repository.ts                   # repository public API
  repository-node.ts              # repository lifecycle/collector public API
  src/
    content/                       # reusable content UI and integration
    markdown/
      index.ts
      demo/
      playground/
      project/
      source/
      utils/
    node/
      index.ts
      content/
      lifecycle/
      playground/
      project/
      repository/
      utils/
    project/                       # consumer project contract
    runtime/                       # VitePress theme runtime
    upstream/                      # recorded Element Plus/VitePress source
```

## Contracts

- Package-root entry files are public barrels only. They export current symbol
  names and contain no lifecycle, provider, Markdown, or rendering logic.
- `src/node` and `src/markdown` feature roots contain only `index.ts` and
  responsibility directories. Every responsibility directory has `index.ts`.
- CLI parsing/orchestration lives in `src/node/lifecycle`; preparation is not a
  repository provider concern. Generated content and playground manifests have
  their own Node responsibilities.
- Shared Node file utilities live in `src/node/utils`. Provider collectors and
  synchronization remain in `src/node/repository`; repository runtime assembly
  lives in `src/node/repository/services/runtime.ts` and concrete collectors
  live in `src/node/repository/adapters`.
- `repository-node.ts` owns the public `./repository/node` aggregation. The
  internal `src/node/repository/index.ts` exports repository responsibilities
  only and must not re-export lifecycle, playground, project, or utility APIs.
- Markdown demo fences, project assembly, source links, external playground
  projection, and pure SFC utilities remain separate responsibilities.
- Tests use package public entries or current responsibility barrels. Removed
  flat internal paths are deleted rather than forwarded.
- Public export names from `index.ts`, `markdown.ts`, `node.ts`,
  `repository.ts`, and `repository-node.ts` must remain stable unless an
  explicit API change is approved.

## Validation

| Condition | Required result |
| --- | --- |
| `src/node` or `src/markdown` gains a flat implementation file | Move it into its owning responsibility directory |
| A responsibility directory lacks `index.ts` | Add the local barrel |
| Test imports a removed internal flat path | Import the current barrel or public entry |
| Directory move changes public export keys | Restore the public surface or treat it as an explicit breaking change |
| Repository provider imports its own copy of atomic-write logic | Reuse `src/node/utils` |
| Repository barrel exports sibling Node responsibilities | Move the public aggregation to `repository-node.ts` |

## Tests Required

- `test/source-structure.test.ts` verifies feature roots, responsibility
  barrels, repository isolation, and the runtime public export keys for Node,
  Markdown, and repository Node entries.
- Directory moves require theme typecheck, full unit tests, build provenance,
  consumer fixture build, ESLint, and diff checks.
- Lifecycle entry moves must also keep the built `element-plus-docs` binary
  functional for `prepare`, `dev`, `build`, and `preview`.

## Examples

Good:

```ts
export * from './src/markdown'
export * from './src/node'
```

Bad:

```ts
export * from './src/markdown/demo'
export * from './src/node/content'
```
