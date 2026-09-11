// vue3 主应用的 createMainRouter / addMicroApps：把本层的清单翻译
// （./routes 的 createMicroAppRoutes）接上内置的 MicroApp 承接组件，使用方只管交清单。
// 想自定义承接组件（loading 骨架、权限门）就直接用 ./routes 的 createMicroAppRoutes。
import type { RouteRecordRaw, Router, RouterOptions } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import type { MicroAppConfig, MicroAppRuntimeOptions } from '../core/manifest'
import { createMicroAppRoutes } from './routes'
import { installMainRouterGuard } from './guard'
import { MicroApp } from './micro-app'

export interface CreateMainRouterOptions extends Omit<RouterOptions, 'history' | 'routes'>, MicroAppRuntimeOptions {
  /** 主应用自己的路由 */
  routes?: RouteRecordRaw[]
  /**
   * qiankun 官方格式的应用清单（registerMicroApps 那份 RegistrableApp[]），
   * 每条 activeRule 前缀自动变成一条子应用路由。清单来自接口时先不传，
   * 拿到数据后调 addMicroApps(router, apps) 追加。
   */
  apps?: MicroAppConfig[]
  /** 自定义 history，默认 createWebHistory()（主应用 base=/） */
  history?: RouterOptions['history']
}

/**
 * 创建主应用 router，替代 createRouter 直接用。apps 就是 qiankun
 * `registerMicroApps` 那份清单，每条 activeRule 前缀自动接成一条路由：
 *
 * export default createMainRouter({
 *   routes: [{ path: '/', component: Home }],
 *   apps: [
 *     { name: 'sub-a', entry: '//localhost:5001', activeRule: '/sub-a' },
 *   ],
 * })
 *
 * 官方的 `configuration`（start 的参数）和 `lifeCycles`（registerMicroApps 的
 * 第二个参数）照原样一起传进来即可，会透传给每个 loadMicroApp。
 */
export function createMainRouter({ routes = [], apps, history = createWebHistory(), configuration, lifeCycles, ...routerOptions }: CreateMainRouterOptions): Router {
  const router = createRouter({
    history,
    routes: apps?.length
      ? [...routes, ...createMicroAppRoutes(apps, MicroApp, { configuration, lifeCycles })]
      : routes,
    ...routerOptions,
  })
  return installMainRouterGuard(router)
}

/**
 * 运行时追加子应用路由 —— 清单由后台接口/配置中心下发时用：
 *
 * const apps = await fetch('/api/micro-apps').then(r => r.json())
 * addMicroApps(router, apps)
 * addMicroApps(router, apps, { lifeCycles })   官方全局配置一起给
 *
 * 在 app.mount() 之前调用即可，深链接直达也能正确承接。
 */
export function addMicroApps(router: Router, apps: MicroAppConfig[], options: MicroAppRuntimeOptions = {}): void {
  for (const route of createMicroAppRoutes(apps, MicroApp, options))
    router.addRoute(route)
}
