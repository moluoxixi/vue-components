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
