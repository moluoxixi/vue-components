# RequestCascader 组件文档

## 用途

`RequestCascader` 封装 Element Plus `ElCascader`，接收业务传入的 `query(params)` 拉取级联选项，并通过 TanStack Query 缓存接口结果。组件来源为 `packages/components/src/RequestCascader`。

## 引入

```ts
import { RequestCascader } from '@moluoxixi/components'
```

宿主应用必须先安装 `VueQueryPlugin` 并提供唯一 `QueryClient`。

## Props

| 名称 | 类型 | 默认值 | 必填 | 说明 |
|---|---|---|---|---|
| query | `(params) => Promise<Record<string, any>[]>` | 无 | 是 | 级联选项请求函数。 |
| params | `Record<string, unknown>` | `{}` | 否 | 请求参数，同时作为缓存 key 的一部分。 |
| cacheKey | `QueryKeyBase` | `RequestCascader` | 否 | 查询 key 前缀。 |
| enabled | `boolean` | `true` | 否 | 是否自动请求。 |
| staleTime | `number` | `undefined` | 否 | 透传给 TanStack Query 的数据新鲜时间。 |
| v-model | `unknown` | `undefined` | 否 | 透传给 `ElCascader` 的选中值。 |

其它属性通过 `v-bind="$attrs"` 透传给 `ElCascader`。

## 事件与暴露

| 名称 | 触发时机 |
|---|---|
| loaded | 请求成功并获得选项数组时触发。 |
| error | 请求失败时触发原始 `Error`。 |
| refetch | 组件实例暴露方法，手动重新请求。 |

## 状态

- `params` 变化会生成新的查询 key 并命中或发起对应缓存请求。
- `params` 必须是稳定、可序列化的普通对象；不要传入函数、DOM、组件实例或循环引用。
- `loading` 由 `isLoading || isFetching` 计算后绑定到 `ElCascader`。
- 组件只负责整组选项请求；按节点懒加载仍应使用 Element Plus 原生 cascader 配置。

## 示例

```vue
<RequestCascader
  v-model="regionPath"
  :params="{ tenantId }"
  :query="loadRegions"
  :props="{ value: 'id', label: 'name', children: 'children' }"
/>
```

## 测试建议

覆盖参数变化后的缓存 key、`v-model` 写回、加载态、错误事件和 `refetch`。

## 变更记录

- 2026-06-19：新增基于接口缓存的 `RequestCascader` 对外契约。
