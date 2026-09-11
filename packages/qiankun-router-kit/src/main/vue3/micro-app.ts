// vue3 主应用的挂载器组件。挂载逻辑全在框架无关的 ../controller 里，
// 这个文件只做三件事：渲染容器 div、把 props 交给控制器、销毁时收摊。
// props 严格对应 `loadMicroApp(app, configuration, lifeCycles)` 的三个入参。
import type { PropType } from 'vue'
import { computed, defineComponent, h, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'
import type { Router } from 'vue-router'
import { useRouter } from 'vue-router'
import type { FrameworkConfiguration, FrameworkLifeCycles } from 'qiankun'
import type { MicroAppConfig, MicroAppProps } from '../core/manifest'
import { createMicroAppController, needsOwnContainer } from '../core/controller'

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
export const MicroApp = defineComponent({
  name: 'MicroApp',
  props: {
    /**
     * loadMicroApp 第 1 参：清单里那条 qiankun 官方配置（RegistrableApp）。
     * `container` / `render` / `loader` / `props` 全是官方语义，原样透传；
     * 想让本组件自建容器就构个副本把 container 去掉（同页多实例必须这么写，
     * 否则几个实例会抢同一个节点）。kit 只往 `props` 里额外塞两个路由字段：
     * `routerBase`（不传则由 activeRule 推导）与 `routerMode`（不传则自动判定）。
     */
    app: { type: Object as PropType<MicroAppConfig>, required: true },
    /** loadMicroApp 第 2 参：官方 `start()` 的配置，传了就整体替换默认的 experimentalStyleIsolation */
    configuration: { type: Object as PropType<FrameworkConfiguration>, default: undefined },
    /** loadMicroApp 第 3 参：官方 `registerMicroApps` 的第二个参数（beforeLoad / beforeMount / ...） */
    lifeCycles: { type: Object as PropType<FrameworkLifeCycles<MicroAppProps>>, default: undefined },
  },
  setup(props) {
    // 本组件自建的容器（只在清单没给挂载点时才带 class）
    const ownContainer = ref<HTMLElement | null>(null)
    // 判定路由模式要读当前路径。类型上 useRouter() 非空，但组件被放进没装 router
    // 的应用里时实际会是 undefined，所以这里留了退路（控制器会退回 location）。
    const router = useRouter() as Router | undefined
    const controller = createMicroAppController({
      getCurrentPath: router ? () => router.currentRoute.value.path : undefined,
    })

    /** 清单没给 container / render 时，那个 div 才是子应用的挂载点 */
    const ownsContainer = computed(() => needsOwnContainer(props.app))

    function sync(): void {
      controller.sync({
        app: props.app,
        configuration: props.configuration,
        lifeCycles: props.lifeCycles,
        ownContainer: ownContainer.value,
      })
    }

    onMounted(sync)
    // 组件被复用时也能正确换应用：同一条路由记录换前缀参数（/tenant/:id/sub-a）、
    // 或者页面自己切应用 / 切声明的模式 / 切挂载点。这里刻意用 onUpdated 而不是
    // watch —— props 变了必然重渲染，而 sync 本身是幂等的（控制器按字符串 key 按
    // 值比较），所以“宁可多调一次”比“猜哪些字段该进 watch 源”更稳。
    onUpdated(sync)
    onBeforeUnmount(controller.destroy)

    // 这个 div 就是本组件的渲染输出 —— 它出现在组件被使用的位置（路由驱动就是
    // router-view 的位置），不做任何选择器查找，ownContainer ref 直接拿到它。
    // 始终渲染同一个 div：自建容器时挂上 .qiankun-micro-app，这只是给使用方的
    // 样式钩子（kit 不提供 CSS，demo 里给它画了一圈虚线框）；挂载点来自外部
    // （清单的 container 或 render 变体）时不加 class —— 否则使用方给这个 class
    // 定义的样式会在布局里留下一个可见空框。始终是同一个 div 元素，本组件被
    // router-view 跨应用复用、在自建容器与外部容器之间来回切换时 DOM 不抖动。
    return () => h('div', {
      ref: ownContainer,
      class: ownsContainer.value ? 'qiankun-micro-app' : undefined,
    })
  },
})
