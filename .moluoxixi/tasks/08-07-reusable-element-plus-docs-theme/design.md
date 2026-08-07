# Technical Design

## Architecture

Create `packages/vitepress-theme-element-plus` as a publishable ESM workspace package named `@moluoxixi/vitepress-theme-element-plus`. It owns the reusable documentation framework: the custom VitePress runtime theme, the Element Plus-derived layout and visual system, browser-safe VitePress configuration assembly, route helpers, and typed configuration. Consumer-specific documentation applications remain outside the theme package.

The package has one public package entry. Internal modules remain separated so browser runtime code, browser-safe config code, route helpers, and copied upstream code do not become one implementation unit:

```text
packages/vitepress-theme-element-plus/
  index.ts
  src/
    config/       # browser-safe option validation and VitePress/Vite/Markdown assembly
    runtime/      # Theme, Layout, navigation, sidebar, outline, search, dark mode
    routes/       # component path and generated-page helpers
    styles/       # Element Plus-derived docs styles and compiled UnoCSS output
    upstream/     # copied Element Plus docs-theme source retained by provenance
  fixtures/basic/
  LICENSE
  THIRD_PARTY_NOTICES.md
  UPSTREAM.md
```

The copied Element Plus source is based on commit `c2a63a79be394b1a73a8dcff505260dbc9a34a33`. The package does not contain an automated upstream-sync workflow. `UPSTREAM.md` records the repository, commit, copied-path-to-adaptation mapping, excluded assets, and adaptations; `THIRD_PARTY_NOTICES.md` carries the Element Plus and any copied VitePress MIT notices. The package declares `license: MIT` and ships its package-level `LICENSE`. Element Plus logos, sponsors, analytics credentials, Algolia credentials, and other official-site identity are excluded.

## Public Contract

The root entry exports all supported values and types; no `./runtime`, `./styles`, or feature subpath is public:

```ts
export { elementPlusDocsTheme } from './src/runtime/theme'
export { defineElementPlusDocs } from './src/config/define-element-plus-docs'
export { createComponentPaths, renderComponentPage } from './src/routes'
export type {
  ElementPlusDocsOptions,
  ElementPlusDocsThemeConfig,
  DocsComponent,
  DocsLocale,
} from './src/types'
```

The JavaScript root facade and every module it statically re-exports are browser-resolvable and may not import `node:*`, filesystem/network code, `@moluoxixi/ai-doc-assistant`, or Node-only Vite tooling. API extraction, GitHub snapshot synchronization, and snapshot validation remain consumer-owned commands and are not public theme-package imports. Package tests scan the built browser facade and dependency graph for forbidden Node imports.

VitePress still has two host integration files, but both import from the same package entry:

```ts
// .vitepress/config.ts
import { defineElementPlusDocs } from '@moluoxixi/vitepress-theme-element-plus'

export default defineElementPlusDocs({ /* consumer identity and paths */ })

// .vitepress/theme/index.ts
export { elementPlusDocsTheme as default } from '@moluoxixi/vitepress-theme-element-plus'
```

`defineElementPlusDocs(options)` validates and normalizes one consumer-owned configuration object, then returns the VitePress user config with browser-safe Markdown and Vite plugins. Serializable runtime fields are placed in `themeConfig`; plugin state stays inside each config instance's closures. Consumer-owned filesystem extraction and network/snapshot operations execute through consumer lifecycle scripts before VitePress starts. There is no process-global mutable configuration, so multiple fixture/config builds cannot leak state.

The supported option groups are:

- `site`: title, site title, logo, base, locales, and default locale.
- `repository`: URL, owner, name, default branch, issue and edit-link behavior.
- `components`: optional consumer styles import and typed component catalog.
- `routes`: guide, overview, component, and playground route prefixes.
- `search`: local search by default, or explicit Algolia credentials.
- `vitepress`: controlled pass-through for supported VitePress head, Markdown, Vite, and theme settings.

The contract exposes only behavior implemented by the theme. Missing required theme identity or inconsistent locale mappings fail with field-specific diagnostics. API extraction, demos, playgrounds, GitHub snapshots, contributors, and changelog rendering are consumer capabilities connected through `createElementPlusDocsTheme({ enhanceApp })`, Markdown/Vite pass-through, or ordinary content components; there are no theme feature flags for them.

## Runtime Theme

The runtime theme uses the copied Element Plus `VPApp` architecture as its layout root and does not import or extend `DefaultTheme.Layout`. It owns:

- desktop and mobile navigation;
- desktop and mobile sidebar behavior;
- document/page/home layout branches;
- page outline synchronization;
- previous/next navigation and last-updated rendering;
- locale and appearance controls;
- local or Algolia search;
- NotFound, skip links, focus management, and route progress;
- Element Plus-style Markdown, code-group, demo, API, and table surfaces.

Small utilities currently imported by Element Plus from VitePress internal paths are copied or replaced locally where practical. Any unavoidable VitePress deep import is isolated in one compatibility module and covered by the fixture build. The package supports the repository's pinned VitePress 1.6.4 baseline; widening the peer range requires fixture verification.

Element Plus styles are loaded from published package paths rather than monorepo-relative SCSS:

```ts
import 'normalize.css'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
```

The theme then loads its compiled upstream-derived styles. Consumer component CSS is declared in `options.components.styles`. The runtime imports the fixed module id `virtual:moluoxixi-element-plus-docs-consumer-styles`; a plugin created per `defineElementPlusDocs` call resolves it to an internal null-prefixed id and loads configured static imports, or an empty module when no styles are configured. The plugin is registered before other consumer Vite plugins and holds all state in its config-instance closure so concurrent builds cannot cross-contaminate. Unit tests instantiate two configs with different style imports; the fixture verifies SSR resolution.

UnoCSS utilities and icon components are allowed only in package-owned copied/runtime templates. The package build scans those sources and emits complete distributable CSS and bundled icons. Consumer Markdown, slots, and examples do not receive implicit UnoCSS processing and must use ordinary CSS/classes unless they explicitly add their own tooling. No consumer build imports `uno.css` or a package-owned UnoCSS virtual module.

## Consumer Documentation Features

The existing Demo, SFC compiler, Playground, API, overview, metadata, contributor, and changelog components remain owned by the current documentation application. They are project content and data workflows, not a portable visual-theme contract. The consumer registers them through `createElementPlusDocsTheme({ enhanceApp })` and configures Markdown/Vite plugins through the `vitepress` pass-through.

Browser-safe route rendering helpers are exported from the same root entry. Consumer route files may use those helpers without copying theme layout code. Existing `@moluoxixi/ai-doc-assistant`, API extraction, and GitHub snapshot validation/synchronization remain consumer lifecycle commands and never enter the theme package's root/browser dependency graph.

The current site remains responsible for handwritten component prose, examples, repository identity, generated API data, and committed GitHub snapshots. Those are consumer content/data, not theme implementation.

## Package Build And Dependencies

The package follows existing workspace conventions: Vite library build, Vue plugin, `unplugin-dts`, ESM output, `vue-tsc` type checking, Vitest, `publishConfig.access = public`, and a root `exports['.']` with `source`, `types`, and `import` conditions.

`vue`, `vitepress`, and `element-plus` are peer dependencies and matching dev dependencies. Version one supports the repository baseline VitePress 1.6.4 and verifies Element Plus 2.13.7; VitePress compatibility is not widened while deep compatibility code remains. Runtime libraries required by the shipped theme, such as `@vueuse/core`, `normalize.css`, and `nprogress`, are regular dependencies.

The package library build uses the workspace Vite 6 toolchain, while consumer plugins execute inside VitePress 1.6.4's Vite 5.4.14 runtime. Plugin contracts use a small structural compatibility type in the browser-safe config facade rather than exporting Vite 6 plugin types. `vite` is not a runtime dependency and both fixture/current-docs production builds are required to exercise the actual VitePress host. The package build externalizes peers and Node built-ins while bundling package-owned Vue components and generated CSS.

The root workspace build automatically includes this package because it lives under `packages/*`. The basic fixture consumes the built package through its public package entry and contains no MX Components-specific imports or theme source copies.

## Current Site Migration

`docs/vitepress/.vitepress/config.ts` becomes the single consumer theme configuration. Existing site identity, localization, navigation/sidebar data, route helpers, Markdown plugins, and Vite plugins are referenced by that typed options object. The package takes ownership of the layout and global visual framework; current-site files retain project content, feature components, and data workflows.

Migration must preserve:

- dynamic Chinese and English component routes;
- local search, outline, previous/next, dark mode, mobile navigation, and accessibility;
- all registered Markdown components;
- component API extraction and failure behavior;
- Demo/Playground behavior and tests;
- offline GitHub metadata validation, issue counts, contributors, and changelogs;
- current public URLs and route rewrites.

After migration, `docs/vitepress/.vitepress/theme` may contain the root public theme extension plus consumer-specific components and content styles. It must not retain a parallel Layout or copied global theme implementation.

## Validation

Validation is layered:

1. Package unit tests cover option validation, config normalization, navigation/sidebar helpers, and locale/search state.
2. Package type checking and library build verify the single public entry and CSS output.
3. The brand-neutral fixture verifies SSR/build compatibility and package-only consumption without consumer-specific documentation components.
4. Configuration tests verify missing theme identity and invalid locale mappings fail clearly.
5. Existing docs unit tests verify consumer-owned routes, i18n, API, GitHub metadata, Demo, and Playground behavior after theme migration.
6. The current docs is the consumer-integration fixture; its production build verifies both locales, all generated pages, and site-specific extensions.
7. Playwright checks both fixtures as appropriate and covers desktop/mobile plus light/dark navigation, sidebar, outline, search, representative component pages, demos, dialogs, and console errors.

## Risks And Rollback

- Removing DefaultTheme replaces behavior that was previously implicit. Search, mobile focus handling, outline synchronization, page frontmatter branches, and NotFound require explicit regression coverage before old theme code is removed.
- The upstream source contains Element Plus site assumptions and VitePress deep imports. Each hard-coded URL, asset, internal workspace import, and virtual module must either become configuration, local implementation, or an intentionally documented dependency.
- A single public entry contains runtime and browser-safe config exports. Node-only consumer lifecycle work stays outside the package; artifact scanning and fixture builds are release gates for that boundary.
- The current style file contains both framework and project-specific styles. Migration separates upstream-derived theme styles from current-site feature/content styles before deleting the old copy.

Implementation proceeds through validated checkpoints: package scaffold, neutral fixture, core layout, consumer extension integration, current-site cutover, then old-layout deletion. Before cutover, the current docs remain on the existing theme. Implementation records the initial `git status --short`, task-file set, and diffs for overlapping user-modified files. Rollback edits only task-owned changes from the last validated checkpoint; it never uses destructive reset/checkout and never restores over pre-existing user changes.
