# Upstream provenance

The custom layout and visual system in `src/upstream/vitepress` are a one-time
source copy from the Element Plus documentation site.

- Repository: <https://github.com/element-plus/element-plus>
- Commit: `c2a63a79be394b1a73a8dcff505260dbc9a34a33`
- License: MIT, reproduced in `THIRD_PARTY_NOTICES.md`

## Copied source map

| Element Plus path at the pinned commit | Package path | Local boundary |
| --- | --- | --- |
| `docs/.vitepress/vitepress/components/**` | `src/upstream/vitepress/components/**` | Layout templates are copied; imports, consumer identity, links, icons, and locale access are adapted. |
| `docs/.vitepress/vitepress/composables/**` | `src/upstream/vitepress/composables/**` | Navigation, sidebar, outline, search, appearance, and page behavior are copied; repository, locale, and site data now come from VitePress theme config. |
| `docs/.vitepress/vitepress/styles/**` | `src/upstream/vitepress/styles/**` | The 21 SCSS source files are copied without redesign, apart from moving VitePress compatibility imports out of `code.scss`, and compiled into the package CSS. |
| `docs/.vitepress/vitepress/constant.ts` | `src/upstream/vitepress/constant.ts` | Copied constants, with consumer-specific values removed from callers. |
| `docs/.vitepress/vitepress/types.ts` | `src/upstream/vitepress/types.ts` | Copied internal theme types. |
| `docs/.vitepress/vitepress/utils/**` | `src/upstream/vitepress/utils/**` | Copied browser utilities with package-local import adjustments where required. |

A blob comparison against the pinned tree identified 81 mapped files in the
initial import: 40 exact copies and 41 adapted copies. Package-owned config,
runtime wrappers, route helpers, tests, and `src/i18n/**` are local code, not
claimed as verbatim upstream files. The local i18n files normalize the
upstream component message shapes into a two-locale runtime map.

## Adaptations and exclusions

- Monorepo-only imports are replaced by published Element Plus and VitePress
  dependencies. `src/runtime/theme.ts` is the package integration boundary,
  and `src/runtime/vitepress-compat.ts` is the only module that imports
  VitePress theme compatibility subpaths.
- The upstream Element Plus DocSearch implementation is replaced by
  VitePress's local-or-Algolia search component. This removes Element Plus
  Algolia credentials and issue-report links while preserving configured
  VitePress search behavior.
- The upstream Element Plus footer data is replaced by consumer-neutral
  framework and community links; official Element Plus identity and URLs are
  not shipped as defaults.
- Official repository, preview deployment, and Playground URL rewriting are
  removed. Repository and edit-link values come from consumer configuration.
- The upstream `VPApp` behavior that unregisters every Service Worker on the
  current origin is removed because a reusable theme must not alter a
  consumer's PWA registrations.
- Official logos, sponsor data, analytics, Algolia credentials, documentation
  content, and other site identity assets are not copied or rendered as
  defaults. Source-faithful SCSS may retain inert upstream class or token names.
- Locale routing and Element Plus locale injection are package adapters in
  `site-locale.ts` and `src/runtime/element-plus-docs-layout.ts`.

This first version intentionally has no automatic upstream synchronization.
