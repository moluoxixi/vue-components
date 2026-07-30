---
"@moluoxixi/components": minor
"@moluoxixi/config-form": minor
"@moluoxixi/config-form-headless": patch
"@moluoxixi/config-form-core": patch
"@moluoxixi/config-form-antd-vue": patch
"@moluoxixi/config-form-element": patch
"@moluoxixi/config-form-shadcn-vue": patch
"@moluoxixi/config-form-plugin-antd-vue": patch
"@moluoxixi/config-form-plugin-element-plus": patch
"@moluoxixi/config-form-plugin-shadcn-vue": patch
---

Fix ConfigForm runtime validation, readonly aliases, async Zod support, functional component adaptation, and Vue peer/external boundaries for runtime adapters. Extract the reusable field protocol, node utilities, and model controller into `@moluoxixi/config-form-headless`; keep `config-form-core` as a compatibility entry. Add locally implemented, plugin-free Element Plus and Ant Design Vue ConfigForm entries to `@moluoxixi/components`, with their headless API exposed through the package.
