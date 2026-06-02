# ShadcnConfigForm

`ShadcnConfigForm` 是 components 包内置的 shadcn-vue 轻量配置表单壳。

shadcn-vue 组件通常由业务项目生成到本地目录，所以本组件不导入任何生成组件路径；调用方通过字段 `component` 传入本地 `Input`、`NativeSelect`、`Textarea` 等组件即可。

字段默认使用 `modelValue` + `update:modelValue` 写回模型。带 `label` 的字段会渲染本地 label/error 壳；无 `label` 字段和容器节点不会生成 FormItem。
