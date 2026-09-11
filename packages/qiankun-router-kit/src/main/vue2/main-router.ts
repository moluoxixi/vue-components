// vue2 主应用的 createMainRouter / addMicroApps：把本层的清单翻译
// （./routes 的 createMicroAppRoutes）接上内置的 MicroApp 承接组件，使用方只管交清单。
// 想自定义承接组件（loading 骨架、权限门）就直接用 ./routes 的 createMicroAppRoutes。
//
// 与 vue3 层的两点差别：
// 1. VueRouter 构造器由使用方传进来。kit 自己 `import VueRouter from 'vue-router'`
//    会在本包的 tsc 下解析到 vue-router 4/5 的类型（详见 ./types 顶部），
//    而且这样本层在没装 vue-router 的环境也能编译。
// 2. 不提供坑 B 的镜像守卫。那个守卫是给 vue-router 4/5 擦屁股的：它 push 前会拿
//    共享的 history.state.current 去 replaceState。vue-router 3 的导航只写
//    `{ key }`、从不读 current，子应用写进去的方言伤不到它。
import type { MicroAppConfig, MicroAppRuntimeOptions } from '../core/manifest'
import { createMicroAppRoutes } from './routes'
import { MicroApp } from './micro-app'
import type { Vue2Router, Vue2RouterConstructor, Vue2RouterOptions } from './types'

export interface CreateMainRouterOptions extends Vue2RouterOptions, MicroAppRuntimeOptions {
  /**
   * qiankun 官方格式的应用清单（registerMicroApps 那份 RegistrableApp[]），
   * 每条 activeRule 前缀自动变成一条子应用路由。清单来自接口时先不传，
   * 拿到数据后调 addMicroApps(router, apps) 追加。
   */
  apps?: MicroAppConfig[]
}

/**
 * 创建主应用 router，替代 `new VueRouter(...)` 直接用。第一个参数就是使用方
 * 自己那份 VueRouter 构造器：
 *
 * import Vue from 'vue'
 * import VueRouter from 'vue-router'
 * import { createMainRouter } from 'qiankun-router-kit/main/vue2'
 *
 * Vue.use(VueRouter)
 * export default createMainRouter(VueRouter, {
 *   routes: [{ path: '/', component: Home }],
 *   apps: [
 *     { name: 'sub-a', entry: '//localhost:5001', activeRule: '/sub-a' },
 *   ],
 * })
 *
 * mode 默认 'history'（微前端主应用几乎都是），其余官方选项（base、
 * scrollBehavior、linkActiveClass...）原样透传。官方的 `configuration`（start 的
 * 参数）和 `lifeCycles`（registerMicroApps 的第二个参数）照原样一起传进来即可，
 * 会透传给每个 loadMicroApp。
 */
export function createMainRouter<R extends Vue2Router>(
  VueRouter: Vue2RouterConstructor<R>,
  { routes = [], apps, mode = 'history', configuration, lifeCycles, ...routerOptions }: CreateMainRouterOptions = {},
): R {
  return new VueRouter({
    mode,
    routes: apps?.length
      ? [...routes, ...createMicroAppRoutes(apps, MicroApp, { configuration, lifeCycles })]
      : routes,
    ...routerOptions,
  })
}

/**
 * 运行时追加子应用路由 —— 清单由后台接口/配置中心下发时用：
 *
 * const apps = await fetch('/api/micro-apps').then(r => r.json())
 * addMicroApps(router, apps)
 * addMicroApps(router, apps, { lifeCycles })   官方全局配置一起给
 *
 * 在 `new Vue({ router })` 之前调用即可，深链接直达也能正确承接。
 * 需要 vue-router 3.5+（addRoute 是那时加的）。
 */
export function addMicroApps(router: Vue2Router, apps: MicroAppConfig[], options: MicroAppRuntimeOptions = {}): void {
  for (const route of createMicroAppRoutes(apps, MicroApp, options))
    router.addRoute(route)
}
