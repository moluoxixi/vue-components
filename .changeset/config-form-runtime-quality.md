---
"@moluoxixi/components": minor
"@moluoxixi/config-form": minor
"@moluoxixi/config-form-headless": minor
"@moluoxixi/config-form-core": minor
"@moluoxixi/config-form-antd-vue": minor
"@moluoxixi/config-form-element": minor
"@moluoxixi/config-form-plugin-antd-vue": patch
"@moluoxixi/config-form-plugin-element-plus": patch
"@moluoxixi/config-form-devtools-vite-plugin": patch
---

Expand `@moluoxixi/config-form-headless` into the shared Vue headless light-form kernel with required/Zod/custom validation, normalized errors, stale-safe async validation and submit snapshots, dynamic reset defaults, readonly, and readonlyRender. Add a shared Vue DOM renderer at `@moluoxixi/config-form/renderer` for native form, Grid/Flex, recursive nodes, field shells, ARIA, binding presets, and controlled expose APIs while retaining the root Runtime/Plugin route for schema and UI plugins. Move the standalone Element Plus, Ant Design Vue, and `@moluoxixi/components` ConfigForm implementations to thin adapters over that renderer, without UI-library Form/FormItem/Row/Col components. Add `@moluoxixi/config-form-designer-antd-vue` as an independent visual-designer adapter with real Ant Design Vue materials, option resolution, default-value controls, readonly rendering, responsive layouts, and localized setters. Rename DOM passthrough APIs to `formAttrs`, `layoutAttrs`, `cellAttrs`, and `fieldAttrs`, including their public adapter type aliases, and deprecate the generic `withInstall` export from headless. Track reset-baseline dirty/touched metadata independently from `validateOn`, expose it through `metaChange`, slot `meta`, `getMeta`, `getFieldMeta`, and `setTouched`, and add `data-dirty` / `data-touched` hooks to renderer form and field DOM. Breaking: remove the unsupported `@moluoxixi/config-form-shadcn-vue` and `@moluoxixi/config-form-plugin-shadcn-vue` packages in favor of adapters backed by stable upstream Vue component contracts.
