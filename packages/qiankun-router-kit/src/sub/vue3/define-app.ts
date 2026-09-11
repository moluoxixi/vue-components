// vue3 子应用一站式入口：把每个子应用都要抄一遍的 mount/unmount 样板
// （容器解析、router 创建销毁、双分支、isQiankun 传参）全部吃掉。
import type { App, Component } from 'vue'
import { createApp } from 'vue'
import type { Router } from 'vue-router'
import { qiankunWindow, renderWithQiankun } from 'vite-plugin-qiankun/dist/helper'
import type { QiankunRouterProps, RouterMode } from '../core/index'
import { resolveRouterConfig } from '../core/index'
import type { CreateSubRouterOptions } from './router'
import { createSubRouter, destroySubRouter } from './router'

/** setup 钩子拿到的上下文：本次挂载的运行环境与已建好的 router */
export interface SubAppContext {
  /** 本次挂载的根节点（qiankun 环境下位于主应用下发的容器内） */
  root: Element
  router: Router
  /** 是否跑在 qiankun 里（包已替调用方判断好，不必自己猜） */
  isQiankun: boolean
  base: string
  mode: RouterMode
  /** qiankun 下发的完整 props（业务字段、回调都在这里） */
  props: QiankunRouterProps
}

/** setup 可返回一个清理函数，在 unmount 时（app 卸载、router 销毁之后）调用 */
export type SubAppCleanup = () => void

export interface DefineSubAppOptions extends Omit<CreateSubRouterOptions, 'isQiankun' | 'props'> {
  /** 根组件 */
  App: Component
  /** 根节点选择器，默认 '#app'；qiankun 环境下在下发的容器内查找 */
  rootSelector?: string
  /**
   * 创建 app 之后、mount 之前调用：注册插件、provide、打样式作用域等。
   * 返回的函数会在 unmount 时执行（用来 dispose 自己申请的资源）。
   */
  setup?: (app: App, ctx: SubAppContext) => SubAppCleanup | void
}

export interface SubAppHandle {
  /** 手动挂载（一般不需要，qiankun 生命周期与独立运行都已自动接好） */
  render: (container?: Element | null, props?: QiankunRouterProps, isQiankun?: boolean) => void
  /** 手动卸载 */
  destroy: () => void
}

/**
 * 定义 vue3 子应用：qiankun 生命周期与独立运行两条路都自动接好，
 * 一次调用就是整个 main.js：
 *
 * export default defineSubApp({
 *   App,
 *   routes,
 *   setup(app, { mode }) {
 *     app.use(ElementPlus)
 *     app.provide('routerMode', mode)
 *   },
 * })
 *
 * 内部兜住的坑：
 * - 坑 A：`__POWERED_BY_QIANKUN__` 只在模块首次执行时可信（helper 顶层
 *   捕获的是当前沙箱 proxy，二次挂载读到的是被清空的旧 proxy）。这里只在
 *   定义时读一次，mount 里写死 isQiankun=true，调用方完全不用碰这个标记。
 * - 坑 B：router 在 mount 里创建、unmount 里销毁（注销 popstate 监听），
 *   history.state 镜像守卫由 createSubRouter 内置。
 */
export function defineSubApp({ App, rootSelector = '#app', setup, ...routerOptions }: DefineSubAppOptions): SubAppHandle {
  // 只在模块首次执行时读一次（此刻 helper 捕获的 proxy 是可信的）
  const poweredByQiankun = Boolean(qiankunWindow.__POWERED_BY_QIANKUN__)

  let app: App | null = null
  let router: Router | null = null
  let cleanup: SubAppCleanup | null = null

  function render(container?: Element | null, props: QiankunRouterProps = {}, isQiankun = false): void {
    const scope = container ?? document
    const root = scope.querySelector(rootSelector)
    if (!root)
      throw new Error(`[qiankun-router-kit] 找不到根节点 ${rootSelector}，检查子应用 index.html 或 rootSelector`)

    router = createSubRouter({ ...routerOptions, isQiankun, props })

    app = createApp(App)
    cleanup = setup?.(app, {
      root,
      router,
      isQiankun,
      props,
      ...resolveRouterConfig({ isQiankun, props }),
    }) ?? null
    app.use(router)
    app.mount(root)
  }

  function destroy(): void {
    app?.unmount()
    destroySubRouter(router)
    cleanup?.()
    app = null
    router = null
    cleanup = null
  }

  if (poweredByQiankun) {
    renderWithQiankun({
      bootstrap() {},
      mount(props) {
        render(props.container, props, true)
      },
      update() {},
      unmount() {
        destroy()
      },
    })
  }
  else {
    render()
  }

  return { render, destroy }
}
