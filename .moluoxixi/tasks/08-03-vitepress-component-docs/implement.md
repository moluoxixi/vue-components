# Implementation Plan

1. Recover the task state and load frontend/spec guidance.
2. Replace the direct `vue-component-meta` script with `@moluoxixi/ai-doc-assistant` contract extraction.
3. Add a shared VitePress API data loader and migrate all 11 component Markdown pages from handwritten API arrays to generated data.
4. Correct and complete the handwritten demos and prose using component tests/playground examples as evidence.
5. Refine the custom theme, overview routes, static assets, tooltip accessibility, demo controls, and responsive behavior.
6. Run AI assistant tests, repository type checks/tests as appropriate, API extraction, and VitePress production build.
7. Start a local VitePress server and validate overview/component routes at desktop and mobile widths in the in-app browser.

## Validation Commands

```powershell
pnpm --filter @moluoxixi/ai-doc-assistant test
pnpm build
pnpm typecheck
pnpm --filter @moluoxixi/docs extract-api
pnpm --filter @moluoxixi/docs build
pnpm --filter @moluoxixi/docs exec vitepress dev --host 127.0.0.1 --port 5174
```

## Risk And Rollback Points

- Contract mapping: inspect generated JSON before migrating all pages.
- Dynamic SFC compilation: validate one simple, one request-backed, and RichTextEditor demo before broad browser smoke.
- Layout: compare desktop and mobile screenshots before finalizing global CSS.
- Existing user changes remain in place; only task-scoped files are edited.
