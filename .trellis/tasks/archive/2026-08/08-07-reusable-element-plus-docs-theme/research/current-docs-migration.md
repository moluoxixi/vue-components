# Current Documentation Migration Evidence

- Before this task, `docs/vitepress/.vitepress/theme/index.ts` extended `DefaultTheme`, imported Element Plus and current-package CSS, and registered Demo/API/overview/metadata/Playground components. The migrated entry now uses the reusable package and registers those consumer components through its extension point.
- `DocsLayout.vue` only wraps `DefaultTheme.Layout` with locale-aware `ElConfigProvider`; replacing DefaultTheme therefore requires a full layout rather than a wrapper change.
- `config.ts` relies on DefaultTheme-compatible nav, sidebar, local search, outline, prev/next, last-updated, locale, and social-link config.
- Before this task, `styles/index.css` coupled to `.VPNavBar`, `.VPSidebar`, `.VPContent`, `.VPDoc`, `.VPPage`, `.vp-doc`, and `--vp-*` variables while also styling project-specific API, Demo, metadata, changelog, contributor, and overview features. The migrated stylesheet retains only consumer feature styles and uses the package's `.doc-content`/`.page-content` layout contract and Element Plus-derived variables.
- Component routes are generated from one catalog and always append API and contributor content. Chinese and English route templates share this contract.
- Demo and Playground share a hardened browser SFC compiler with explicit modules, unique virtual files, style cleanup, runtime errors, and stale-result protection.
- GitHub metadata is explicitly synchronized into a committed offline snapshot and validated against repository identity, component catalog, and source paths during ordinary builds.
- Migration must add regression coverage for behavior previously supplied implicitly by DefaultTheme: local search, mobile navigation/focus, outline synchronization, frontmatter layout branches, appearance, NotFound, and prev/next routing.
- Package convention evidence: a new package under `packages/*` automatically enters root build/release scope; Vue packages use Vite library mode, Vue plugin, `unplugin-dts`, ESM exports, `vue-tsc`, Vitest, peer externalization, and public publish config.

Key local files:

- `docs/vitepress/.vitepress/theme/index.ts`
- `docs/vitepress/.vitepress/theme/DocsLayout.vue`
- `docs/vitepress/.vitepress/config.ts`
- `docs/vitepress/.vitepress/theme/styles/index.css`
- `docs/vitepress/scripts/component-routes.mts`
- `docs/vitepress/.vitepress/docs-site.ts`
- `docs/vitepress/.vitepress/docs-i18n.ts`
- `docs/vitepress/package.json`
- `packages/components/vite.config.ts`
- `packages/hooks/package.json`
