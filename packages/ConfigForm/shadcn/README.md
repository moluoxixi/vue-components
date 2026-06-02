# ShadcnConfigForm

`@moluoxixi/config-form-shadcn-vue` 提供面向 shadcn-vue 本地组件的轻量配置表单壳。

shadcn-vue 组件通常由业务项目生成到本地目录，所以本组件不导入任何生成组件路径；调用方通过字段 `component` 传入本地 `Input`、`NativeSelect`、`Textarea` 等组件即可。

字段默认使用 `modelValue` + `update:modelValue` 写回模型。带 `label` 的字段会渲染本地 label/error 壳；无 `label` 字段和容器节点不会生成 FormItem。

## 布局

`inline` 布局使用 flex 行容器，顶层字段不生成 grid cell；grid 布局使用 24 列 grid cell，字段 `span` 和 `colProps` 只在 grid 布局下生效。
