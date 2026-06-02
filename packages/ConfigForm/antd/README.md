# AntdConfigForm

`@moluoxixi/config-form-antd-vue` 提供基于 Ant Design Vue 的轻量配置表单。

它复用 `defineField` / `defineFields` 的字段配置协议，使用 `AForm` / `AFormItem` / `ARow` 渲染表单，grid 布局下再用 `ACol` 消费 `span`；不接入 schema、runtime plugin 或自定义 FormItem。

Ant Design Vue 字段默认使用 `value` + `update:value` 写回模型；`Switch`、`Checkbox` 这类 checked 协议组件由包内 adapter 自动映射到 `checked` + `update:checked`。

## 布局

`inline` 布局只使用 Ant Design Vue `ARow`，顶层字段不包 `ACol`，因此不会消费 `span` 或 `colProps`；grid 布局使用 `ARow + ACol`，字段 `span` 和 `colProps` 按 Ant Design Vue `ColProps` 生效。
