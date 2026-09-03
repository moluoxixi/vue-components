# Repository Directory Structure Contract

## 1. Scope / Trigger

This contract applies to every package, application, playground, and documentation
workspace in this repository. Use it when creating a feature, splitting a large
module, moving a public contract, or changing a package export.

Organize code by **kind of responsibility**, not by individual file. A feature
root must remain a discoverable public boundary instead of becoming a flat list
of props, state, services, parsers, adapters, and helpers. Package-specific specs
may add stricter boundaries, but they must link here instead of restating this
contract.

This contract also owns package-root entries and Vue component ownership for
every workspace below `packages/`. Run `pnpm test:package-architecture` whenever
package entries, feature directories, barrels, or component locations change.

## 2. Signatures

A full TypeScript or Vue feature may use the following layout. Create only the
responsibility directories the feature actually needs:

```text
packages/<package>/
  index.ts                 # single package-level source entry
  src/                     # all production implementation
  package.json
  tsconfig*.json
  vite.config.ts           # when needed
```

```text
feature-name/
  index.ts                 # feature-level barrel only
  index.vue                # optional rendering/orchestration entry
  style/                   # optional component-owned side-effect entry
    index.ts               # imports the component Sass for bundlers
    index.scss             # Sass entry for manual/on-demand consumers
  components/
    index.ts
  types/
    index.ts
    props.ts
    emits.ts
    expose.ts
    domain.ts
  composables/
    index.ts
  state/
    index.ts
  services/
    index.ts
  schemas/
    index.ts
  validation/
    index.ts
  adapters/
    index.ts
  utils/
    index.ts
  constants/
    index.ts
  defaults/
    index.ts
  __tests__/
```

Non-Vue code follows the same responsibility rule. For example:

```text
import/
  index.ts
  types/
  guards/
  parsers/
  validation/

export/
  index.ts
  types/
  config/
  source/
  snapshot/
```

Vue public contracts are grouped below `types/` and re-exported through the
nearest barrel:

```ts
// types/index.ts
export type * from './props'
export type * from './emits'
export type * from './expose'
export type * from './slots'
export type * from './domain'

// feature-name/index.ts
export { default as FeatureView } from './index.vue'
export type * from './types'
export * from './composables'
```

The architecture manifest is versioned and checked against live diagnostics:

```ts
interface PackageArchitectureManifest {
  version: 1
  pathExceptions: Array<{ path: string, kind: 'generated' | 'third-party', reason: string }>
  packageExceptions: Array<{
    package: string
    kind: 'cli' | 'framework' | 'private-app'
    rules: string[]
    reason: string
  }>
  componentExceptions: Array<{
    component: string
    kind: 'dynamic' | 'framework' | 'public'
    rules: string[]
    owners: string[]
    reason: string
  }>
  debt: Array<{
    path: string
    rule: string
    targetTask: string
    reason: string
    owners?: string[]
  }>
}
```

## 3. Contracts

- A feature root contains its public `index.ts`, an optional framework entry,
  responsibility directories, and colocated tests. It does not contain a flat
  collection of unrelated implementation files.
- Directory names identify ownership: `types/` owns type-only contracts,
  `components/` owns child views, `composables/` owns composition logic,
  `state/` owns stores and state machines, `services/` owns use-case
  orchestration, `schemas/` owns runtime parsing, `validation/` owns explicit
  requirements, `adapters/` owns external-system adaptation, and `utils/` owns
  small pure helpers.
- Runtime defaults and factories do not belong in `types/`. Put them in
  `defaults/`, `constants/`, `composables/`, or `services/` according to their
  behavior.
- Every responsibility directory except `__tests__/` has one `index.ts` when
  it exposes symbols outside that directory. The barrel exports symbols only;
  it contains no business logic or side-effect registration.
- Package-level shared styling lives in `styles/`. A visual component may use
  an Element-style singular `style/` directory only for its own side-effect
  entry: `style/index.ts` imports Sass modules for bundlers and
  `style/index.scss` forwards the component Sass for manual/on-demand use.
  Component style entries must not contain unrelated component selectors.
- Imports from another feature use that feature's public barrel. Imports inside
  a feature use the nearest responsibility barrel unless a direct local import
  is necessary to avoid a cycle or an eager platform-specific dependency.
- Framework-required entries such as `index.vue`, VitePress config/theme
  entries, CLI entries, and package export files orchestrate current feature
  barrels. Reusable implementation stays in responsibility directories.
- Do not create empty directories for symmetry. Once a responsibility exists,
  however, it must live under its canonical, discoverable name.
- A generic `helpers.ts`, `common.ts`, or `misc/` directory is not an ownership
  boundary. Name the actual responsibility or keep a genuinely local helper
  beside its sole consumer.
- A package-specific exception belongs in that package's spec and must explain
  why the global boundary is insufficient. It supplements this contract rather
  than copying it.
- Every published package keeps its only package-level source entry at root
  `index.ts`. The root entry explicitly exports named `src/<feature>` boundaries;
  `export * from './src'` and a mirrored `src/index.ts` are forbidden.
- `package.json` source exports, build entries, declaration generation, and
  independent consumer tests point to the same root-entry model. Private apps,
  CLI entrypoints, and framework fixtures need narrow manifest exceptions only
  for rules their runtime shape cannot satisfy.
- A Vue component with one concrete parent belongs below that parent's
  `components/` directory. A component used by only one feature belongs below
  that feature's `components/`. Package-level shared components require at
  least two independent feature owners.
- `index.vue` beside a feature `index.ts` is a feature shell, not a single-parent
  child. Components reachable through explicit root re-exports are public;
  dynamic/framework ownership that static analysis cannot derive must be
  declared in the architecture manifest.
- Architecture debt is an exact, path-level baseline. New diagnostics fail;
  removed diagnostics make the matching debt entry stale and also fail. Every
  debt entry names an existing Trellis cleanup task, and the repository-wide
  governance task cannot finish until debt is empty.
- Component exceptions match the component path, exact diagnostic rule, and
  statically resolved owners. Declared dynamic/framework owner paths must exist;
  an owner or rule drift makes the exception stale instead of widening it.
- When static analysis emits `component.owner-required` without owners, an
  exception supplies the semantic framework/dynamic owner instead; every such
  declared owner must resolve to an existing repository file or directory.
- Debt cleanup tasks must be descendants of the repository-wide packages
  governance task, not merely unrelated Trellis tasks with matching names.
- A composable owns Vue reactivity, injection, listeners, or lifecycle cleanup.
  A deterministic parser, mapper, serializer, resolver, or geometry algorithm
  belongs in `services/` or `utils/`, not in a hook-shaped file.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Feature root mixes props, state, services, parsers, and helpers | Move each file into its owning responsibility directory |
| Public Vue contracts are inline or flat at feature root | Move type-only declarations under `types/` and export them from `types/index.ts` |
| Runtime defaults or factories live under `types/` | Move them to the responsibility matching their runtime behavior |
| One responsibility is split across unrelated directories | Merge it under one canonical responsibility directory |
| An externally consumed responsibility directory lacks `index.ts` | Add the local barrel before exposing it |
| A barrel contains business logic or side effects | Move the logic to its owning module and keep the barrel declarative |
| Cross-feature code deep-imports another feature implementation | Import the public feature barrel or document the narrow boundary |
| A proposed directory has no distinct owner or trigger | Do not create it |
| A component `style/` directory lacks `index.ts` or `index.scss` | Reject it as an incomplete on-demand style entry |
| A component Sass entry emits unrelated component selectors | Split the shared dependency or move the rule to the owning component |
| Package-specific spec repeats this contract | Replace the copy with a link and retain only the package exception |
| Published package lacks root `index.ts` or `src/` | Emit `package.root-index-required` / `package.src-required` |
| Root entry forwards `./src` or package retains `src/index.ts` | Emit `package.root-index-explicit-exports` / `package.src-index-forbidden` |
| Build/source metadata bypasses root entry | Emit `package.build-entry` / `package.source-entry` |
| main/module/types drift from root export conditions | Emit `package.output-entry` |
| Non-public component has no resolvable owner | Emit `component.owner-required` |
| Single-parent or single-feature component is misplaced | Emit `component.single-parent-location` / `component.single-feature-location` |
| Live diagnostic has no exact debt/exception | Fail as unknown architecture debt |
| Debt or exception no longer matches live diagnostics | Fail as stale manifest data |
| Exception kind, owner, or rule is invalid or duplicated | Reject the manifest before reconciliation |

## 5. Good / Base / Bad Cases

- Good: a renderer exposes contracts through `types/index.ts`, keeps behavior in
  `composables/`, and keeps state in `state/`.
- Good: a styled component exposes `style/index.scss`; an aggregate package
  style entry forwards component entries without copying their rules.
- Good: `packages/foo/index.ts` explicitly exports `./src/components` and
  `./src/services`; no `src/index.ts` mirrors the package surface.
- Good: `FeatureView/components/FeatureToolbar.vue` has one parent,
  `FeatureView/index.vue`; a shared command hint has callers in two features.
- Good: a Node package separates lifecycle orchestration, repository adapters,
  serialization, and pure filesystem utilities.
- Base: a small feature has only `index.ts`, its implementation entry, and
  `types/`; it creates no empty `services/` or `state/` directories.
- Bad: `props.ts`, `state.ts`, `service.ts`, `parser.ts`, and `helpers.ts` form a
  flat feature root.
- Bad: two package specs copy this document and drift independently.
- Bad: `packages/foo/index.ts` contains only `export * from './src'`, while the
  real public surface is hidden behind `src/index.ts`.
- Bad: `src/components/PrivateDialog.vue` has one parent but is exported from a
  package-wide components barrel.
- Bad: a broad package stylesheet targets `input:focus-visible` below a root
  class and unintentionally overrides a mature component library's internal
  input.

## 6. Tests Required

- Architecture tests enumerate feature roots that have an established layout
  and verify recognized responsibilities live in canonical directories.
- Architecture tests verify each externally consumed responsibility directory
  has one `index.ts` and reject business logic in public barrels where practical.
- Type or import tests consume public contracts through feature/package barrels
  and reject removed or unintended deep import paths.
- Directory moves run the owning package's lint, typecheck, unit tests, and any
  package-specific build or public-export checks.
- Style architecture tests compile each public Sass entry and assert a sentinel
  selector from another component is absent. Browser tests verify Provider
  controls keep a single library-owned focus frame.
- Package-specific specs add assertions for framework entries, generated output,
  platform isolation, or public API stability when those boundaries exist.
- `scripts/__tests__/package-architecture.test.mjs` uses TypeScript AST and the
  Vue SFC parser to cover root entries, re-export-only public reachability,
  static and literal dynamic imports, barrel traversal, single-parent,
  single-feature, shared components, exceptions, unknown debt, and stale debt.
- `pnpm check:package-architecture` must match live diagnostics exactly against
  `scripts/package-architecture/config/manifest.json`; regex-only import graph
  checks are not sufficient.
- The package architecture CLI is read-only and rejects unknown arguments; it
  never offers a baseline rewrite flag.

## 7. Wrong vs Correct

Wrong:

```text
renderer/
  index.ts
  Renderer.vue
  props.ts
  expose.ts
  state.ts
  service.ts
  helpers.ts
```

Correct:

```text
renderer/
  index.ts
  index.vue
  types/
    index.ts
    props.ts
    expose.ts
  composables/
    index.ts
    use-renderer.ts
  state/
    index.ts
    controller.ts
  services/
    index.ts
    load.ts
```

Wrong:

~~~scss
.feature-root input:focus-visible {
  outline: 2px solid var(--focus);
}
~~~

Correct:

~~~scss
.feature-search__input:focus-visible {
  outline: 2px solid var(--focus);
}
~~~

When `.feature-search__input` is replaced by a mature library component,
remove this native-control rule and let the library theme own its internal
focus state.

Wrong:

```ts
// packages/foo/index.ts
export * from './src'

// packages/foo/src/index.ts
export * from './components'
export * from './services'
```

Correct:

```ts
// packages/foo/index.ts
export * from './src/components'
export * from './src/services'
```
