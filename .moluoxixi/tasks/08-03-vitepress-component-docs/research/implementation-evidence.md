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
