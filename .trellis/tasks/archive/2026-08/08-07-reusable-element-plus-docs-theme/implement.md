# Implementation Plan

## Execution Checklist

1. Load frontend/package guidance and record `git status --short`, task-owned paths, and diffs for overlapping user-modified files in task research. Preserve the existing changes in `ComponentDocMeta.vue`, `DocContributors.vue`, and `TypeCell.vue`, plus all unrelated work.
2. Scaffold `packages/vitepress-theme-element-plus` using the repository's Vue library, DTS, TypeScript, Vitest, exports, peer-dependency, and public-package conventions.
3. Add package `license: MIT`, `LICENSE`, `UPSTREAM.md`, and `THIRD_PARTY_NOTICES.md` for Element Plus commit `c2a63a79be394b1a73a8dcff505260dbc9a34a33` (and VitePress code if copied); map copied paths to adaptations and exclude official branding, sponsors, analytics, and credentials.
4. Copy the Element Plus custom docs layout/runtime source into package-owned internal modules; remove monorepo-relative `theme-chalk`, `@element-plus/*` internal-package, repository URL, logo, sponsor, analytics, and playground hard-coding.
5. Replace VitePress internal utility imports where practical, isolate remaining version-sensitive imports, and load Element Plus/Normalize/dark-mode styles from published package paths.
6. Build package-owned upstream-derived utility classes and icons into distributable assets; define that consumer Markdown/slots receive no implicit UnoCSS processing.
7. Implement the browser-resolvable single-root API: `elementPlusDocsTheme`, `createElementPlusDocsTheme(extension)`, `defineElementPlusDocs(options)`, supported route/render helpers, and public types; prohibit Node-only static imports and add theme-owned option validation/fail-fast diagnostics.
8. Implement custom runtime behavior for nav, sidebar, mobile drawer, document/page layouts, outline, previous/next, last updated, appearance, locale, NotFound, progress, and local/Algolia search without extending `DefaultTheme`.
9. Add a brand-neutral fixture that consumes only the built public entry and verifies desktop/mobile layouts, local search, outline, dark mode, SSR, and production build behavior without consumer-specific documentation components.
10. Keep Demo, SFC compiler, Playground, API, overview, metadata, contributor, and changelog components in the current documentation application; register them through the public theme extension instead of coupling them to package internals.
11. Move browser-safe route rendering and consumer-style integration behind root-entry helpers. Keep Node-only API extraction and GitHub validate/sync in the consumer package, outside the theme browser dependency graph.
12. Convert the current documentation configuration to one `defineElementPlusDocs(options)` object and one root-entry theme extension; keep current repository content, prose, examples, feature components, generated API data, and snapshot data in the consumer package.
13. Add public-contract/config/runtime tests to the theme package and confirm all consumer-owned docs routes, API, Demo, Playground, and metadata tests remain covered.
14. Remove the old parallel Layout and global theme framework CSS only after the current docs and neutral fixture both build against the package; retain consumer content/component styles.
15. Add automated Playwright specs for the basic fixture and current docs, including screenshot baselines and console/hydration/asset/focus/route assertions across desktop/mobile and light/dark modes.
16. Run full package/docs validation and review the final diff for upstream provenance, accidental branding/assets, internal package imports, duplicate theme code, undeclared dependencies, Node imports in browser artifacts, and public subpath leaks.

## Validation Commands

```powershell
pnpm --filter @moluoxixi/vitepress-theme-element-plus typecheck
pnpm --filter @moluoxixi/vitepress-theme-element-plus test
pnpm --filter @moluoxixi/vitepress-theme-element-plus build
pnpm --filter @moluoxixi/vitepress-theme-element-plus test:provenance
pnpm --filter @moluoxixi/vitepress-theme-element-plus build:fixture
pnpm --filter @moluoxixi/vitepress-theme-element-plus test:e2e
pnpm --filter @moluoxixi/docs test
pnpm --filter @moluoxixi/docs typecheck
pnpm --filter @moluoxixi/docs build
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

`build:fixture` must build against the package's `dist` export, with source conditions/aliases disabled. `test:e2e` owns Playwright web servers for the basic fixture and current docs so the command is self-contained.

## Feature Regression Matrix

- Root facade/config: theme-owned config validation unit tests, forbidden-Node artifact scan across JS/CSS, basic fixture build.
- Layout runtime: basic fixture Playwright covers nav, mobile drawer, sidebar, outline, search, appearance, locale, NotFound, and prev/next.
- Routes/i18n: migrated component-route and locale unit tests plus Chinese/English current-doc build.
- API: consumer-owned extractor normalization, missing-component failure, API table rendering, anchors, and expanded type interaction.
- Demo/Playground: compiler cleanup, unknown import, stale run, session transfer, reset/copy/error recovery, and desktop/mobile Playwright.
- GitHub: consumer-owned offline snapshot identity/schema/issues/contributors/commits tests; explicit sync remains outside normal build.
- Metadata UI: issue links, contributor tooltip, changelog dialog focus/close/responsive behavior in Playwright.

## Browser Matrix

- Desktop 1440x900: overview, guide, component page, search, outline, changelog dialog, Demo and Playground.
- Mobile 390x844: navigation drawer, sidebar, search, component metadata, horizontally constrained API/Demo content, and Playground.
- Light and dark appearance for both viewports.
- Screenshot diffs, console errors, hydration warnings, missing assets, unresolved components, focus traps, and route navigation failures are release-blocking.

## Risk Checkpoints

- Checkpoint A: package scaffold and root export build before upstream layout is moved.
- Checkpoint B: neutral fixture renders the upstream-derived layout before current-site cutover.
- Checkpoint C: consumer extension components pass unit tests before current-site theme imports change.
- Checkpoint D: current docs build and browser smoke pass before old theme code is deleted.
- Checkpoint E: full workspace validation and provenance audit after deletion.

Each checkpoint records validation results and the task-owned file set in task research; it does not require an intermediate commit. Rollback uses scoped edits to the task-owned files from the preceding checkpoint, never `reset --hard`, `checkout --`, or restoration over the recorded user-change baseline. No generated API or GitHub snapshot is overwritten without validation.
