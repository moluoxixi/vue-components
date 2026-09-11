// react 主应用的挂载器组件。挂载逻辑全在框架无关的 ../core/controller 里，
// 这个文件只做三件事：渲染容器 div、把 props 交给控制器、卸载时收摊。
// props 严格对应 `loadMicroApp(app, configuration, lifeCycles)` 的三个入参。
//
// 本文件不引 react-router：当前路径由 ./routes 那层读出来通过 currentPath 传进来，
// 所以裸用 React（没装 router、或用别的路由库）也能直接用这个组件。
// 写成 createElement 而不是 JSX：kit 是 TS 源码直发，不给使用方的构建加 jsx 约束。
import type { ComponentType, ReactElement } from 'react'
import { createElement, useEffect, useRef } from 'react'
import type { FrameworkConfiguration, FrameworkLifeCycles } from 'qiankun'
import type { MicroAppConfig, MicroAppProps } from '../core/manifest'
import type { MicroAppController } from '../core/controller'
import { createMicroAppController, needsOwnContainer } from '../core/controller'

export interface MicroAppComponentProps {
  /**
   * loadMicroApp 第 1 参：清单里那条 qiankun 官方配置（RegistrableApp）。
   * `container` / `render` / `loader` / `props` 全是官方语义，原样透传；
   * 想让本组件自建容器就构个副本把 container 去掉（同页多实例必须这么写，
   * 否则几个实例会抢同一个节点）。kit 只往 `props` 里额外塞两个路由字段：
   * `routerBase`（不传则由 activeRule 推导）与 `routerMode`（不传则自动判定）。
   */
  app: MicroAppConfig
  /** loadMicroApp 第 2 参：官方 `start()` 的配置，传了就整体替换默认的 experimentalStyleIsolation */
  configuration?: FrameworkConfiguration
  /** loadMicroApp 第 3 参：官方 `registerMicroApps` 的第二个参数（beforeLoad / beforeMount / ...） */
  lifeCycles?: FrameworkLifeCycles<MicroAppProps>
  /**
   * 主应用当前路径，用来判定这个实例该不该绑地址栏（history / memory）。
   * 要传**已剥掉主应用 basename** 的值 —— `useLocation().pathname` 正是这个语义，
   * ./routes 生成的路由会自动传。不传则退回 `location.pathname`。
   */
  currentPath?: string
}

/** 承接子应用的路由视图组件，收到的 props 见上（内置实现就是下面的 MicroApp） */
export type MicroAppComponent = ComponentType<MicroAppComponentProps>

/**
 * 挂载单个子应用。挂载点优先级 `app.render` → `app.container` → 本组件自建 div，
 * 前两种是官方语义原样透传（包括“所有子应用共用布局里一个 #subapp-viewport”）。
 * 路由模式（history / memory）由 kit 自动判定，使用方不用管。
 *
 * 走 ./main-routes 的 createMainRoutes 时连写都不用写，路由会把 props 传进来；
 * 多实例共存、tab 多开这类定制场景才需要自己写：
 *
 * <MicroApp app={app} />
 * <MicroApp app={{ ...app, container: undefined }} />   忽略清单里的 container，自建一个
 *
 * 注意别把它放进 `<StrictMode>`：StrictMode 在开发模式会故意把每个组件挂载→卸载
 * →再挂载一次，子应用于是被卸了重挂，而 Vite 子应用二次挂载的生命周期会挂起
 * （沙箱 proxy 只在模块首次求值时捕获）。这是 qiankun 与 StrictMode 的固有冲突，
 * 不是本组件能绕开的。
 */
export function MicroApp({ app, configuration, lifeCycles, currentPath }: MicroAppComponentProps): ReactElement {
  // 本组件自建的容器（只在清单没给挂载点时才带 class）
  const ownContainer = useRef<HTMLDivElement | null>(null)
  // 控制器读的是「最新」路径：它在首次渲染时创建，闭包不能捕获当次的 currentPath
  const pathRef = useRef(currentPath)
  pathRef.current = currentPath
  const controllerRef = useRef<MicroAppController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createMicroAppController({
      getCurrentPath: () => pathRef.current ?? window.location.pathname,
    })
  }
  const controller = controllerRef.current

  // 刻意不给依赖数组：每次渲染后都同步一次。sync 是幂等的（控制器按字符串 key
  // 按值比较），“宁可多调一次”比“猜哪些字段该进依赖”更稳 —— 路由每次导航下发的
  // app 都是新对象，写进依赖数组反而会偏发重挂。
  useEffect(() => {
    controller.sync({ app, configuration, lifeCycles, ownContainer: ownContainer.current })
  })
  // 卸载时收摊。空依赖：整个生命周期只注册一次
  useEffect(() => () => controller.destroy(), [controller])

  // 这个 div 就是本组件的渲染输出 —— 它出现在组件被使用的位置（路由驱动就是
  // 那条路由的 element 位置），不做任何选择器查找，ownContainer ref 直接拿到它。
  // 始终渲染同一个 div：自建容器时挂上 .qiankun-micro-app，这只是给使用方的
  // 样式钩子（kit 不提供 CSS）；挂载点来自外部（清单的 container 或 render 变体）
  // 时不加 class —— 否则使用方给这个 class 定义的样式会在布局里留下一个可见空框。
  return createElement('div', {
    ref: ownContainer,
    className: needsOwnContainer(app) ? 'qiankun-micro-app' : undefined,
  })
}
