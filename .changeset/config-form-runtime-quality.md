---
"@moluoxixi/components": minor
"@moluoxixi/config-form": minor
"@moluoxixi/config-form-headless": minor
"@moluoxixi/config-form-core": minor
"@moluoxixi/config-form-antd-vue": minor
"@moluoxixi/config-form-element": minor
"@moluoxixi/config-form-shadcn-vue": minor
"@moluoxixi/config-form-plugin-antd-vue": patch
"@moluoxixi/config-form-plugin-element-plus": patch
"@moluoxixi/config-form-plugin-shadcn-vue": patch
"@moluoxixi/config-form-devtools-vite-plugin": patch
---

Expand `@moluoxixi/config-form-headless` into the shared light-form kernel with required/Zod/custom validation, normalized errors, stale-safe async validation and submit snapshots, dynamic reset defaults, readonly, and readonlyRender. Add a shared Vue DOM renderer in `@moluoxixi/config-form` for native form, Grid/Flex, recursive nodes, field shells, ARIA, binding presets, and controlled expose APIs. Move the standalone Element Plus, Ant Design Vue, shadcn-vue, and `@moluoxixi/components` ConfigForm implementations to thin adapters over that renderer, without UI-library Form/FormItem/Row/Col components.
