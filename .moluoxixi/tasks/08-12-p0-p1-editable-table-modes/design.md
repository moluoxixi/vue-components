# Design

## Architecture

### Shared request and clipboard composables

- Keep `@moluoxixi/hooks/useRequestOptions` as the generic server-state primitive.
- Publicly export the existing component adapter as `useRequestOptionsComponent`; it preserves merged loading and component emit behavior without introducing a second `useRequestOptions` name.
- Add `useRequestTableComponent` under the same request layer. It owns `useRequestTable`, loaded/error watches, pagination state and handlers. Callers provide explicit policies for cache key, total fallback, pagination visibility, and empty-state text.
- Add `useClipboardCopy` as Vue state around the existing framework-neutral `copyText`. Refactor `HeadlessCopyText` to consume it.

### Table mode contract

`HeadlessTable` owns the shared types and state mechanism. Both `HeadlessTable` and the independently implemented `ConfigTable` adapter consume that mechanism.

```ts
type HeadlessTableMode = 'default' | 'edit'

interface HeadlessTableModeApi {
  readonly mode: Readonly<Ref<HeadlessTableMode>>
  setMode(mode: HeadlessTableMode): void
  clearMode(): void
  setRowMode(rowId: HeadlessTableRowKey, mode: HeadlessTableMode): void
  clearRowMode(rowId: HeadlessTableRowKey): void
  setCellMode(rowId: HeadlessTableRowKey, columnId: string, mode: HeadlessTableMode): void
  clearCellMode(rowId: HeadlessTableRowKey, columnId: string): void
  getRowMode(rowId: HeadlessTableRowKey): HeadlessTableMode
  getCellMode(rowId: HeadlessTableRowKey, columnId: string): HeadlessTableMode
}
```

Internal state contains a global API override, row overrides keyed by stable row identity, and cell overrides keyed by row identity plus stable column id. Resolution is:

```text
cell override -> row override -> global API override -> mode prop -> default
```

`clearMode()` reveals the prop value, or `default` when no prop exists. Row and cell APIs accept stable ids, never row indexes. Components resolve row ids from `getRowId`; ConfigTable can also resolve an explicitly configured string `rowKey`. Row/cell APIs fail with a clear diagnostic when no stable identity can be resolved.

Bulk cleanup is explicit: `clearAllRowModes()` removes row overrides, `clearAllCellModes()` removes cell overrides, and `clearAllModes()` removes global, row, and cell overrides. Each real API mutation produces one additive `modeChange` notification. Single-scope notifications report the previous and next effective mode; bulk notifications report the cleared override count. The event is observational and never emits `update:mode` because the prop remains the table-wide base value beneath ephemeral API overrides.

### Edit slot selection

Column contracts gain an optional inline `edit` slot and an optional named `slots.edit` reference. When effective cell mode is `edit`, selection order is:

```text
inline edit slot -> named edit slot -> unchanged default renderer chain
```

The unchanged default chain remains:

```text
inline default slot -> named default slot -> renderer registry -> formatter -> raw value
```

Edit and default slot scopes receive `mode`, `rowId`, and cell-scoped actions. The default table scope exposes the complete mode API. Consumers own triggers, form controls, validation, mutation, save, and cancel behavior.

### Rich text package

Create `@moluoxixi/rich-text-editor` as an independent Vite library. Move the implementation, public types, styles, docs, and unit tests there. Tiptap public/runtime dependencies move out of `@moluoxixi/components`; Vue and Tiptap singleton-sensitive contracts are peers with development dependencies.

`@moluoxixi/components` retains root and `./RichTextEditor` compatibility exports backed by a thin adapter dependency. Existing auto-loader resolution remains compatible. Playground imports the new package directly while a components integration test protects the legacy path.

### ConfigForm reuse

- Move the duplicated option resolver watch/abort/cache lifecycle into the shared Designer package. Adapter functions remain public wrappers with unchanged names and types.
- Pass an already computed reaction projection through the same synchronous controller operation. External validation/model/field-tree entry points continue to recompute and no persistent cache is added.

### Task graph and release checks

- Add Turbo for `build`, `typecheck`, `test`, and `test:coverage`. Outputs are limited to build and coverage artifacts; release invokes a forced build.
- Keep root-only docs and ConfigForm verification steps explicit where they are not represented by package scripts.
- Split browser suites into a CI job using Chromium, running on main and eligible pull requests with failure artifacts.
- Add a Node-based publishable-package verifier that discovers non-private versioned workspace packages, packs them, runs `publint` and `@arethetypeswrong/cli`, and performs root ESM/type consumer smoke checks.
- Split manifest entry discovery and smoke-source generation into importable pure helpers with fast unit tests. Add an explicit browser-capable allowlist for a Vite consumer build so Node-only entries are not misclassified, and load the built consumer in Chromium to verify runtime evaluation and CSS application.
- Add semantic workflow validation via a pinned actionlint distribution while retaining the existing workflow topology tests.
- Route declaration postbuilds through one root `finalize:declarations` command. Each package passes its lifecycle `npm_package_json` explicitly so the finalizer remains package-scoped without encoding directory depth.
- Define `#components/*` as a package-owned private import map with `source` and `types` conditions. Use it for cross-component and shared request/util imports in ordinary implementation code so consumer aliases cannot change resolution; retain relative imports for local module neighbors, tests that intentionally target the package root, and `types/` contracts that Vue's SFC macro resolver must expand.

## Compatibility

- All new props, slots, scope fields, composables, and expose methods are additive.
- `mode` defaults to `default`; tables with no mode usage retain current rendering.
- Missing edit slots deliberately fall through to current rendering.
- RichTextEditor legacy imports remain available.
- Existing ConfigTable pagination, empty-state, and cache-key policies remain distinct.

## Rollback

- Table mode support can be removed without data migration because mode state is ephemeral and does not touch row data.
- Request helpers retain thin local wrappers until regression tests confirm policy parity.
- RichTextEditor compatibility exports allow reverting consumer migrations independently of the new package.
- Turbo changes retain direct package scripts, so the root scripts can temporarily revert to `pnpm -r` if cache graph issues appear.
