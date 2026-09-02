# Documentation Structure Supplement

The documentation workspace follows the repository-wide
[directory structure contract](../../directory-structure.md). This document
adds the authoring, generated-content, and VitePress ownership boundaries that
are specific to `docs/vitepress`.

## Scope

This convention applies to `docs/vitepress`. Human-authored content, project
configuration, runtime projections, and reusable theme implementation are
separate ownership boundaries. Directory moves must preserve the public theme
API and the generated-content contract.

## Layout

```text
docs/vitepress/
  zh/                              # committed Chinese authoring pages
  en/                              # committed English authoring pages
  public/                          # committed public assets
  element-plus-docs.config.ts      # consumer project contract
  .vitepress/
    config.ts                      # VitePress-required entry only
    catalog/
      index.ts
      i18n/
      manifests/
    site/
      index.ts
      config/
      plugins/
      repository/
      utils/
    theme/
      index.ts                     # VitePress-required theme entry only
      composables/
      integration/
      __tests__/
  scripts/                         # API and route generation commands
  .generated/                      # ignored lifecycle output
    content/{zh,en}/
    api/
    markdown/
    repository/
    types/
```

## Contracts

- `zh/`, `en/`, package `docs/`, and package README files are authoring
  sources. `.generated/` is runtime output and is never committed.
- `.vitepress/config.ts` and `.vitepress/theme/index.ts` are framework entries;
  they compose current feature barrels and contain no reusable implementation.
- `catalog/`, `site/`, and `theme/` feature roots contain only `index.ts`,
  responsibility directories, and optional `__tests__/`.
- Every responsibility directory has one `index.ts`. Cross-feature imports use
  that barrel; a direct implementation import is allowed only to avoid loading
  browser-only virtual modules in the Node configuration boundary.
- `catalog` owns component/utility identity and localization. `site` owns this
  consumer's configuration, plugins, repository runtime, and generated paths.
  `theme/integration` connects the reusable theme to project-owned packages.
- Provider schemas, Markdown plugins, content projection, and lifecycle logic
  belong to `@moluoxixi/vitepress-theme-element-plus`, not this consumer.
- Removed flat paths are not retained as forwarding modules.

## Validation

| Condition | Required result |
| --- | --- |
| Feature root gains another `.ts` implementation | Move it to the owning responsibility directory |
| Responsibility directory lacks `index.ts` | Add the barrel before exposing the implementation |
| Script imports a removed flat `.vitepress` path | Import the current catalog/site/theme feature barrel |
| Runtime output appears in Git status | Remove it from the index and keep it under `.generated/` |
| Node config imports browser virtual runtime through a broad barrel | Use the narrow responsible barrel or implementation boundary |

## Tests Required

- `scripts/__tests__/docs-source-architecture.test.ts` checks feature roots,
  responsibility barrels, removed flat paths, and stale imports.
- Docs unit tests must import catalog/site contracts through current barrels.
- Directory moves require docs ESLint, unit tests, typecheck, and a lifecycle
  build after workspace content packages are buildable.

## Examples

Good:

```ts
import { getLocalizedComponents } from '../.vitepress/catalog'
import { docsLocales } from '../.vitepress/site/config'
```

Bad:

```ts
import { getLocalizedComponents } from '../.vitepress/catalog/docs-i18n'
import { docsLocales } from '../.vitepress/site/docs-site'
```
