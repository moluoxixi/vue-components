# Design

## Architecture

The documentation remains a VitePress package under `docs/vitepress`. Component prose and demos remain next to component source under `packages/components/src/*/docs/index.md`. Those source documents are optional fragments: one VitePress dynamic route template expands the component manifest into `/components/<slug>` pages, includes a fragment when present, and always appends the generated API section. No component route mirror is written under the documentation source tree.

The custom theme extends VitePress DefaultTheme and owns four presentation components:

- `Demo.vue`: browser-compiles documented SFC examples and provides preview/copy/source/error states.
- `ApiTable.vue`: renders one generated contract section.
- `TypeCell.vue`: renders compact type text with an accessible expanded-type tooltip.
- `OverviewCard.vue`: renders the shared overview card grid used by the home and component overview routes.

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
- Generated API files remain ignored build artifacts. Component routes are expanded in memory from the manifest and a single tracked dynamic route template; the component overview is a tracked internal route rewritten to `/components/`.

## GitHub Metadata

GitHub data is synchronized explicitly into a committed snapshot; normal dev and build commands remain offline and deterministic. The synchronizer fixes a repository head SHA, follows REST pagination, fetches open issues once, excludes pull requests, and attributes issues by the `[ComponentName]` title prefix used by the issue link. Component commits are queried by component source path. The same commit set produces both the component contributor projection and the complete changelog timeline.

The snapshot records its schema version, repository identity, default branch, head SHA, generation time, repository issue count, component issue count, contributors, profiles, and commits. A failed or rate-limited sync never replaces the last valid snapshot.

The route shell always appends generated API documentation and the current component's contributors after optional handwritten content. Changelog history is owned by the fixed page metadata component and opens in an accessible, responsive Element Plus dialog, so long commit histories do not expand the document outline or page length.

## Internationalization And Reuse

Repository URL, package name, source root, route prefixes, locale settings, and GitHub attribution rules live in one documentation site configuration module. Locale-neutral component identifiers remain in the component manifest; display labels and custom-theme messages live in a `zh-CN` / `en-US` catalog. English component routes prefer `docs/index.en.md` and fall back to an API-first English shell when no translated source fragment exists.

The theme continues to extend VitePress DefaultTheme. A full rewrite is rejected for now because it would reimplement local search integration, accessible navigation, mobile drawers, outline behavior, dark mode, and previous/next routing while providing no corresponding reuse advantage. Customization remains isolated in theme components, CSS tokens, and the site configuration module, so consumers can replace presentation incrementally without replacing the stable layout runtime.

## Rollback

Route content generation is isolated in `scripts/component-routes.mts` and can be rolled back independently from component source. It is a pure read-only transform over the component manifest and optional source Markdown, so it never writes or overwrites documentation pages. No runtime component behavior or public package contract is changed.
