# @moluoxixi/hooks

基于 Vue 3 与 TanStack Query 的 CRUD 场景化组合式函数。包只管理查询、提交、分页、筛选和选择状态，实际网络请求由业务传入，不绑定 Axios、Fetch 或具体后端协议。

## 安装与初始化

```ts
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.use(VueQueryPlugin, { queryClient: new QueryClient() })
app.mount('#app')
```

所有 hook 都必须在安装了 `VueQueryPlugin` 的组件 `setup()` 中调用。本包复用宿主的唯一 `QueryClient`，不会创建隐藏实例。

## Hook 一览

| Hook                | 用途                                             |
| ------------------- | ------------------------------------------------ |
| `useRequestOptions` | 按响应式参数请求下拉、级联等选项并复用查询缓存   |
| `useRequestTable`   | 管理请求表格的参数、页码、页长、查询状态与缓存键 |
| `useListPage`       | 管理通用列表页的分页、筛选、总页数与重置动作     |
| `useDetailPage`     | 根据响应式主键加载详情，空主键时不发起请求       |
| `useFormSubmit`     | 根据主键自动区分新增/编辑，成功后刷新关联查询    |
| `useBatchOperate`   | 管理选中项并执行批量操作，成功后刷新关联查询     |

## 请求表格

```ts
import { useRequestTable } from '@moluoxixi/hooks'
import { ref } from 'vue'

const filters = ref({ keyword: '' })
const table = useRequestTable({
  queryKey: 'users',
  params: filters,
  query: async ({ currentPage, pageSize, keyword }) => {
    return fetchUsers({ currentPage, pageSize, keyword })
  },
})

table.setCurrentPage(2)
table.setPageSize(20)
```

`params` 深度变化时默认回到第 1 页；设置 `resetPageOnParamsChange: false` 可保留当前页。`currentPage` 和 `pageSize` 可以传入 Ref，由调用方与 hook 共享同一状态。

## 表单提交与批量操作

```ts
import { useBatchOperate, useFormSubmit } from '@moluoxixi/hooks'

const form = useFormSubmit({
  submit: ({ mode, id, values }) => (mode === 'create' ? createUser(values) : updateUser(id!, values)),
  invalidateKeys: ['users'],
})

await form.submit({ name: 'Alice' })
await form.submit({ name: 'Bob' }, 'user-2')

const batch = useBatchOperate({
  operate: ({ keys }) => disableUsers(keys),
  invalidateKeys: ['users'],
})

batch.setSelection(['user-1', 'user-2'])
await batch.execute()
```

mutation 成功后会先等待所有关联查询失效，再执行 `onSuccess`。批量操作默认在成功后清空选择；失败时保留选择，便于重试。

## Query key 工具

根入口同时导出：

- `normalizeQueryKey`：将字符串或数组 query key 统一为数组。
- `invalidateQueryKeys`：并行等待多个 query key 的 `invalidateQueries`。

所有请求函数的错误会由 TanStack Query 状态返回，`mutateAsync`/`execute` 的 rejection 也会继续向调用方传播，不会静默吞掉。
