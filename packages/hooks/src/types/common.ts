import type { MaybeRefOrGetter } from 'vue'

/**
 * 查询键基段类型。
 *
 * 业务侧通常传入字符串（资源名）或数组（资源名 + 维度），
 * 内部会归一化为数组并追加分页 / 过滤 / 主键等动态片段。
 */
export type QueryKeyBase = string | readonly unknown[]

/**
 * 受控分页状态。
 *
 * page 从 1 开始计数，与服务端常见分页语义一致；
 * pageSize 表示单页条数。
 */
export interface PaginationState {
  page: number
  pageSize: number
}

/**
 * 列表请求入参。
 *
 * 由分页状态与业务过滤条件组合而成，传给业务方实现的 fetcher。
 */
export interface ListQueryParams<TFilter extends Record<string, unknown> = Record<string, unknown>> {
  pagination: PaginationState
  filters: TFilter
}

/**
 * 列表请求标准返回结构。
 *
 * list 为当前页数据，total 为符合过滤条件的总记录数，用于驱动分页器。
 */
export interface ListResult<TItem> {
  list: TItem[]
  total: number
}

/**
 * 请求表格分页参数。
 *
 * currentPage 从 1 开始计数；pageSize 表示单页条数。
 */
export interface RequestTablePageParams {
  currentPage: number
  pageSize: number
}

/**
 * 请求表格标准返回结构。
 *
 * data 是当前页数据，total 是符合当前 params 的总记录数。
 */
export interface RequestTableResult<TItem> {
  data: TItem[]
  total: number
}

/**
 * 请求表格数据函数。
 *
 * 业务 params 与分页参数平铺合并，便于直接传给常见后端接口。
 */
export type RequestTableQuery<
  TItem,
  TParams extends Record<string, unknown> = Record<string, unknown>,
> = (params: TParams & RequestTablePageParams) => Promise<RequestTableResult<TItem>>

/**
 * 表单提交模式。
 *
 * create 表示新增，update 表示编辑；由是否存在主键自动推断，也可显式指定。
 */
export type SubmitMode = 'create' | 'update'

/**
 * 失效目标查询键集合。
 *
 * 变更类操作成功后，用于声明需要让哪些查询缓存失效以触发重新拉取。
 */
export type InvalidateKeys = MaybeRefOrGetter<QueryKeyBase[]>
