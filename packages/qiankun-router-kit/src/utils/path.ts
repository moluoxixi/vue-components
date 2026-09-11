/**
 * 从完整路径中去掉 base 前缀，得到相对路径；path 不属于该 base 时返回 null。
 * stripBase('/sub-a/about', '/sub-a') -> '/about'
 * stripBase('/sub-a', '/sub-a')       -> '/'
 * stripBase('/other', '/sub-a')       -> null
 */
export function stripBase(path: string, base: string): string | null {
  if (path === base)
    return '/'
  if (path.startsWith(`${base}/`))
    return path.slice(base.length)
  return null
}
