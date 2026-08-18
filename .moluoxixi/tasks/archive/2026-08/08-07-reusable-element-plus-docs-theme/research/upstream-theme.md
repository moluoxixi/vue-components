# Element Plus Upstream Theme Evidence

Verified on 2026-08-07 against `element-plus/element-plus` commit `c2a63a79be394b1a73a8dcff505260dbc9a34a33`.

- `docs/.vitepress/theme/index.ts` installs Element Plus, sets `Layout: VPApp`, registers global documentation components, and hooks route progress. It does not extend VitePress `DefaultTheme`.
- `docs/.vitepress/vitepress/index.ts` imports Normalize, Element Plus `theme-chalk` source, dark variables, custom styles, and UnoCSS.
- The reusable runtime source spans `docs/.vitepress/theme`, `docs/.vitepress/vitepress`, and selected utilities. The `vitepress` directory contains roughly 228 files and includes layout components, composables, styles, globals, and site-specific features.
- Upstream dependencies include VitePress 1.6.4, Vue, Element Plus, VueUse, Normalize, NProgress, DocSearch, UnoCSS, icons, and code-group plugins.
- Version-sensitive imports include VitePress deep utilities and default-theme CSS paths.
- Non-reusable assumptions include Element Plus monorepo-relative `packages/theme-chalk` imports, internal `@element-plus/*` packages, official logo/assets, sponsors, analytics, Algolia identity, repository URLs, and playground URLs.
- `@element-plus/docs` is private, but the repository is MIT licensed. Substantial copied code must retain the copyright and permission notice.
- First-version decision: take a one-time source snapshot, record provenance, and do not implement automatic upstream synchronization.

Primary sources:

- https://github.com/element-plus/element-plus/blob/c2a63a79be394b1a73a8dcff505260dbc9a34a33/docs/.vitepress/theme/index.ts
- https://github.com/element-plus/element-plus/blob/c2a63a79be394b1a73a8dcff505260dbc9a34a33/docs/.vitepress/vitepress/index.ts
- https://github.com/element-plus/element-plus/blob/c2a63a79be394b1a73a8dcff505260dbc9a34a33/docs/package.json
- https://github.com/element-plus/element-plus/blob/c2a63a79be394b1a73a8dcff505260dbc9a34a33/LICENSE
