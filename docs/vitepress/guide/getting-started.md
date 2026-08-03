# 快速开始

## 安装

```bash
pnpm add @moluoxixi/components element-plus ant-design-vue @tanstack/vue-query zod
```

组件包的请求型组件使用 Vue Query；根入口同时导出 Element Plus 与 Ant Design Vue 适配组件，因此这些 peer dependencies 需要由应用安装。

## 注册基础依赖

```ts
// main.ts
import { VueQueryPlugin } from '@tanstack/vue-query'
import ElementPlus from 'element-plus'
import { createApp } from 'vue'
import App from './App.vue'
import 'element-plus/dist/index.css'
import '@moluoxixi/components/styles'

const app = createApp(App)
app.use(ElementPlus)
app.use(VueQueryPlugin)
app.mount('#app')
```

## 按需使用

在单文件组件中直接导入所需组件：

```vue
<script setup lang="ts">
import { ConfigTable, CopyText, DateRangePicker } from '@moluoxixi/components'
</script>

<template>
  <CopyText text="MX Components" />
</template>
```

也可以注册为应用级组件：

```ts
import { ConfigTable, CopyText, DateRangePicker } from '@moluoxixi/components'

app.component('ConfigTable', ConfigTable)
app.component('CopyText', CopyText)
app.component('DateRangePicker', DateRangePicker)
```

## 版本要求

| 依赖 | 最低版本 |
|------|---------|
| Vue | `^3.5.0` |
| Element Plus | `^2.9.0` |
| TanStack Vue Query | `^5.0.0` |
| Node | `>=22.0.0` |
