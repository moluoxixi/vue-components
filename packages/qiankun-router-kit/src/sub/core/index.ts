// 子应用侧的框架无关核心（入口 `qiankun-router-kit/sub/core`）：vue2 / react 子应用
// 直接用它拿配置，vue3 子应用用包好的 ../vue3。本文件不 import 任何 router 实现，
// 也不引 qiankun，所以子应用产物里不会多出一份主应用的运行时。

/** 子应用路由模式：history 绑定地址栏，memory 不绑定（多实例共存用） */
export type RouterMode = 'history' | 'memory'

/** 主应用通过 loadMicroApp 下发的路由相关 props */
export interface QiankunRouterProps {
  /** 路由前缀，与主应用分配的 URL 前缀（activeRule 语义）对齐 */
  routerBase?: string
  routerMode?: RouterMode
  [key: string]: unknown
}

export interface ResolveRouterConfigOptions {
  /**
   * 是否 qiankun 环境，必须由生命周期调用方显式传入：
   * renderWithQiankun 的 mount 里传 true，独立运行入口传 false。
   * 不要用 qiankunWindow.__POWERED_BY_QIANKUN__ 判断 —— Vite 子应用是
   * 原生 ESM，模块缓存导致该标记在同一子应用卸载再挂载后不可信（坑 A），
   * 环境信息只有生命周期调用方自己知道。
   */
  isQiankun?: boolean
  props?: QiankunRouterProps
}

export interface RouterConfig {
  base: string
  mode: RouterMode
}

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
