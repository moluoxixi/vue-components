// 应用清单 → react-router 6 的路由记录。三个框架各有一份这样的翻译，
// 差别只在路由记录的形状（这里是 splat `/*` + element + handle）。
import type { ReactElement } from 'react'
import { createElement, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import type { MicroAppConfig, MicroAppRuntimeOptions } from '../core/manifest'
import { normalizeMicroApps, resolvePrefix } from '../core/manifest'
import type { MicroAppComponent } from './micro-app'

interface MicroAppRouteProps extends MicroAppRuntimeOptions {
  app: MicroAppConfig
  prefix: string
  component: MicroAppComponent
}

/**
 * 路由与承接组件之间的那层适配。react-router 的路由记录里放的是 element（现成的
 * 元素），没有 vue-router 那种 props 函数，所以“读当前路由 → 算出要下发的 props”
 * 这件事只能在一个组件里做 —— 就是这个。它也是本层唯一碰 react-router 的地方，
 * 承接组件本身（./micro-app）保持与路由库无关。
 */
function MicroAppRoute({ app, prefix, component, configuration, lifeCycles }: MicroAppRouteProps): ReactElement {
  const params = useParams()
  const { pathname } = useLocation()
  // 把实际匹配到的路由前缀注进 qiankun 自己的 props 通道（子应用侧本来就从这儿读）。
  // 刻意造副本而不是改清单对象本身：清单可能来自接口/被别处复用，
  // route.handle.microApp 也要保持它的原貌。useMemo 只是少造几个对象，
  // 挂不挂载不靠它 —— 控制器那边按值比较 key（见 core/controller 的 sync 注释）。
  const resolved = useMemo(
    () => ({ ...app, props: { ...app.props, routerBase: resolvePrefix(prefix, params) } }),
    [app, prefix, params],
  )
  // pathname 已经剥掉了主应用的 basename，正是控制器判定 history/memory 要的值
  return createElement(component, { app: resolved, configuration, lifeCycles, currentPath: pathname })
}

/**
 * 应用清单 → 路由记录。每个 activeRule 前缀生成一条 `${prefix}/*`：
 * 前缀由主应用路由承接，前缀之后的部分交给子应用自己的 router。
 * react-router 6 的 splat 会连前缀本身一起匹配（`/sub-a` 与 `/sub-a/about` 都算）。
 *
 * 产物直接喂给 `createBrowserRouter(routes)` 或 `useRoutes(routes)` 都行。
 * 子应用配置挂在官方的 `handle` 字段上（react-router 没有 meta），
 * 组件里用 `useMatches()` 读它做标题/面包屑/权限。
 */
export function createMicroAppRoutes(
  apps: MicroAppConfig[],
  component: MicroAppComponent,
  { configuration, lifeCycles }: MicroAppRuntimeOptions = {},
): RouteObject[] {
  return normalizeMicroApps(apps).flatMap(({ app, prefixes }) =>
    prefixes.map(prefix => ({
      path: `${prefix}/*`,
      element: createElement(MicroAppRoute, { app, prefix, component, configuration, lifeCycles }),
      handle: { microApp: app },
    })),
  )
}
