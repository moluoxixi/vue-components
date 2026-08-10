export interface ReadValueByPathOptions {
  /**
   * `true` 表示路径缺失时直接抛错；`false` 保持宽松读取并返回 undefined。
   */
  strict?: boolean
  /**
   * 由调用方提供错误文案，便于保留包级错误前缀和业务上下文。
   */
  createMissingPathError?: (path: string) => Error
}

function isReadablePathTarget(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
}

/**
 * 按点号路径读取对象属性。
 * 默认是宽松模式，适合展示/导出场景；严格模式适合 API 契约解析，路径缺失会显式失败。
 */
export function readValueByPath(
  source: unknown,
  path: string | undefined,
  options: ReadValueByPathOptions = {},
): unknown {
  if (!path) {
    return source
  }

  const segments = path.split('.').filter(Boolean)
  let current = source

  for (const segment of segments) {
    if (!isReadablePathTarget(current) || !(segment in current)) {
      if (options.strict) {
        throw options.createMissingPathError?.(path) ?? new Error(`[utils] path not found: ${path}`)
      }

      return undefined
    }

    current = current[segment]
  }

  return current
}
