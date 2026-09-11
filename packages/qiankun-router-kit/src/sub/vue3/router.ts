// vue-router 4 子应用的 router 创建/销毁（依赖 vue-router 4）
import type { Router, RouterOptions } from 'vue-router'
import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import type { QiankunRouterProps } from '../core/index'
import { resolveRouterConfig } from '../core/index'
import { getStateCurrent, setStateCurrent, stripBase } from '../../utils'

export interface CreateSubRouterOptions extends Omit<RouterOptions, 'history'> {
  /** 是否 qiankun 环境（生命周期调用方显式传入，见 resolveRouterConfig 说明） */
  isQiankun?: boolean
  /** qiankun 下发的 props（读取 routerBase / routerMode） */
  props?: QiankunRouterProps
}

/**
 * 创建子应用 router：在 mount 生命周期里调用、unmount 里配对调用
 * destroySubRouter，绝不放模块顶层。routes 之外的选项透传给 createRouter。
 *
 * 用 defineSubApp 的话这一步已被吃掉，不需要自己调。
 */
export function createSubRouter({ isQiankun = false, props = {}, ...routerOptions }: CreateSubRouterOptions): Router {
  const { base, mode } = resolveRouterConfig({ isQiankun, props })
  const history = mode === 'memory' ? createMemoryHistory() : createWebHistory(base)
  const router = createRouter({ history, ...routerOptions })

  // 镜像守卫（坑 B 的另一半）：共享的 history.state.current 存在两种方言
  // （主应用写完整路径，子应用写相对 base 的路径），vue-router 4 的 push
  // 会拿 current 拼上自己的 base 去 replaceState 当前记录 —— 读到主应用
  // 写的完整路径会拼出 /sub-a/sub-a/ 双重前缀。导航前先把 current 翻译回
  // 自己的坐标系（去掉 base 前缀），谁导航谁翻译，两种方言各自自洽。
  if (mode !== 'memory' && base !== '/') {
    router.beforeEach(() => {
      const cur = getStateCurrent()
      if (cur === undefined)
        return
      const rel = stripBase(cur, base)
      if (rel !== null)
        setStateCurrent(rel)
    })
  }

  return router
}

/**
 * 销毁子应用 router：注销 popstate 监听，防止卸载后残留“幽灵路由”。
 * 在 unmount 生命周期里、app.unmount() 之后调用。
 */
export function destroySubRouter(router: Router | null | undefined): void {
  router?.options.history.destroy()
}
