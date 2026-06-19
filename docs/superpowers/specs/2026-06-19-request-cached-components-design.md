# Request Cached Components Design

## 背景

当前 `@moluoxixi/components` 已提供 `ConfigTable`、`PopoverTableSelect` 等
Element Plus 辅助组件，但数据仍由调用方在外部拉取后传入。用户希望基于虚拟
下拉、级联、树选和现有表格选择能力，封装一组“传入 `query` 与 `params`
即可获得接口缓存”的组件。

本仓已有 `@moluoxixi/hooks`，其设计原则是基于 TanStack Query 管理服务端
状态，并由宿主应用通过 `VueQueryPlugin` 提供唯一 `QueryClient`。新请求能力
应放在 `packages/hooks`，组件包只消费 hook 并负责 UI 适配。

## 已确认事实与来源

- `packages/components/src/index.ts` 是 `@moluoxixi/components` 的统一导出入口。
- `packages/components/src/ConfigTable` 已有列渲染、动态插槽、空态与单元格事件测试。
- `packages/components/src/PopoverTableSelect` 已有输入触发、弹层表格、键盘选择和滚动到底加载能力。
- `packages/hooks` 已声明 `@tanstack/vue-query` peer dependency，并要求宿主提供唯一 `QueryClient`。
- `packages/hooks/src/composables/useListPage/useListPage.ts` 已用分页、过滤条件和 `normalizeQueryKey` 组成缓存键。
- TanStack Query Vue 官方文档支持 `VueQueryPlugin` 注入自定义 `QueryClient`、`useQuery` 的响应式 `queryKey`、`enabled` 和 `staleTime`。
- 用户已确认缓存前提为：消费方安装 `VueQueryPlugin` 并提供唯一 `QueryClient`，组件内部使用 `useQuery`。
- 用户已确认请求 hook 放在 `packages/hooks`，`packages/components` 只消费 hook。
- 初始检查发现 `docs/map.md` 引用了 `docs/components/index.md` 和 `docs/components/ElementPlus.md` 但磁盘缺失；本次实现补齐 `docs/components` 消费文档，避免继续保留该断链。

## 目标

- 新增通用请求缓存 hook：`useRequestOptions` 和 `useRequestTable`。
- 新增三个选项类请求组件：`RequestSelectV2`、`RequestCascader`、`RequestTreeSelect`。
- 为 `ConfigTable` 增加可选 `query`、`params` 和分页能力，保留原静态 `data` 模式。
- 为 `PopoverTableSelect` 增加可选 `query`、`params` 和分页能力，保留现有输入、选择和旧 `loadMore` 行为。
- 统一把 `params` 作为缓存键核心；表格类再追加 `currentPage` 和 `pageSize`。
- Vue 3.5+ 双向绑定优先使用 `defineModel`。

## 非目标

- 不在组件库内部创建 `QueryClient`。
- 不支持接口原始响应自动转换；选项类 `query` 固定返回数组，表格类 `query` 固定返回 `{ data, total }`。
- 不把 `query` 函数本身放入缓存键。
- 不自动弹出错误 toast；错误只通过状态和事件暴露。
- 不在本轮重做 `ConfigTable` 的列系统、虚拟滚动或服务端排序。
- 不把外部组件库消费文档缺失伪装为已通过；该缺口仅作为文档治理 `MISSING` 暴露。

## 推荐方案

采用“共享请求核心 + 组件轻包装”。

1. `packages/hooks`
   - 新增 `useRequestOptions`，处理选项数组请求、缓存键、加载态、错误态、手动刷新。
   - 新增 `useRequestTable`，处理表格分页请求、缓存键、受控/非受控分页、参数变化回到第一页。
   - 继续复用 `normalizeQueryKey` 和现有 TanStack Query 测试工具。

2. `packages/components`
   - `RequestSelectV2` 包装 `ElSelectV2`。
   - `RequestCascader` 包装 `ElCascader`。
   - `RequestTreeSelect` 包装 `ElTreeSelect`。
   - `ConfigTable` 只在传入 `query` 时进入请求模式；未传 `query` 时仍使用原 `data`。
   - `PopoverTableSelect` 复用 `useRequestTable`，把请求结果传给内部弹层表格。

3. 依赖方向
   - `@moluoxixi/components` 通过 `dependencies` 依赖 `@moluoxixi/hooks`。
   - `@moluoxixi/hooks` 继续把 `@tanstack/vue-query` 作为 peer dependency。
   - `@moluoxixi/components` 的请求组件对外要求宿主安装 `@tanstack/vue-query` 并注册 `VueQueryPlugin`；实现若不直接 import `@tanstack/vue-query`，不重复声明 direct peer dependency，只在 README 和组件文档写明该运行前提。若实现阶段发现组件包需要直接 import TanStack Query 类型或运行时代码，再把 `@tanstack/vue-query` 作为 `peerDependencies` 加到 `packages/components/package.json`。

## Hook 契约

辅助类型来源：

- `QueryKeyBase` 与 `normalizeQueryKey` 来自 `packages/hooks/src/types/common.ts` 和 `packages/hooks/src/utils/query-key.ts`。
- `MaybeRefOrGetter`、`ComputedRef`、`Ref` 来自 Vue。
- `UseQueryReturnType` 来自 `@tanstack/vue-query`。
- `ConfigTablePaginationProps` 是本设计新增的组件侧分页配置类型，至少覆盖 `ElPagination` 常用 props：`layout`、`pageSizes`、`background`、`small`、`hideOnSinglePage`。
- `RequestTableQuery<Row, Params>` 是表格类 `query` 的公共别名。

```ts
export interface UseRequestOptionsOptions<
  Option,
  Params extends Record<string, unknown> = Record<string, unknown>,
> {
  queryKey: QueryKeyBase
  query: (params: Params) => Promise<Option[]>
  params?: MaybeRefOrGetter<Params>
  enabled?: MaybeRefOrGetter<boolean>
  staleTime?: number
}

export interface UseRequestOptionsReturn<Option> {
  options: ComputedRef<Option[]>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<Error | null>
  refetch: () => Promise<unknown>
  query: UseQueryReturnType<Option[], Error>
}
```

```ts
export interface RequestTablePageParams {
  currentPage: number
  pageSize: number
}

export interface RequestTableResult<Row> {
  data: Row[]
  total: number
}

export type RequestTableQuery<
  Row,
  Params extends Record<string, unknown> = Record<string, unknown>,
> = (params: Params & RequestTablePageParams) => Promise<RequestTableResult<Row>>

export interface UseRequestTableOptions<
  Row,
  Params extends Record<string, unknown> = Record<string, unknown>,
> {
  queryKey: QueryKeyBase
  query: RequestTableQuery<Row, Params>
  params?: MaybeRefOrGetter<Params>
  currentPage?: MaybeRefOrGetter<number>
  pageSize?: MaybeRefOrGetter<number>
  defaultCurrentPage?: number
  defaultPageSize?: number
  resetPageOnParamsChange?: boolean
  enabled?: MaybeRefOrGetter<boolean>
  staleTime?: number
}

export interface UseRequestTableReturn<Row> {
  data: ComputedRef<Row[]>
  total: ComputedRef<number>
  currentPage: Ref<number>
  pageSize: Ref<number>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<Error | null>
  setCurrentPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  refetch: () => Promise<unknown>
  query: UseQueryReturnType<RequestTableResult<Row>, Error>
}
```

## 组件契约

公共请求 props：

```text
query: (params: Params) => Promise<Result>
params?: Params
cacheKey?: QueryKeyBase
enabled?: boolean
staleTime?: number
```

选项类组件：

- `RequestSelectV2`、`RequestCascader`、`RequestTreeSelect` 的主值使用 `defineModel`。
- `query(params)` 固定返回 `Promise<Option[]>`。
- 默认把返回数组绑定到 `ElSelectV2` / `ElCascader` 的 `options`，以及 `ElTreeSelect` 的 `data`。
- 透传底层 Element Plus 组件的常用 props、attrs 和事件。
- `defineExpose({ refetch })` 暴露手动刷新。
- 额外事件：`loaded(options)`、`error(error)`。

表格类组件：

- `ConfigTable` 新增 `query?: RequestTableQuery`、`params?: Params`、`pagination?: boolean | ConfigTablePaginationProps`。
- `ConfigTable` 分页使用 `defineModel<number>('currentPage')` 和 `defineModel<number>('pageSize')`，默认 `1 / 10`。
- `ConfigTable` 不传 `query` 时保留现有 `data` 静态模式；传 `query` 时以请求结果为准。
- `PopoverTableSelect` 保留现有 `defineModel<boolean>()` 控制弹层可见，继续使用 `defineModel<string>('inputValue')`；新增分页同样使用 `defineModel<number>('currentPage')` 和 `defineModel<number>('pageSize')`。
- `PopoverTableSelect` 的新分页模式优先于旧 `enableLoadMore/loadMore`，但旧增量加载事件保持兼容。
- 额外事件：`loaded(result)`、`error(error)`、`pageChange({ currentPage, pageSize })`。

## 分页行为

`pagination` 只控制内置分页 UI 是否渲染，不改变表格类 `query` 入参形状。
只要传入 `query`，组件都会把 `currentPage` 与 `pageSize` 合并进请求参数和缓存键。

| 组件 | 场景 | 内置分页 UI | 请求参数 | 缓存键 | 行为 |
|---|---|---|---|---|---|
| `ConfigTable` | 未传 `query`，`pagination` 未传 | 不渲染 | N/A | N/A | 完全保持现有静态 `data` 模式。 |
| `ConfigTable` | 未传 `query`，`pagination=true/props` | 渲染 | N/A | N/A | 前端只展示分页控件并通过 `defineModel` 写回页码；不自动切片 `data`。 |
| `ConfigTable` | 传 `query`，`pagination` 未传 | 渲染 | `{ ...params, currentPage, pageSize }` | `params + currentPage + pageSize` | 请求模式默认显示分页，初始 `1 / 10`。 |
| `ConfigTable` | 传 `query`，`pagination=false` | 不渲染 | `{ ...params, currentPage, pageSize }` | `params + currentPage + pageSize` | 隐藏内置分页；调用方仍可用 `v-model:current-page/page-size` 外置分页。 |
| `PopoverTableSelect` | 未传 `query` | 不新增分页 UI | N/A | N/A | 保持现有 `data` 与 `enableLoadMore/loadMore` 语义。 |
| `PopoverTableSelect` | 传 `query`，`pagination` 未传 | 渲染在弹层表格下方 | `{ ...params, currentPage, pageSize }` | `params + currentPage + pageSize` | 请求模式默认分页，旧 `loadMore` 不自动翻页。 |
| `PopoverTableSelect` | 传 `query`，`pagination=false` | 不渲染 | `{ ...params, currentPage, pageSize }` | `params + currentPage + pageSize` | 可继续使用旧 `enableLoadMore/loadMore` 事件做外部增量加载，但组件不自动合并旧页数据。 |

分页写回规则：

- `currentPage` 默认值为 `1`，`pageSize` 默认值为 `10`。
- `currentPage` 与 `pageSize` 都通过 `defineModel` 支持受控和非受控。
- `pageSize` 变化时重置 `currentPage` 为 `1`。
- `params` 变化时默认重置 `currentPage` 为 `1`；`resetPageOnParamsChange=false` 时保留当前页。
- 页码或页大小变化后触发 `pageChange({ currentPage, pageSize })`。
- `PopoverTableSelect` 在 `query` 分页模式下不会把滚动到底自动解释为下一页，避免与页码分页重复请求。

## 缓存键规则

- 选项类：`[...normalizeQueryKey(cacheKey ?? componentName), params]`。
- 表格类：`[...normalizeQueryKey(cacheKey ?? componentName), params, { currentPage, pageSize }]`。
- `params` 必须可稳定序列化；不得传函数、组件实例、DOM、循环引用对象等不可作为缓存键的值。
- `query` 不进入缓存键；同页多处相同组件需要隔离时使用 `cacheKey`。
- `params` 变化时默认回到第一页；提供 `resetPageOnParamsChange?: boolean`，默认 `true`。

## 状态与错误处理

- 首次加载使用 `isLoading`，后台刷新使用 `isFetching`。
- 选项类 loading 绑定到底层组件 loading 能力。
- `ConfigTable` 请求模式下，空态文案区分加载中、错误和暂无数据；不破坏原 `empty` 插槽优先级。
- `PopoverTableSelect` 请求模式下，弹层表格沿用现有 loading 和空态反馈。
- 请求失败不吞错；触发 `error`，并保留 `error` 状态供调用方读取。
- `loaded` 只在请求成功且数据进入组件后触发。

## 测试策略

`packages/hooks`：

- `useRequestOptions` 覆盖 `params` 进入 key、缓存命中、禁用/启用、成功数据、失败错误、手动 `refetch`。
- `useRequestTable` 覆盖 `params + currentPage + pageSize` 进入 key、分页切换触发新请求、`params` 变化默认回第一页、受控/非受控分页状态写回。

`packages/components`：

- `RequestSelectV2`、`RequestCascader`、`RequestTreeSelect` 覆盖请求结果绑定到底层 `options/data`、loading/error、`defineModel` 写回。
- `ConfigTable` 覆盖静态 `data` 模式不破坏、`query` 模式使用请求数据、分页渲染、`v-model:current-page` 和 `v-model:page-size` 写回。
- `PopoverTableSelect` 覆盖原输入/选择/弹层行为不破坏、请求数据送入弹层表格、分页事件与旧 `loadMore` 边界。

建议验证命令：

```bash
pnpm --filter @moluoxixi/hooks test
pnpm --filter @moluoxixi/components test
pnpm --filter @moluoxixi/hooks typecheck
pnpm --filter @moluoxixi/components typecheck
```

风险较高或改动完成准备发布时再运行：

```bash
pnpm build
```

## 文档更新范围

- 更新 `packages/hooks` 导出和 README。
- 更新 `packages/components/README.md`。
- 新增或更新 `docs/out-components/RequestSelectV2.md`。
- 新增或更新 `docs/out-components/RequestCascader.md`。
- 新增或更新 `docs/out-components/RequestTreeSelect.md`。
- 新增或更新 `docs/out-components/ConfigTable.md`。
- 更新 `docs/out-components/PopoverTableSelect.md`。
- 更新 `docs/out-components/index.md` 和 `docs/map.md`。

## 风险与待确认

- 已处理 external component docs：本次实现补齐 `docs/components/index.md`、`docs/components/ElementPlus.md`、`docs/components/AntDesignVue.md`、`docs/components/ShadcnVue.md`、`docs/components/UnpluginVueComponents.md`。
- `@moluoxixi/components` 新增 `@moluoxixi/hooks` 依赖会扩大发布依赖面，需要在 changeset 中说明。
- Element Plus `ElTreeSelect` 的数据 prop 名称与 `ElSelectV2` / `ElCascader` 不一致，实现时要用适配层收敛。
- `params` 的稳定性依赖调用方传入可序列化数据；文档必须明确该约束。
