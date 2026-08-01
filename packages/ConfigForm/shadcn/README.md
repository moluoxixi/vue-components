# ShadcnConfigForm

`@moluoxixi/config-form-shadcn-vue` 是面向业务侧 shadcn-vue 本地组件的轻量配置表单壳。

shadcn-vue 组件通常生成在业务项目中，因此本包不导入固定组件路径。调用方通过字段 `component` 传入 Input、NativeSelect、Textarea 等本地组件；默认绑定协议为 `modelValue` + `update:modelValue`。

根节点使用原生 `<form>`，字段节点使用本包自有 field/label/control/error 壳，容器节点只负责递归渲染。校验、reset、submit 和 readonly 由 `@moluoxixi/config-form-headless` 提供，支持 `required`、Zod `schema`、异步 `validator`、动态 `readonly` 以及字段级/表单级 `readonlyRender`。

`formProps` 只接收原生 form attributes。inline 布局使用 flex；grid 布局使用 24 列 grid，并在该模式下消费 `span` 和 `colProps`。
