// react 主应用的 createMainRoutes：把本层的清单翻译（./routes 的
// createMicroAppRoutes）接上内置的 MicroApp 承接组件，使用方只管交清单。
// 想自定义承接组件（loading 骨架、权限门）就直接用 ./routes 的 createMicroAppRoutes。
//
// 与 vue3/vue2 层的两点差别：
// 1. 返回的是路由数组，不是 router 实例。react-router 6 的 router 由使用方自己
//    造（`createBrowserRouter(routes)`、或组件里 `useRoutes(routes)`），
//    kit 没有非要插一手的理由 —— 那样只会把它的 loader / errorElement 等
//    官方选项挡在外面。
// 2. 不提供坑 B 的镜像守卫。那个守卫是给 vue-router 4/5 擦屁股的：它 push 前会拿
//    共享的 history.state.current 去 replaceState。react-router 6 每次导航都把
//    history.state 整份换成自己的 `{ usr, key, idx }`，从不读 current，
//    子应用写进去的方言伤不到它。
import type { RouteObject } from 'react-router-dom'
import type { MicroAppConfig, MicroAppRuntimeOptions } from '../core/manifest'
import { createMicroAppRoutes } from './routes'
import { MicroApp } from './micro-app'

export interface CreateMainRoutesOptions extends MicroAppRuntimeOptions {
  /** 主应用自己的路由 */
  routes?: RouteObject[]
  /**
   * qiankun 官方格式的应用清单（registerMicroApps 那份 RegistrableApp[]），
   * 每条 activeRule 前缀自动变成一条子应用路由。
   */
  apps?: MicroAppConfig[]
}

/**
 * 主应用自己的路由 + 清单生成的子应用路由，拼成一份喂给 react-router：
 *
 * const routes = createMainRoutes({
 *   routes: [{ path: '/', element: <Home /> }, { path: '*', element: <NotFound /> }],
 *   apps: [
 *     { name: 'sub-a', entry: '//localhost:5001', activeRule: '/sub-a' },
 *   ],
 * })
 * const router = createBrowserRouter(routes)     // 或组件里 useRoutes(routes)
 *
 * 清单来自后台接口时，等数据到了再调本函数造 routes（`router.push` 之前拿到就行），
 * 深链接直达也能正确承接。官方的 `configuration`（start 的参数）和 `lifeCycles`
 * （registerMicroApps 的第二个参数）照原样一起传进来即可，会透传给每个 loadMicroApp。
 *
 * 子应用路由排在主应用路由之后：`path: '*'` 那条 404 兜底放在 routes 里也不会
 * 抢走 `/sub-a/**` —— react-router 6 按具体度排序匹配，与书写顺序无关。
 */
export function createMainRoutes({ routes = [], apps, configuration, lifeCycles }: CreateMainRoutesOptions = {}): RouteObject[] {
  if (!apps?.length)
    return routes
  return [...routes, ...createMicroAppRoutes(apps, MicroApp, { configuration, lifeCycles })]
}
