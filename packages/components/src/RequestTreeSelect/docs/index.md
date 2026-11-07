# RequestTreeSelect

封装 Element Plus `ElTreeSelect` 的远程数据树形选择器，自动处理请求和加载状态。

## 基础用法

:::demo 传入返回树形数据的 `query` 函数，组件自动填充树节点。

```vue
<script setup lang="ts">
import { RequestTreeSelect } from '@moluoxixi/components'
import { ref } from 'vue'

interface DepartmentNode {
  value: number
  label: string
  children?: DepartmentNode[]
}

const value = ref<number | null>(null)

async function queryDeptTree(): Promise<DepartmentNode[]> {
  await new Promise<void>(resolve => setTimeout(resolve, 200))
  return [
    {
      value: 1,
      label: '总公司',
      children: [
        {
          value: 2,
          label: '技术部',
          children: [
            { value: 4, label: '前端组' },
            { value: 5, label: '后端组' },
          ],
        },
        { value: 3, label: '产品部' },
      ],
    },
  ]
}
</script>
<template>
  <RequestTreeSelect v-model="value" :query="queryDeptTree" placeholder="请选择部门" style="width:240px;" />
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

底层为 `ElTreeSelect`，请求数组绑定到 `data`。默认字段通常为 `value/label/children`；自定义字段请通过底层组件的 `props` 映射，树形/级联数据应保留 children 层级。clearable、filterable、multiple、placeholder 等未声明属性及相应底层事件按 attrs 透传；当前包装层没有转发自定义插槽。

远程搜索需要把输入更新到 params；filterable 本身不等同于服务端搜索。父级条件清空时，业务应同时清空当前选中值并暂停请求，避免保留失效选择。禁用控件时，用外层 tooltip 解释依赖条件；enabled=false 只影响请求。

通过 node-key 指定稳定节点标识；check-strictly 控制是否允许父节点独立选择。多选时 v-model 使用数组，初始化回显依赖选中节点存在于 data 中。懒加载或未加载节点回显需由业务补充对应数据。
