# Repository Audit

## Table

- HeadlessTable currently exposes only column/value helpers and a default renderless slot: `packages/components/src/HeadlessTable/src/index.vue:273` and `:282`.
- Current cell rendering is inline default slot, named default slot, renderer, formatter, then raw value: `packages/components/src/HeadlessTable/src/index.vue:137-203`.
- Stable row identity already exists in `useHeadlessTable` through required `getRowId`: `packages/components/src/HeadlessTable/src/types/state.ts:39`.
- ConfigTable is an independent Element Plus adapter rather than a HeadlessTable wrapper: `packages/components/src/ConfigTable/src/index.vue:106` and `src/composables/use-config-table-renderer.ts:264`.
- ConfigTable's generated fallback row key is row-index based and cannot back mode overrides: `packages/components/src/ConfigTable/src/composables/use-config-table-data.ts:11-44`.

## Reuse

- Three Request* components already consume `useRequestOptionsComponent`: `packages/components/src/request/composables/use-request-options-component.ts:10`.
- `@moluoxixi/hooks` already publicly owns the generic `useRequestOptions` name: `packages/hooks/src/composables/useRequestOptions/useRequestOptions.ts:11`.
- ConfigTable and PopoverTableSelect duplicate request-table setup and loaded/error watchers: `packages/components/src/ConfigTable/src/composables/use-config-table-data.ts:19` and `packages/components/src/PopoverTableSelect/src/composables/use-popover-table-select-request.ts:21`.
- HeadlessCopyText owns reusable state around framework-neutral `copyText`: `packages/components/src/HeadlessCopyText/src/index.vue:22` and `packages/components/src/utils/clipboard.ts:16`.

## Package and ConfigForm boundaries

- Components declares all Tiptap dependencies although only RichTextEditor uses them: `packages/components/package.json:137-150` and `packages/components/src/RichTextEditor/src/index.vue:30-34`.
- Element Plus and Ant Design Vue designer resolver watch lifecycles are equivalent: `packages/ConfigForm/designer-element-plus/src/options/resolve.ts:16-77` and `packages/ConfigForm/designer-antd-vue/src/options/resolve.ts:15-76`.
- Headless controller recomputes reactions after `commitFieldValue` when same-operation validation calls `getFieldStates`: `packages/ConfigForm/headless/src/controller.ts:289-317` and `:528-537`.

## Tooling

- CI serially runs typecheck, test, coverage, and build, while root scripts rebuild packages across those stages: `.github/workflows/ci.yml:34-50` and `package.json:27-33`.
- Existing browser scripts are not in CI: `package.json:31-32`, `packages/ai-doc-assistant/package.json:49`, `packages/vitepress-theme-element-plus/package.json:55`, and `packages/vite-config/package.json:36`.
- Publishable packages use complex exports and files lists, but package verification is currently specialized: `packages/components/package.json:14-116` and `scripts/verify-config-form-adapter-packages.mjs:257-337`.
