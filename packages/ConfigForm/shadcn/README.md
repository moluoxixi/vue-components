# ShadcnConfigForm

`@moluoxixi/config-form-shadcn-vue` 是面向业务侧 shadcn-vue 本地组件的轻量配置表单壳。

shadcn-vue 组件通常生成在业务项目中，因此本包不导入固定组件路径。调用方通过字段 `component` 传入 Input、NativeSelect、Textarea 等本地组件；默认绑定协议为 `modelValue` + `update:modelValue`。

根节点、Grid/Flex、field/label/control/error 壳与递归节点统一由 `@moluoxixi/config-form` renderer 生成。校验、reset、submit 和 readonly 由 `@moluoxixi/config-form-headless` 提供，支持 `required`、Zod `schema`、异步 `validator`、动态 `readonly` 以及字段级/表单级 `readonlyRender`。`validateOn` 控制 change/blur 校验触发且 submit 校验始终启用；适配器同时透传独立的 dirty/touched 状态、`metaChange`、默认 slot `meta` 及 `getMeta` / `getFieldMeta` / `setTouched`。

`formAttrs` 只接收原生 form attributes。inline 布局使用 Flex；grid 默认使用 24 列 CSS Grid，可通过 `columns`、`gap`、`fieldSpan`、字段 `span` 和原生 `cellAttrs` 调整。
