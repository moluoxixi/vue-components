# Documentation Theme and Reuse

The documentation site uses the standalone `@moluoxixi/vitepress-theme-element-plus` package for its complete Element Plus-style VitePress theme. The package builds on VitePress's stable layout runtime and owns navigation, sidebars, mobile menus, page outlines, dark mode, document pagination, NotFound behavior, and reusable Demo, Playground, and ApiDocs content runtime. The component library keeps only its site configuration, component catalog, prose, examples, and project data.

## Adopt it in another component library

1. Install the theme package and import `defineElementPlusDocs` from its root entry. Keep one configuration object in `.vitepress/config.ts` for the brand, logo, consumer styles, repository, public routes, and locales.
2. Export `elementPlusDocsTheme` directly from `.vitepress/theme/index.ts`. When the site must register local components or Vue plugins, use `createElementPlusDocsTheme({ enhanceApp })` from the same root entry. The theme entry and the configuration factory from step one must be used together so consumer styles can be injected.
3. Maintain the target library's component catalog and content in the consumer. Register `Demo`, `Playground`, `ApiDocs`, and catalog content through `createElementPlusDocsContent`, then enable the Demo container with `@moluoxixi/vitepress-theme-element-plus/markdown`. The consumer supplies only allowed runtime modules, starter source, generated API JSON, and project metadata; GitHub synchronization and API extraction remain consumer-owned.
4. Declare each locale's language tag, VitePress site key, and URL prefix separately. For example, Chinese can use `zh-CN`, `root`, and an empty prefix while English uses `en-US`, `en`, and `/en`; the theme does not infer routes from language tags.
5. Run the theme package type check, tests, build, and neutral fixture build before running the target documentation site's tests and production build.

Normal `dev` and `build` commands remain offline and consume the committed `.vitepress/github-metadata.json`, but first validate repository identity, manifest coverage, component paths, and the snapshot structure. Missing data cannot silently render as zero. The explicit sync command accepts `GITHUB_TOKEN`, pins the configured branch head, follows pagination, excludes pull requests, and only replaces the previous snapshot after a complete successful run.

API names, types, and descriptions remain owned by the extracted source contract instead of being duplicated in Markdown. Theme controls and generated page shells are fully bilingual. Locale source documents and source JSDoc can be translated incrementally by component authors.

## Maintenance boundary

The theme package is the single source of truth for layout, Element Plus installation, base styles, Demo/Playground/ApiDocs runtime, and shared interactions. Consumers own site identity, component content, and project data. Version one is a fixed copy of a recorded Element Plus documentation-theme commit; subsequent changes are maintained in the standalone package without automatic upstream tracking or per-site theme copies.
