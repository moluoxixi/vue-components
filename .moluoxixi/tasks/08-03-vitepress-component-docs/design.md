# Design

## Architecture

The documentation remains a VitePress package under `docs/vitepress`. Component prose and demos remain next to component source under `packages/components/src/*/docs/index.md`; route bridge files continue to include those documents.

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

Markdown pages import contract JSON through a small shared VitePress data loader instead of embedding arrays. Prose and examples stay handwritten, preserving the requested ownership split. Examples are optional for API rendering, so a newly documented public component may begin with an API-only page.

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
- Generated API files are build artifacts and remain ignored by git.

## Rollback

The existing include-based Markdown routing is preserved, so theme/API generation can be rolled back independently from component source. No runtime component behavior or public package contract is changed.
