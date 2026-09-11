// 应用清单 → vue-router 4/5 的路由记录。三个框架各有一份这样的翻译，
// 差别只在路由记录的形状（这里是 `:pathMatch(.*)*` + props 函数 + meta）。
import type { RouteComponent, RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import type { MicroAppConfig, MicroAppRuntimeOptions } from '../core/manifest'
import { normalizeMicroApps, resolvePrefix } from '../core/manifest'

declare module 'vue-router' {
  interface RouteMeta {
    /** 由 createMicroAppRoutes 写入：这条路由承接的子应用配置（做标题/面包屑/权限时直接读） */
    microApp?: MicroAppConfig
  }
}

/** 承接子应用的路由视图组件，收到的 props 见 createMicroAppRoutes */
export type MicroAppComponent = RouteComponent | (() => Promise<RouteComponent>)

/**
 * 应用清单 → 路由记录。每个 activeRule 前缀生成一条 `${prefix}/:pathMatch(.*)*`：
 * 前缀由主应用路由承接，前缀之后的部分交给子应用自己的 router。
 *
 * 路由 props 下发的就是 `MicroApp` 的三个入参（= `loadMicroApp` 的三个参数），
 * 其中 `app.props.routerBase` 用实际匹配到的前缀还原，所以 `/tenant/:id/sub-a` 这种带参
 * 前缀也能拿到正确的值。
 */
export function createMicroAppRoutes(
  apps: MicroAppConfig[],
  component: MicroAppComponent,
  { configuration, lifeCycles }: MicroAppRuntimeOptions = {},
): RouteRecordRaw[] {
  return normalizeMicroApps(apps).flatMap(({ app, prefixes }) =>
    prefixes.map((prefix, index) => ({
      path: `${prefix}/:pathMatch(.*)*`,
      // 一个应用配多个 activeRule 时路由名加后缀，保证唯一
      name: prefixes.length > 1 ? `micro-app-${app.name}-${index}` : `micro-app-${app.name}`,
      component,
      props: (route: RouteLocationNormalized) => ({
        // 把实际匹配到的路由前缀注进 qiankun 自己的 props 通道（子应用侧本来就从这儿读）。
        // 刻意造副本而不是改清单对象本身：清单可能来自接口/被别处复用，
        // 下面 meta.microApp 也要保持它的原貌。副本每次导航都是新对象，
        // 控制器那边的 key 就必须按值比较（见 controller.sync 注释）。
        app: { ...app, props: { ...app.props, routerBase: resolvePrefix(prefix, route.params) } },
        configuration,
        lifeCycles,
      }),
      meta: { microApp: app },
    })),
  )
}
