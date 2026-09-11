// Vue 2 / vue-router 3 的最小结构化类型。
//
// 为什么手写而不是从 'vue' / 'vue-router' 引：一个 npm 包只能有一份 `vue` 与
// `vue-router` 的类型解析结果，而本 kit 同时要支持 vue2(+router3) 与 vue3(+router4/5)。
// 真去 import 就会拿到另一个大版本的类型（`RouteConfig` 在 v4/v5 里根本不存在）。
// 好在这两侧要用的面积极小，结构化声明足够，而且让本层在没装 vue 的环境也能编译。
//
// Vue 2 组件本身就是普通对象，所以 ./micro-app 一行 vue 的 import 都不需要。

/** Vue 2 render 函数的 createElement，只用到 tag + data 两个位置 */
export type Vue2CreateElement = (tag: string, data?: Vue2VNodeData) => unknown

export interface Vue2VNodeData {
  ref?: string
  class?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
  attrs?: Record<string, unknown>
}

/** Vue 2 组件：选项对象、构造器或异步工厂，本层不需要区分它们 */
export type Vue2Component = unknown

/** vue-router 3 的 route 对象，本层只读 path 与 params */
export interface Vue2Route {
  path: string
  params: Record<string, string | string[] | undefined>
}

/** vue-router 3 的 RouteConfig（只声明本层会写的字段） */
export interface Vue2RouteConfig {
  path: string
  name?: string
  component?: Vue2Component
  props?: boolean | Record<string, unknown> | ((route: Vue2Route) => Record<string, unknown>)
  meta?: Record<string, unknown>
  children?: Vue2RouteConfig[]
}

/** `new VueRouter(options)` 的入参 */
export interface Vue2RouterOptions {
  /** vue-router 3 的模式；主应用一般是 'history' */
  mode?: 'hash' | 'history' | 'abstract'
  base?: string
  routes?: Vue2RouteConfig[]
  /** scrollBehavior、linkActiveClass 等其余官方选项原样透传 */
  [key: string]: unknown
}

/** vue-router 3 的 router 实例，本层只用到 addRoute（3.5+） */
export interface Vue2Router {
  addRoute: (route: Vue2RouteConfig) => void
}

/** 使用方传进来的 VueRouter 构造器（见 ./main-router 的说明） */
export type Vue2RouterConstructor<R extends Vue2Router = Vue2Router> = new (options: Vue2RouterOptions) => R
