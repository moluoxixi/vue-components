import type { SubmitMode, SubmitPayload, UseFormSubmitOptions, UseFormSubmitReturn } from '../../types'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toValue } from 'vue'
import { invalidateQueryKeys } from '../../utils'

/**
 * 表单提交场景 Hook。
 *
 * 统一封装新增 / 编辑提交：依据调用 submit 时是否传入主键自动推断模式，
 * 提交成功后按 invalidateKeys 让相关列表 / 详情缓存失效以触发重新拉取。
 *
 * @template TValues 表单值类型
 * @template TResult 提交返回类型
 * @template TId 主键类型
 */
export function useFormSubmit<TValues, TResult = unknown, TId = string | number>(
  options: UseFormSubmitOptions<TValues, TResult, TId>,
): UseFormSubmitReturn<TValues, TResult, TId> {
  const queryClient = useQueryClient()
  // 记录最近一次提交模式，供外部展示「新增中 / 保存中」等文案。
  const currentMode = ref<SubmitMode>('create')

  const mutation = useMutation<TResult, Error, SubmitPayload<TValues, TId>>({
    mutationFn: payload => options.submit(payload),
    onSuccess: async (result, payload) => {
      const keys = toValue(options.invalidateKeys ?? [])
      if (keys.length > 0) {
        await invalidateQueryKeys(queryClient, keys)
      }
      options.onSuccess?.(result, payload)
    },
    onError: (error, payload) => {
      options.onError?.(error, payload)
    },
  })

  /**
   * 执行提交。
   *
   * 不传 id（或传 null/undefined）视为新增，否则视为编辑；
   * 返回 mutateAsync 的 Promise，错误向上抛出，由调用方处理。
   */
  function submit(values: TValues, id?: TId | null): Promise<TResult> {
    const mode: SubmitMode = id === null || id === undefined ? 'create' : 'update'
    currentMode.value = mode
    return mutation.mutateAsync({ mode, id, values })
  }

  return {
    submit,
    mode: computed(() => currentMode.value),
    isSubmitting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: () => mutation.reset(),
    mutation,
  }
}
