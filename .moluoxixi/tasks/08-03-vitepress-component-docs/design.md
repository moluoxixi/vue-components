# Design

## Architecture

The documentation remains a VitePress package under `docs/vitepress`. Component prose and demos remain next to component source under `packages/components/src/*/docs/index.md`. Those source documents are optional fragments: one VitePress dynamic route template expands the component manifest into `/components/<slug>` pages, includes a fragment when present, and always appends the generated API section. No component route mirror is written under the documentation source tree.

The custom theme extends VitePress DefaultTheme and owns four presentation components:

- `Demo.vue`: browser-compiles documented SFC examples and provides preview/copy/source/error states.
- `ApiTable.vue`: renders one generated contract section.
- `TypeCell.vue`: renders compact type text with an accessible expanded-type tooltip.
- `OverviewCard.vue`: renders the shared overview card grid used by the home and component overview routes.
- `Playground.vue`: owns the dedicated single-SFC editor, manual execution controls, preview, and compile/runtime diagnostics.

`Demo.vue` and `Playground.vue` consume one documentation-local SFC compiler instead of maintaining separate `vue3-sfc-loader` adapters. The compiler receives an explicit module allowlist, accepts exactly one versioned virtual entry path, returns a disposer for injected styles, and removes partial styles before propagating failures.

The VitePress host and its Vitest transform use `autoComponent` and `autoImport` from the isolated `@moluoxixi/components/auto-loaders` subpath. The subpath owns the component and runtime-helper manifest, has its own build entry, and is intentionally absent from the component root barrel. Its public declarations use local structural types, so ordinary component consumers do not inherit unplugin peer dependencies. Static theme components therefore exercise the same automatic component, style, and runtime-helper imports documented for consumers. Browser-compiled demo source remains outside Vite's transform pipeline and continues to use explicit imports resolved by the SFC compiler allowlist.

Every demo fence is therefore a self-contained SFC. A documentation test parses all component demo fences and verifies that non-native component tags have matching imports or local definitions before VitePress build time.

## ConfigTable Extension

ConfigTable reuses HeadlessTable's renderer configuration, registry, stable column identity, and order/visibility projection helpers while retaining Element Plus TableV2 as its renderer. It does not use the complete `useHeadlessTable` composable because ConfigTable owns remote loading and pagination.

Column settings are opt-in. The dialog edits a draft order and visibility map, then emits controlled updates only when confirmed. It uses stable column ids, never mutates the caller's column objects or array, and offers both a drag handle and explicit move controls. Existing inline render functions, named slots, formatter behavior, source `columnIndex`, and `field`-based TableV2 data keys remain compatible.

## API Data Flow

```text
packages/components/index.ts
  -> @moluoxixi/ai-doc-assistant ServerContext
  -> ComponentContract[]
  -> normalized docs API JSON
  -> VitePress data module
  -> component Markdown ApiTable sections
```

`extract-api.mts` invokes the public `ServerContext` in content mode. The public contract names and documentation manifest must match in both directions. It maps `defaultValue`, `payloadType`, `scopeType`, and `exposed`, includes referenced `typeDefs` as expanded tooltip text, and fails when extraction, manifest coverage, or route coverage drifts.

Markdown pages import contract JSON through a small shared VitePress data loader instead of embedding arrays. Prose and examples stay handwritten, preserving the requested ownership split. The dynamic route content owns the API mount point; a source fragment never needs to declare `<ApiDocs>`. When no fragment exists, the route uses the manifest name and description before the API section, so every public component remains navigable and searchable. A VitePress rewrite keeps the public `/components/` and `/components/<slug>` URLs independent from the internal route template path.

## Theme And Layout

- Use DefaultTheme behavior for routing, search, dark mode, and accessible navigation.
- Override VitePress tokens and key surfaces to match Element Plus: `#409eff` brand color, white/neutral surfaces, compact sidebar, 60px navigation, bordered demo/API blocks, and modest 4-8px radii.
- Use consistent overview data/component rendering on both `/` and `/components/`.
- Use responsive constraints rather than hard-coded content offsets; demo previews own horizontal scrolling at narrow widths.
- Use text/icon glyphs already available in the project and CSS shapes; no remote assets or new icon dependency is required.

## Compatibility And Failure Behavior

- The docs build requires built workspace packages, including `@moluoxixi/ai-doc-assistant` and `@moluoxixi/components`.
- The generation script runs on the repository's Node 22 toolchain. Extraction failures and missing components abort build.
- Dynamic demos support only modules explicitly added to `Demo.vue`'s module cache. Examples should prefer APIs already provided by Vue, Element Plus, and the component package; dayjs is added only if a maintained example still imports it.
- The demo action writes the source and a stable demo identifier to an ephemeral same-origin session key, then opens the dedicated playground route. URL state contains only the opaque session identifier; opening the route directly uses a built-in starter. Version one does not provide source-sharing URLs.
- The playground compiles only on initial load or an explicit Run action. Each run gets a unique virtual filename and fresh module cache, disposes the prior result before replacement, and uses a monotonically increasing run id so stale promises cannot replace newer output.
- Unknown module or file requests fail with a readable diagnostic. Relative imports, preprocessors, external assets, and arbitrary package resolution remain unsupported.
- Generated API files remain ignored build artifacts. Component routes are expanded in memory from the manifest and a single tracked dynamic route template; the component overview is a tracked internal route rewritten to `/components/`.

## GitHub Metadata

GitHub data is synchronized explicitly into a committed snapshot; normal dev and build commands remain offline and deterministic. The synchronizer fixes a repository head SHA, follows REST pagination, fetches open issues once, excludes pull requests, and attributes issues by the `[ComponentName]` title prefix used by the issue link. Component commits are queried by component source path. The same commit set produces both the component contributor projection and the complete changelog timeline.

The snapshot records its schema version, repository identity, default branch, head SHA, generation time, repository issue count, component issue count, contributors, profiles, and commits. A failed or rate-limited sync never replaces the last valid snapshot.

The route shell always appends generated API documentation and the current component's contributors after optional handwritten content. Changelog history is owned by the fixed page metadata component and opens in an accessible, responsive Element Plus dialog, so long commit histories do not expand the document outline or page length.

## Internationalization And Reuse

Repository URL, package name, source root, route prefixes, locale settings, and GitHub attribution rules live in one documentation site configuration module. Locale-neutral component identifiers remain in the component manifest; display labels and custom-theme messages live in a `zh-CN` / `en-US` catalog. English component routes prefer `docs/index.en.md` and fall back to an API-first English shell when no translated source fragment exists.

The theme continues to extend VitePress DefaultTheme. A full rewrite is rejected for now because it would reimplement local search integration, accessible navigation, mobile drawers, outline behavior, dark mode, and previous/next routing while providing no corresponding reuse advantage. Customization remains isolated in theme components, CSS tokens, and the site configuration module, so consumers can replace presentation incrementally without replacing the stable layout runtime.

## Rollback

Route content generation is isolated in `scripts/component-routes.mts` and can be rolled back independently from component source. It is a pure read-only transform over the component manifest and optional source Markdown, so it never writes or overwrites documentation pages.

ConfigTable runtime changes are isolated behind additive props, column fields, emits, and the opt-in settings control. Removing those additions restores the previous behavior; the shared HeadlessTable helpers remain compatible with their existing consumer.

The playground is isolated behind one Demo toolbar action and one standalone route. Removing the action and route restores the previous documentation behavior; the hardened compiler remains a compatible replacement for the former inline loader adapter.
