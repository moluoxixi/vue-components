// vue2 主应用的挂载器组件。挂载逻辑全在框架无关的 ../controller 里，
// 这个文件只做三件事：渲染容器 div、把 props 交给控制器、销毁时收摊。
// props 严格对应 `loadMicroApp(app, configuration, lifeCycles)` 的三个入参。
//
// 全文一行 `vue` 的 import 都没有 —— Vue 2 组件本来就是普通选项对象，
// 而本 kit 同时服务 vue2 与 vue3，真去引 'vue' 只会拿到另一个大版本的类型
// （详见 ./types 顶部）。`this` 的类型靠下面显式的 this 形参标注。
import type { FrameworkConfiguration, FrameworkLifeCycles } from 'qiankun'
import type { MicroAppConfig, MicroAppProps } from '../core/manifest'
import type { MicroAppController } from '../core/controller'
import { createMicroAppController, needsOwnContainer } from '../core/controller'
import type { Vue2CreateElement, Vue2Route } from './types'

/** 本组件用到的实例成员（Vue 2 把 props 直接挂在实例上） */
interface MicroAppInstance {
  app: MicroAppConfig
  configuration?: FrameworkConfiguration
  lifeCycles?: FrameworkLifeCycles<MicroAppProps>
  /** 装了 vue-router 才有 */
  $route?: Vue2Route
  $refs: Record<string, unknown>
  /** created 里挂上的控制器，非响应式实例属性 */
  microAppController: MicroAppController
  syncMicroApp: () => void
}

/**
 * 挂载单个子应用。挂载点优先级 `app.render` → `app.container` → 本组件自建 div，
 * 前两种是官方语义原样透传（包括“所有子应用共用布局里一个 #subapp-viewport”）。
 * 路由模式（history / memory）由 kit 自动判定，使用方不用管。
 *
 * 走 createMainRouter 的 apps 时连写都不用写，路由会把 props 下发进来；
 * 多实例共存、tab 多开这类定制场景才需要自己写：
 *
 * <MicroApp :app="app" />
 * <MicroApp :app="{ ...app, container: undefined }" />   忽略清单里的 container，自建一个
 */
export const MicroApp = {
  name: 'MicroApp',
  props: {
    /**
     * loadMicroApp 第 1 参：清单里那条 qiankun 官方配置（RegistrableApp）。
     * `container` / `render` / `loader` / `props` 全是官方语义，原样透传；
     * 想让本组件自建容器就构个副本把 container 去掉（同页多实例必须这么写，
     * 否则几个实例会抢同一个节点）。kit 只往 `props` 里额外塞两个路由字段：
     * `routerBase`（不传则由 activeRule 推导）与 `routerMode`（不传则自动判定）。
     */
    app: { type: Object, required: true },
    /** loadMicroApp 第 2 参：官方 `start()` 的配置，传了就整体替换默认的 experimentalStyleIsolation */
    configuration: { type: Object, default: undefined },
    /** loadMicroApp 第 3 参：官方 `registerMicroApps` 的第二个参数（beforeLoad / beforeMount / ...） */
    lifeCycles: { type: Object, default: undefined },
  },
  created(this: MicroAppInstance): void {
    // 判定路由模式要读当前路径。没装 vue-router 时 $route 是 undefined，
    // 不传 getCurrentPath，控制器会退回 location.pathname。
    this.microAppController = createMicroAppController({
      getCurrentPath: this.$route ? () => (this.$route as Vue2Route).path : undefined,
    })
  },
  mounted(this: MicroAppInstance): void {
    this.syncMicroApp()
  },
  // 组件被复用时也能正确换应用：同一条路由记录换前缀参数（/tenant/:id/sub-a）、
  // 或者页面自己切应用 / 切声明的模式 / 切挂载点。这里刻意用 updated 而不是 watch ——
  // props 变了必然重渲染，而 sync 本身是幂等的（控制器按字符串 key 按值比较），
  // 所以“宁可多调一次”比“猜哪些字段该进 watch 源”更稳。
  updated(this: MicroAppInstance): void {
    this.syncMicroApp()
  },
  beforeDestroy(this: MicroAppInstance): void {
    this.microAppController.destroy()
  },
  methods: {
    syncMicroApp(this: MicroAppInstance): void {
      this.microAppController.sync({
        app: this.app,
        configuration: this.configuration,
        lifeCycles: this.lifeCycles,
        ownContainer: (this.$refs.container as HTMLElement | undefined) ?? null,
      })
    },
  },
  // 这个 div 就是本组件的渲染输出 —— 它出现在组件被使用的位置（路由驱动就是
  // router-view 的位置），不做任何选择器查找，$refs.container 直接拿到它。
  // 始终渲染同一个 div：自建容器时挂上 .qiankun-micro-app，这只是给使用方的
  // 样式钩子（kit 不提供 CSS）；挂载点来自外部（清单的 container 或 render 变体）
  // 时不加 class —— 否则使用方给这个 class 定义的样式会在布局里留下一个可见空框。
  render(this: MicroAppInstance, h: Vue2CreateElement): unknown {
    return h('div', {
      ref: 'container',
      class: needsOwnContainer(this.app) ? 'qiankun-micro-app' : undefined,
    })
  },
}
