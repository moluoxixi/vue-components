import type { UseMutationReturnType } from '@tanstack/vue-query'
import type { ComputedRef, Ref } from 'vue'
import type { InvalidateKeys, SubmitMode } from './common'

/**
 * 表单提交载荷。
 *
 * mode 标识新增或编辑，id 仅在编辑时存在，values 为表单值。
 *
 * @template TValues 表单值类型
 * @template TId 主键类型
 */
export interface SubmitPayload<TValues, TId = string | number> {
  mode: SubmitMode
  id: TId | null | undefined
  values: TValues
}

/**
 * useFormSubmit 配置项。
 *
 * @template TValues 表单值类型
 * @template TResult 提交返回类型
 * @template TId 主键类型
 */
export interface UseFormSubmitOptions<TValues, TResult = unknown, TId = string | number> {
  /** 提交处理函数，依据 payload.mode 区分新增 / 编辑。 */
  submit: (payload: SubmitPayload<TValues, TId>) => Promise<TResult>
  /** 提交成功后需要失效的查询键集合，用于刷新列表 / 详情缓存。 */
  invalidateKeys?: InvalidateKeys
  /** 提交成功回调。 */
  onSuccess?: (result: TResult, payload: SubmitPayload<TValues, TId>) => void
  /** 提交失败回调。 */
  onError?: (error: Error, payload: SubmitPayload<TValues, TId>) => void
}

/**
 * useFormSubmit 返回契约。
 */
export interface UseFormSubmitReturn<TValues, TResult = unknown, TId = string | number> {
  /** 执行提交；不传 id 视为新增，传 id 视为编辑。 */
  submit: (values: TValues, id?: TId | null) => Promise<TResult>
  /** 当前提交模式（依据最近一次调用推断）。 */
  mode: ComputedRef<SubmitMode>
  /** 是否提交中。 */
  isSubmitting: Ref<boolean>
  /** 是否处于错误态。 */
  isError: Ref<boolean>
  /** 错误对象。 */
  error: Ref<Error | null>
  /** 重置提交状态。 */
  reset: () => void
  /** 底层 vue-query 变更对象。 */
  mutation: UseMutationReturnType<TResult, Error, SubmitPayload<TValues, TId>, unknown>
}
