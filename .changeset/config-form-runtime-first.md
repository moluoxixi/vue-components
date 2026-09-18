---
"@moluoxixi/config-form-core": minor
"@moluoxixi/config-form-model": minor
"@moluoxixi/config-form-compiler": minor
"@moluoxixi/config-form-headless": minor
"@moluoxixi/config-form": minor
"@moluoxixi/config-form-vue-backend": minor
"@moluoxixi/config-form-designer": minor
"@moluoxixi/config-form-designer-element-plus": minor
"@moluoxixi/config-form-designer-antd-vue": minor
"@moluoxixi/config-form-element": patch
"@moluoxixi/config-form-antd-vue": patch
"@moluoxixi/config-form-plugin-element-plus": patch
"@moluoxixi/config-form-plugin-antd-vue": patch
"@moluoxixi/config-form-devtools-vite-plugin": patch
---

将 ConfigForm 定型为 Runtime-first 表单方案，完整删除事件编辑、事件转发与 Flow 编排合同，Designer 收敛为 properties 与 validation 两个默认区域。复杂组件事件由宿主在运行时 config 的 `props.onX` 中直接维护；持久化、编译、Preview 与 Source 合同同步硬切到无事件编排的当前版本。
