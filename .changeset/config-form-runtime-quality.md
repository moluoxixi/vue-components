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

Fix ConfigForm runtime validation, readonly aliases, async Zod support, functional component adaptation, and Vue peer/external boundaries for runtime adapters. Expand `@moluoxixi/config-form-headless` into the shared light-form kernel with required/Zod/custom validation, normalized errors, async validation lifecycle, submit/reset, readonly, and readonlyRender. Keep `config-form-core` as a compatibility entry. Move the standalone Element Plus, Ant Design Vue, and shadcn-vue ConfigForm packages to the headless controller with native form shells, and synchronize the independent Element/Antd implementations in `@moluoxixi/components`.
