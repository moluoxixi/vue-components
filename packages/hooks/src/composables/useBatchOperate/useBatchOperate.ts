import type { BatchPayload, UseBatchOperateOptions, UseBatchOperateReturn } from '../../types'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toValue } from 'vue'
import { invalidateQueryKeys } from '../../utils'

/**
 * 批量操作场景 Hook。
 *
 * 维护一组选中项主键的内部选择状态（toggle/setSelection/clearSelection），
 * 并封装对选中项的批量变更；操作成功后按 invalidateKeys 让相关缓存失效，
 * 并默认清空选择，避免对已处理项重复操作。
 *
 * @template TKey 主键类型
 * @template TResult 批量操作返回类型
 * @template TExtra 附加业务参数类型
 */
export function useBatchOperate<TKey = string | number, TResult = unknown, TExtra = void>(
  options: UseBatchOperateOptions<TKey, TResult, TExtra>,
): UseBatchOperateReturn<TKey, TResult, TExtra> {
  const queryClient = useQueryClient()
  // 选中项主键集合，作为批量操作的作用域。
  const selectedKeys = ref<TKey[]>([]) as { value: TKey[] }

  const isSelected = (key: TKey): boolean => selectedKeys.value.includes(key)

  /** 切换单个主键的选中态。 */
  function toggle(key: TKey): void {
    selectedKeys.value = isSelected(key)
      ? selectedKeys.value.filter(k => k !== key)
      : [...selectedKeys.value, key]
  }

  /** 全量替换选中集合（去重，如表格「全选当前页」）。 */
  function setSelection(keys: TKey[]): void {
    selectedKeys.value = Array.from(new Set(keys))
  }

  /** 清空选中集合。 */
  function clearSelection(): void {
    selectedKeys.value = []
  }

  // 默认操作成功后清空选择，避免对已处理项重复操作；可通过 clearSelectionOnSuccess=false 关闭。
  const shouldClearOnSuccess = options.clearSelectionOnSuccess ?? true

  const mutation = useMutation<TResult, Error, BatchPayload<TKey, TExtra>>({
    mutationFn: payload => options.operate(payload),
    onSuccess: async (result, payload) => {
      const keys = toValue(options.invalidateKeys ?? [])
      if (keys.length > 0) {
        await invalidateQueryKeys(queryClient, keys)
      }
      if (shouldClearOnSuccess) {
        clearSelection()
      }
      options.onSuccess?.(result, payload)
    },
    onError: (error, payload) => {
      options.onError?.(error, payload)
    },
  })

  /**
   * 执行批量操作。
   *
   * 选中集合为空时拒绝执行（错误向上抛出），避免空操作误触发；
   * payload 为业务侧附加参数。
   */
  function execute(payload: TExtra): Promise<TResult> {
    const keys = selectedKeys.value
    if (keys.length === 0) {
      return Promise.reject(new Error('useBatchOperate: no items selected'))
    }
    return mutation.mutateAsync({ keys: [...keys], payload })
  }

  return {
    selectedKeys: computed(() => [...selectedKeys.value]),
    selectedCount: computed(() => selectedKeys.value.length),
    hasSelection: computed(() => selectedKeys.value.length > 0),
    setSelection,
    toggle,
    isSelected,
    clearSelection,
    execute,
    isOperating: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    mutation,
  }
}
