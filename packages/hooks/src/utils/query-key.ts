import type { QueryClient } from '@tanstack/vue-query'
import type { QueryKeyBase } from '../types'

/**
 * 将查询键基段归一化为数组形式。
 *
 * 业务侧可传字符串（资源名）或数组（多维度键），统一转为数组便于追加动态片段。
 */
export function normalizeQueryKey(base: QueryKeyBase): unknown[] {
  return Array.isArray(base) ? [...base] : [base]
}

/**
 * 批量失效一组查询键。
 *
 * 变更类操作成功后调用，让相关列表 / 详情缓存失效以触发重新拉取。
 * 任一失效失败都会向上抛出，不静默吞错。
 */
export async function invalidateQueryKeys(
  client: QueryClient,
  keys: QueryKeyBase[],
): Promise<void> {
  await Promise.all(
    keys.map(key => client.invalidateQueries({ queryKey: normalizeQueryKey(key) })),
  )
}
