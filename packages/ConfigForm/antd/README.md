# AntdConfigForm

`@moluoxixi/config-form-antd-vue` 提供基于 Ant Design Vue 的轻量配置表单。

它复用 `defineField` / `defineFields` 的字段配置协议，使用 `AForm` / `AFormItem` / `ARow` / `ACol` 渲染表单，不接入 schema、runtime plugin 或自定义 FormItem。

Ant Design Vue 字段默认使用 `value` + `update:value` 写回模型；`Switch`、`Checkbox` 这类组件可以在字段上显式声明 `valueProp: 'checked'` 和 `trigger: 'update:checked'`。
