import type { ResolveRouterConfigOptions, RouterConfig } from '../types'

/**
 * 解析子应用的路由配置（base + mode）：
 * - vue-router 3 子应用：mode === 'memory' 时映射为 abstract 模式
 * - react-router 6 子应用：base 传给 basename，memory 换用 <MemoryRouter>
 * - vue-router 4/5 子应用：直接用 ../vue3 的 createSubRouter，无需手动调这里
 *
 * memory 模式下 base 统一归一化为 '/'：memory / abstract / MemoryRouter
 * 都不消费 base，主应用下发了也无意义，在这里抹掉省得各框架各自判断。
 */
export function resolveRouterConfig({ isQiankun = false, props = {} }: ResolveRouterConfigOptions = {}): RouterConfig {
  if (!isQiankun)
    return { base: '/', mode: 'history' }
  const mode = props.routerMode || 'history'
  return {
    base: mode === 'memory' ? '/' : props.routerBase || '/',
    mode,
  }
}
