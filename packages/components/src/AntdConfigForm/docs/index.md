# AntdConfigForm

面向 Ant Design Vue 字段绑定的配置化表单。组件基于共享的 headless controller 与原生表单渲染器，支持字段配置、校验、条件显示、只读渲染和表单状态管理。

字段通过 `fields` 定义，表单值通过 `v-model` 管理。组件保留 Ant Design Vue 的 `value`、`checked` 等字段绑定约定，并使用原生 CSS Grid/Flex 组织布局。
