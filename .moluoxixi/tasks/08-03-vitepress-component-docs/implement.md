# Implementation Plan

1. Recover the task state and load frontend/spec guidance.
2. Replace the direct `vue-component-meta` script with `@moluoxixi/ai-doc-assistant` contract extraction.
3. Add a shared VitePress API data loader and expand one dynamic route template for all public components, with optional source docs before an invariant API section.
4. Correct and complete the existing handwritten demos and prose; allow API-only pages when a safe runnable demo is not yet available.
5. Refine the custom theme, overview routes, static assets, tooltip accessibility, demo controls, and responsive behavior.
6. Run AI assistant tests, repository type checks/tests as appropriate, API extraction, and VitePress production build.
7. Start a local VitePress server and validate overview/component routes at desktop and mobile widths in the in-app browser.
8. Add an explicit GitHub metadata synchronizer and committed snapshot for component issues, contributors, and commit history.
9. Add component changelog rendering, locale-aware custom-theme messages, and English route generation.
10. Centralize repository-specific settings and document why the reusable theme keeps VitePress DefaultTheme as its base.
11. Move component changelogs from the generated page body into a responsive header dialog while keeping API documentation and contributors as invariant footer content.
12. Repair root lint/typecheck coverage, add a docs tsconfig/typecheck script, include omitted package tests, and resolve every newly surfaced project error.
13. Extract a hardened documentation SFC compiler and migrate `Demo.vue` to unique entry paths, strict file/module resolution, complete style disposal, runtime error capture, and stale-run protection.
14. Add a stable Demo identifier and an Element Plus-style playground action that transfers source through an ephemeral same-origin session.
15. Add the standalone lazy playground route/component with single-SFC editing, run/reset/copy controls, responsive layout, and compile/runtime diagnostics.
16. Add unit tests for compiler cleanup/session behavior and browser coverage for opening, editing, rerunning, failure recovery, reset, and mobile layout.
17. Add the isolated `@moluoxixi/components/auto-loaders` subpath with `autoComponent` and `autoImport` integrations from one export manifest, keep it out of the root barrel, wire it into VitePress and the component playground, and verify package exports, types, tests, and production consumption.
18. Make every browser-compiled component demo self-contained with explicit runtime imports and add a regression check for unresolved component tags.
19. Extract reusable HeadlessTable renderer resolution and column projection helpers, then adopt them in ConfigTable without changing its pagination or formatter semantics.
20. Add ConfigTable renderer/slot coverage and an opt-in column-settings dialog with draft apply/cancel, drag sorting, keyboard movement, and visibility controls.

## Completion

- Implementation steps 1-20 are complete.
- Root lint, type checking, and the full workspace test suite pass.
- The component package build verifies NodeNext declaration resolution for every public typed entry.
- VitePress API extraction, GitHub metadata validation, unit tests, production builds for both locales, and desktop/mobile browser checks pass.

## Validation Commands

```powershell
pnpm --filter @moluoxixi/ai-doc-assistant test
pnpm build
pnpm typecheck
pnpm --filter @moluoxixi/docs extract-api
pnpm --filter @moluoxixi/docs build
pnpm --filter @moluoxixi/docs typecheck
pnpm exec eslint packages docs/vitepress playgrounds scripts
pnpm test:e2e:components
pnpm --filter @moluoxixi/docs sync-github-metadata
pnpm --filter @moluoxixi/docs exec vitepress dev --host 127.0.0.1 --port 5174
```

## Risk And Rollback Points

- Contract mapping: inspect generated JSON before migrating all pages.
- Dynamic SFC compilation: validate one simple, one request-backed, and RichTextEditor demo before broad browser smoke.
- Layout: compare desktop and mobile screenshots before finalizing global CSS.
- Existing user changes remain in place; only task-scoped files are edited.
