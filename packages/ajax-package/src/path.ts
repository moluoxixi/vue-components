import { readValueByPath } from '@moluoxixi/utils'

/**
 * 严格解析点号路径；调用方声明了路径，就必须让响应满足该契约。
 */
export function getValueByPath(source: unknown, path: string | undefined): unknown {
  return readValueByPath(source, path, {
    createMissingPathError: missingPath => new Error(`[ajax-package] response path not found: ${missingPath}`),
    strict: true,
  })
}
