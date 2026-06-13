import type { UseMutationReturnType } from '@tanstack/vue-query'
import type { ComputedRef, Ref } from 'vue'
import type { InvalidateKeys } from './common'

/**
 * 批量操作载荷。
 *
 * keys 为当前选中项的主键集合，payload 为可选的附加参数（如目标状态）。
 *
 * @template TKey 选中项主键类型
 * @template TExtra 附加参数类型
 */
export interface BatchPayload<TKey, TExtra = void> {
  keys: TKey[]
  payload: TExtra
}

/**
 * useBatchOperate 配置项。
 *
 * @template TKey 选中项主键类型
 * @template TResult 操作返回类型
 * @template TExtra 附加参数类型
 */
export interface UseBatchOperateOptions<TKey, TResult = unknown, TExtra = void> {
  /** 批量操作处理函数，接收选中主键集合与附加参数。 */
  operate: (payload: BatchPayload<TKey, TExtra>) => Promise<TResult>
  /** 操作成功后需要失效的查询键集合。 */
  invalidateKeys?: InvalidateKeys
  /** 操作成功后是否自动清空选中项，默认 true。 */
  clearSelectionOnSuccess?: boolean
  /** 操作成功回调。 */
  onSuccess?: (result: TResult, payload: BatchPayload<TKey, TExtra>) => void
  /** 操作失败回调。 */
  onError?: (error: Error, payload: BatchPayload<TKey, TExtra>) => void
}

/**
 * useBatchOperate 返回契约。
 *
 * 同时管理「选中态」与「批量变更」，避免业务层重复维护选中集合。
 */
export interface UseBatchOperateReturn<TKey, TResult = unknown, TExtra = void> {
  /** 当前选中的主键集合（只读副本）。 */
  selectedKeys: ComputedRef<TKey[]>
  /** 选中数量。 */
  selectedCount: ComputedRef<number>
  /** 是否存在选中项。 */
  hasSelection: ComputedRef<boolean>
  /** 整体替换选中集合（去重）。 */
  setSelection: (keys: TKey[]) => void
  /** 切换单个主键的选中态。 */
  toggle: (key: TKey) => void
  /** 判断主键是否被选中。 */
  isSelected: (key: TKey) => boolean
  /** 清空选中集合。 */
  clearSelection: () => void
  /** 执行批量操作，使用当前选中集合。 */
  execute: (payload: TExtra) => Promise<TResult>
  /** 是否操作中。 */
  isOperating: Ref<boolean>
  /** 是否处于错误态。 */
  isError: Ref<boolean>
  /** 错误对象。 */
  error: Ref<Error | null>
  /** 底层 vue-query 变更对象。 */
  mutation: UseMutationReturnType<TResult, Error, BatchPayload<TKey, TExtra>, unknown>
}
