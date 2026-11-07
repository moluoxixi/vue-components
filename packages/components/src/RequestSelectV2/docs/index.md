# RequestSelectV2

封装 Element Plus `ElSelectV2` 的远程数据选择器，自动处理请求、加载状态与错误上报。

## 基础用法

:::demo 传入 `query` 异步函数，组件自动发起请求并填充选项。

```vue
<script setup lang="ts">
import { RequestSelectV2 } from '@moluoxixi/components'
import { ref } from 'vue'

interface UserOption {
  value: number
  label: string
}

const value = ref<number | null>(null)

async function queryUsers(): Promise<UserOption[]> {
  // 模拟远程请求
  await new Promise<void>(resolve => setTimeout(resolve, 300))
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

interface ItemOption {
  value: number
  label: string
}

const value = ref<number | null>(null)
const enabled = ref<boolean>(false)

async function queryItems(): Promise<ItemOption[]> {
  await new Promise<void>(resolve => setTimeout(resolve, 200))
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

## 请求与缓存契约

使用前需在应用安装 `VueQueryPlugin` 和 `QueryClient`。query 接收 params 并返回选项数组；接口若返回 `{ data: [...] }`，请先在 query 中提取数组。组件负责加载状态，query 抛出的异常会通过 error 事件上报。

| 配置                               | 默认值与行为                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `query(params)`                    | 必填异步函数，返回数组；不返回分页对象。                                       |
| `params`                           | 默认空对象，响应式变化会重新查询。                                             |
| `enabled`                          | 默认 true；false 暂停自动请求，不等同于禁用控件。                              |
| `cacheKey`                         | 默认按组件实例隔离。显式相同键用于共享同一资源；不同业务资源不能复用同一个键。 |
| `staleTime`                        | 交给 Vue Query 的缓存新鲜时间；按业务刷新需求配置。                            |
| `v-model`                          | 沿用底层组件的单选/多选值约定，不自动变成完整选项对象。                        |
| `loaded(options)` / `error(error)` | 请求成功的选项数组 / 请求异常。                                                |
| `refetch()`                        | 组件 ref 方法；手动重新请求，适合重试或业务数据更新后刷新。                    |

cacheKey 与 query 应在实例生命周期内保持稳定，查询条件通过 params 更新。显式共享缓存时，query、参数含义和结果结构必须一致。后台权限变更后，应主动刷新或失效相关缓存。

## 字段映射与交互边界

底层为 `ElSelectV2`，请求数组绑定到 `options`。默认字段通常为 `value/label`；自定义字段请通过底层组件的 `props` 映射。clearable、filterable、multiple、placeholder 等未声明属性及相应底层事件按 attrs 透传；当前包装层没有转发自定义插槽。

远程搜索需要把输入更新到 params；filterable 本身不等同于服务端搜索。父级条件清空时，业务应同时清空当前选中值并暂停请求，避免保留失效选择。禁用控件时，用外层 tooltip 解释依赖条件；enabled=false 只影响请求。
