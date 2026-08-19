# Implementation Evidence

## Existing Documentation Architecture

- VitePress theme wiring: `docs/vitepress/.vitepress/theme/index.ts:15`.
- Demo container parsing: `docs/vitepress/.vitepress/plugins/demo.ts:10`.
- Dynamic SFC module cache: `docs/vitepress/.vitepress/theme/components/Demo.vue:45`.
- Eleven route bridge files include colocated component docs under `packages/components/src/*/docs/index.md`.

## AI Contract Source

- Public `ServerContext` export: `packages/ai-doc-assistant/index.ts:36`.
- Contract build/get flow: `packages/ai-doc-assistant/src/server/context.ts:155` and `:203`.
- Props/emits/slots/expose contract shapes: `packages/ai-doc-assistant/src/core/types.ts:10`, `:55`, `:69`, `:88`, and `:96`.
- The component public entry extracts 13 contracts in this repository. Package tests pass: 24 files / 179 tests.
- The built-in `renderSearchableDoc` omits attrs/exposed, so VitePress must normalize `ComponentContract` directly.

## Known Defects To Correct

- Missing `/logo.svg` and `/favicon.ico`: `docs/vitepress/.vitepress/config.ts:10` and `docs/vitepress/index.md:8`.
- Dayjs is absent from demo module cache while imported by DateRangePicker docs: `Demo.vue:46` and `DateRangePicker/docs/index.md:47`.
- ConfigTable remote response is `{ data, total }`: `packages/hooks/src/types/common.ts:57`; current docs use `{ list, total }`.
- ConfigTable defaults originate at `packages/components/src/ConfigTable/src/index.vue:31`.
- PopoverTableSelect `popType` is `'default' | 'input'`: `packages/components/src/PopoverTableSelect/src/types/props.ts:9`.
- Current TypeCell tooltip is hover-only: `docs/vitepress/.vitepress/theme/components/TypeCell.vue:9`.
- Current API extraction catches and suppresses each failure: `docs/vitepress/scripts/extract-api.mts:61`.

## Example Sources

- Playground examples: `playgrounds/components-playground/src/examples/`.
- Component tests: `packages/components/src/*/__tests__/`.
- HeadlessTable guidance: `packages/components/src/HeadlessTable/README.md:8`.
- Request component query behavior: `packages/components/src/RequestOptions/__tests__/RequestOptions.test.ts:115`.

## Final Verification (2026-08-04)

- `pnpm exec eslint docs/vitepress/.vitepress docs/vitepress/scripts docs/vitepress/routes docs/vitepress/en` passed with generated `api`, `cache`, and `dist` directories ignored.
- `pnpm --filter @moluoxixi/docs test` passed: 5 files and 30 tests, including route, locale, type-detail, API-output, pagination, branch, contributor-policy, and snapshot-validation coverage.
- `pnpm typecheck` passed for all selected workspace packages and playgrounds.
- `pnpm --filter @moluoxixi/docs validate-github-metadata` validated 13 components at fixed head `a3bb24a01605eb1ca64c04f80fd025a513c8983b`.
- `pnpm --filter @moluoxixi/docs build` passed API extraction for all 13 public components, client/server bundling, and SSR page rendering.
- In-app browser desktop check at 1440 x 900: the sidebar is fixed at 252px, the outline column is fixed at 256px, and the document content occupies the remaining width without page overflow.
- Chinese `AntdConfigForm`: real open-issue count 1, 16 component-scoped commits, and 1 avatar-only component contributor.
- English `CopyText`: English navigation, generated shell, API controls, contributor labels, dates, and 3 component-scoped commits.
- Mobile check at 390 x 844: the document viewport had no page-level horizontal overflow and API tables remained available.
- Overview check: all 13 public components were visible from `/`; browser console warnings/errors were empty.
- Type and contributor tooltips were verified with complete details and without horizontal or vertical overflow in their rendered content.

## Changelog Dialog Verification (2026-08-04)

- The component route generator no longer emits a changelog heading or timeline in the document body. It always appends generated API documentation followed by the current component's contributors.
- `AntdConfigForm` exposes `更新日志 16` in the fixed header metadata. The action opens an Element Plus dialog containing 16 component-scoped commits with message, author, localized date, SHA, and GitHub link.
- The dialog title exposes level-two heading semantics. The dialog closes with `Escape`, restores focus to the changelog trigger with a visible 2px brand focus ring, and keeps `aria-expanded` synchronized.
- At 390 x 844, the dialog measured 358px wide with 16px viewport gutters, no page/dialog horizontal overflow, and an internal `auto` scroll region for the 1438px commit timeline.
- The English route renders `AntdConfigForm changelog`, `Close`, and locale-formatted dates such as `Aug 4, 2026`.
- A clean browser tab after restarting the VitePress dynamic-route server reported no console warnings or errors; the page outline contained API and contributors but no changelog section.
- Final checks passed: documentation ESLint, 5 Vitest files / 30 tests, all-workspace `pnpm typecheck`, deterministic 13-component API extraction, GitHub snapshot validation at `a3bb24a`, and the VitePress production build.
