# RequestSelectV2

封装 Element Plus `ElSelectV2` 的远程数据选择器，自动处理请求、加载状态与错误上报。

## 基础用法

:::demo 传入 `query` 异步函数，组件自动发起请求并填充选项。
```vue
<script setup lang="ts">
import { RequestSelectV2 } from '@moluoxixi/components'
import { ref } from 'vue'
const value = ref(null)

async function queryUsers() {
  // 模拟远程请求
  await new Promise(r => setTimeout(r, 300))
  return [
    { value: 1, label: '张三' },
    { value: 2, label: '李四' },
    { value: 3, label: '王五' },
    { value: 4, label: '赵六' },
  ]
}
</script>
<template>
  <RequestSelectV2
    v-model="value"
    :query="queryUsers"
    cache-key="request-select-users-demo"
    placeholder="请选择用户"
    style="width:240px;"
  />
</template>
```
:::

## 条件加载

:::demo `enabled` 为 `false` 时不发起请求，可用于条件渲染场景。
```vue
<script setup lang="ts">
import { RequestSelectV2 } from '@moluoxixi/components'
import { ElSwitch } from 'element-plus'
import { ref } from 'vue'
const value = ref(null)
const enabled = ref(false)

async function queryItems() {
  await new Promise(r => setTimeout(r, 200))
  return Array.from({ length: 5 }, (_, i) => ({ value: i, label: `选项 ${i + 1}` }))
}
</script>
<template>
  <div style="display:flex;flex-direction:column;gap:12px;">
    <ElSwitch v-model="enabled" active-text="启用请求" />
    <RequestSelectV2
      v-model="value"
      :query="queryItems"
      :enabled="enabled"
      cache-key="request-select-items-demo"
      placeholder="请选择"
      style="width:240px;"
    />
  </div>
</template>
```
:::
