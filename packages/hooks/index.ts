/**
 * @moluoxixi/hooks
 *
 * 基于 TanStack Query 的 CRUD 场景化请求 / 状态一体化 Hooks。
 *
 * 设计原则：
 * - 传输无关：所有数据读写通过业务传入的 fetcher / submit / operate 函数完成，不绑定任何 HTTP 客户端。
 * - 状态内聚：分页 / 过滤 / 选中等场景状态收敛在 Hook 内部，业务层只消费暴露的契约。
 * - 单一 QueryClient：宿主应用通过 VueQueryPlugin 提供唯一 QueryClient，本包不创建实例。
 */
export {
  useBatchOperate,
  useDetailPage,
  useFormSubmit,
  useListPage,
} from './src/composables'

export type * from './src/types'

export {
  invalidateQueryKeys,
  normalizeQueryKey,
} from './src/utils'
