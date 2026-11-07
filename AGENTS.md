## Vue Props 访问规范

本仓库的 Vue 组件、示例和源码生成模板统一使用 `const props = defineProps<...>()`；有默认值时使用 `const props = withDefaults(defineProps<...>(), ...)`。

在 `<script setup>` 和 `<template>` 中读取组件输入时，一律写 `props.xxx`，使组件输入与内部变量清晰区分。保持 props 对象完整，不解构、重命名或创建只用于省略 `props.` 的别名。模板中的循环变量、插槽参数及实际派生状态仍使用各自名称。

修改源码生成器时，同时检查 Vue 源码和 ConfigForm 绑定两种输出，以及随工程生成的辅助组件，确保生成结果遵守同一规范。
