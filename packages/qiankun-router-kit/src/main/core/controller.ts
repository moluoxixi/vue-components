// 主应用侧的挂载控制器 —— 框架无关，没有一行 UI 代码。
// 每个 qiankun 主应用都要重写一遍的那些东西全在这里：loadMicroApp 调用、
// 卸载时机、loading 回调、挂载串行化、地址栏归属与路由模式判定、挂载点解析。
//
// 各框架的壳（vue3 组件 / vue2 组件对象 / react 组件）只负责三件事：
//   1. 渲染一个容器 div（仅当清单没给 container / render 时）
//   2. 挂载后与每次更新后调 sync()  —— 幂等，内部按「值」比较 key，没变就不动
//   3. 销毁前调 destroy()
// 这个契约刻意做成幂等的：三种框架的更新钩子语义各不相同（Vue watch / Vue 2
// updated / React useEffect），谁也不必自己判断"该不该重挂"。
import type { FrameworkConfiguration, FrameworkLifeCycles, HTMLContentRender, MicroApp as MicroAppHandle } from 'qiankun'
import { loadMicroApp } from 'qiankun'
import type { RouterMode } from '../../sub/core/index'
import type { MicroAppConfig, MicroAppEntry, MicroAppProps } from './manifest'
import { resolveDefaultBase } from './manifest'

/** 默认沙箱：开启 qiankun 运行时 scoped css */
const defaultConfiguration: FrameworkConfiguration = {
  sandbox: { experimentalStyleIsolation: true },
}

// 全局单条串行队列，跨应用、跨框架共用。两个原因：
// 1. qiankun 不允许同名实例共存，而“旧实例卸载”和“新实例挂载”常常分属两个组件
//    （比如多实例页的 memory 版切到路由页的 history 版）：卸载是异步的，各组件
//    各自排队就会撞在一起。
// 2. 不同名的应用也不能并发加载，原因见 awaitMounted。
let queue: Promise<void> = Promise.resolve()

function enqueue(name: string, task: () => void | Promise<void>): Promise<void> {
  queue = queue.then(task).catch((err) => {
    console.error(`[qiankun-router-kit] 子应用「${name}」挂载/卸载失败`, err)
  })
  return queue
}

// 一个挂不上的子应用不该卡死整条队列，超时就放行下一个（qiankun 自己的
// bootstrap 超时警告是 4s，这里留足余量）
const MOUNT_TIMEOUT = 10_000

/**
 * 队列要等到「挂载完成」才放行下一个应用，光等 loadMicroApp 返回不够。
 *
 * import-html-entry 在执行子应用的每段脚本前，都会把当前沙箱 proxy 赋给真实
 * window 上的全局 `window.proxy`（后来者覆盖前者）。而 vite-plugin-qiankun 注入的
 * helper 是在原生动态 import 出来的模块顶层读 `window.proxy`，靠它的 qiankunName
 * 决定把 lifecycle 写进 `window.moudleQiankunAppLifeCycles` 的哪个键。两个 Vite
 * 子应用的「执行脚本 → 模块求值」窗口一旦重叠，先求值的那个就会把 lifecycle 写到
 * 后来者的键上，于是它自己的交接代码读不到 lifecycle，bootstrap 永远不 resolve
 * （表现为 single-spa #31 反复告警）。谁被串掉是随机的。
 *
 * 代价是同页多实例变成逐个挂载。路由驱动场景本来就是一个接一个，没有损失。
 */
function awaitMounted(handle: MicroAppHandle): Promise<unknown> {
  return Promise.race([
    handle.mountPromise,
    new Promise(resolve => setTimeout(resolve, MOUNT_TIMEOUT)),
  ])
}

// 地址栏全局只有一份，所以同一时刻只能有一个实例绑它（history 模式），其余
// 必须走 memory，否则两个 router 会互相改写 URL —— 症状是地址栏诡异跳变，极难
// 定位。谁绑谁不绑由下面的 resolveMode 自动判定，使用方不用管。
// 判定能可靠，靠的是上面那条全局串行队列：框架切换视图时先销毁旧壳再挂新壳，
// 排到自己时旧实例一定已经释放，不会把正常切换误判成冲突。
let historyOwner: object | null = null

/** entry 可以是资源清单对象，key 要看内容而不是对象引用 */
function entryKey(entry: MicroAppEntry): string {
  return typeof entry === 'string' ? entry : JSON.stringify(entry)
}

// 给元素、函数这类无法序列化的值分配稳定 id，好塞进 key 里按值比较。
// WeakMap 不阻止它们被回收。
const identityIds = new WeakMap<object, number>()
let identitySeq = 0
function identityKey(value: object | undefined): string {
  if (value === undefined)
    return ''
  let id = identityIds.get(value)
  if (id === undefined)
    identityIds.set(value, id = ++identitySeq)
  return `#${id}`
}

/** 挂载点的 key：字符选择器直接用值本身，元素用稳定 id */
function containerKey(container: string | HTMLElement | undefined): string {
  if (typeof container === 'string')
    return `s:${container}`
  return container ? `e:${identityKey(container)}` : ''
}

/** 挂载点：官方 LoadableApp 那两种变体之一 */
type MountTarget = { container: string | HTMLElement } | { render: HTMLContentRender }

/**
 * 清单没给挂载点时，容器要由框架壳自己渲染一个 div。
 * 壳拿它决定要不要渲染那个 div、要不要挂 `.qiankun-micro-app` class。
 */
export function needsOwnContainer(app: MicroAppConfig): boolean {
  return (app.container ?? undefined) === undefined && typeof app.render !== 'function'
}

/** 一次同步的全部输入 —— 就是 `loadMicroApp` 的三个入参，外加壳自建的容器 */
export interface MicroAppMountInput {
  /** 清单里那条 qiankun 官方配置（RegistrableApp），原样交进来 */
  app: MicroAppConfig
  /** 官方 `start()` 的配置，不传用 kit 默认值（experimentalStyleIsolation） */
  configuration?: FrameworkConfiguration
  /** 官方 `registerMicroApps` 的第二个参数 */
  lifeCycles?: FrameworkLifeCycles<MicroAppProps>
  /** 壳自建的容器元素。`app.container` / `app.render` 存在时忽略它 */
  ownContainer?: HTMLElement | null
}

export interface MicroAppControllerOptions {
  /**
   * 读主应用当前路由 path，用于判断 URL 是否落在这个实例的 base 底下。
   * 要传**已剥掉主应用自身 base** 的 path（vue-router 的 `route.path`、
   * react-router 的 `useLocation().pathname` 都是这个语义）—— 主应用部署在
   * `/app/` 子路径下时直接比 `location.pathname` 会误判。
   * 不传则退回 `location.pathname`。
   */
  getCurrentPath?: () => string
}

export interface MicroAppController {
  /**
   * 幂等同步。壳在「挂载后」和「每次更新后」都调它，内部把关键字段拼成字符串
   * 按值比较：变了才卸载重挂，没变什么都不做。
   *
   * 必须按值比较而不是按引用：路由下发时要把实际匹配到的 routerBase 注进 app，
   * 每次导航（哪怕只是 /sub-a → /sub-a/ 这种归一化）都会造一个全新的 app 对象，
   * 按引用比就会把子应用无谓地卸了重挂 —— 而 Vite 子应用二次挂载的生命周期会
   * 挂起（沙箱 proxy 只在模块首次求值时捕获），直接拖死整条串行队列。
   */
  sync: (input: MicroAppMountInput) => void
  /** 壳销毁前调：卸载子应用并释放地址栏归属 */
  destroy: () => void
}

/**
 * 创建一个挂载控制器，对应页面上一个子应用实例（一个框架壳一个）。
 *
 * 挂载点优先级：`app.render` → `app.container` → 壳自建的 `ownContainer`。
 * 前两种是官方语义，原样透传给 qiankun（包括“所有子应用共用布局里一个
 * #subapp-viewport”这种写法）。
 *
 * 路由模式不用管：当前 URL 在这个实例的 base 底下才绑地址栏（history），
 * 否则走 memory —— 同页挂多个时谁也不抢 URL。详见 resolveMode。
 */
export function createMicroAppController({ getCurrentPath }: MicroAppControllerOptions = {}): MicroAppController {
  let handle: MicroAppHandle | null = null
  // 卸载要按“挂载时的名字”排队：name 变了之后旧实例还得跟旧名字的队列走
  let mountedName = ''
  // 上次真正挂上去的那组输入的 key，null 表示当前没有挂载
  let mountedKey: string | null = null
  // 本控制器的身份，用于认领/释放地址栏（不能用 name：同名应用可能先卸后挂）
  const instanceToken = {}

  /**
   * 组装 loadMicroApp 的挂载点参数。外部 container 原样透传（字符串保持字符串，
   * 让 qiankun 按官方逻辑自己解析），只额外做一次存在性预检 —— 我们知道是哪个
   * 应用、哪条清单配置，能给出比 qiankun 那句 "Wrapper element is not existed"
   * 有用得多的报错。
   */
  function resolveMountTarget({ app, ownContainer }: MicroAppMountInput): MountTarget | null {
    if (typeof app.render === 'function')
      return { render: app.render }
    const external = app.container ?? undefined
    if (external === undefined)
      return ownContainer ? { container: ownContainer } : null
    if (typeof external === 'string' && !document.querySelector(external)) {
      throw new Error(`[qiankun-router-kit] 子应用「${app.name}」的挂载点 '${external}' 在页面上找不到。`
        + '请确认这个节点在子应用挂载前已经渲染出来，或者去掉清单里的 container（改由 MicroApp 自建容器）')
    }
    return { container: external }
  }

  /** 当前 URL 是否落在这个实例的 base 底下 */
  function isUnderBase(base: string): boolean {
    if (base === '/')
      return true
    const path = getCurrentPath ? getCurrentPath() : window.location.pathname
    return path === base || path.startsWith(`${base}/`)
  }

  /**
   * 路由模式自动判定 —— 使用方不用传。地址栏全局只有一份，history 模式的
   * 含义就是“这个子应用的 router 绑定地址栏”，所以最多一个实例能拿到：
   *
   * 1. 当前 URL 不在这个实例的 base 底下（同页嵌多个展示型实例就属于这种）——
   *    子应用 router 拿这个地址连自己的路由都匹配不到，history 本来就是坏的
   * 2. 同一个 base 下真开了两个实例（同应用 tab 多开）—— 先到先得，后来者降级
   *
   * 子应用只吃某种模式时，清单里写 `props.routerMode` 可以压过自动判定。
   */
  function resolveMode(name: string, base: string, declared?: RouterMode): RouterMode {
    if (declared === 'memory')
      return 'memory'
    if (!isUnderBase(base))
      return 'memory'
    if (historyOwner && historyOwner !== instanceToken) {
      console.warn(`[qiankun-router-kit] 子应用「${name}」想绑地址栏，但页面上已经有另一个实例占着了，`
        + '本实例自动降为 memory 模式（同页共存只能有一个绑地址栏）')
      return 'memory'
    }
    return declared ?? 'history'
  }

  function mount(input: MicroAppMountInput): void {
    const { name, entry, loader, props: appProps } = input.app
    const base = appProps?.routerBase ?? resolveDefaultBase(input.app)
    mountedName = name
    loader?.(true)
    // loading 的关闭统一收在 finally：挂载点找不到是抛错路径，散着写迟早漏一条，
    // 把使用方的 loader 永久留在 true
    enqueue(name, async () => {
      try {
        const target = resolveMountTarget(input)
        if (!target)
          return
        // 模式判定必须放在队列任务内：排到自己时旧实例一定已经释放了
        // historyOwner，才不会把正常的路由切换误判成两个实例抢地址栏
        const mode = resolveMode(name, base, appProps?.routerMode)
        if (mode === 'history')
          historyOwner = instanceToken
        handle = loadMicroApp(
          {
            name,
            entry,
            ...target,
            // 路由前缀显式下发（base 不能由子应用自己猜，见坑 A），
            // memory 模式让多个实例共存时谁也不抢地址栏
            props: { ...appProps, routerBase: base, routerMode: mode },
          },
          input.configuration ?? defaultConfiguration,
          input.lifeCycles,
        )
        await awaitMounted(handle)
      }
      finally {
        loader?.(false)
      }
    })
  }

  function unmount(): void {
    if (!mountedName)
      return
    // 地址栏同步释放：框架都是先销毁旧壳再挂新壳，早一步释放才不会
    // 把“切走旧应用 / 挂上新应用”误判成两个实例抢地址栏
    if (historyOwner === instanceToken)
      historyOwner = null
    // 先把 handle 的所有权交给闭包再排队：卸载是异步的，若等到队列执行时
    // 才读共享的 handle，期间 mount 已经把它指向新实例，就会把新实例当旧实例卸了
    const target = handle
    const name = mountedName
    handle = null
    mountedName = ''
    enqueue(name, async () => {
      await target?.unmount()
    })
  }

  /** 把决定“要不要重挂”的字段拼成一个字符串，按值比较 */
  function computeKey({ app, ownContainer }: MicroAppMountInput): string {
    return [
      app.name,
      entryKey(app.entry),
      app.props?.routerBase,
      app.props?.routerMode,
      containerKey(app.container ?? undefined),
      typeof app.render === 'function' ? `r:${identityKey(app.render)}` : '',
      // 壳自建的那个 div 万一被框架换掉（整棵子树重建），也要重挂
      needsOwnContainer(app) ? `o:${identityKey(ownContainer ?? undefined)}` : '',
    ].join('\u0000')
  }

  return {
    sync(input) {
      // 壳还没把容器渲染出来就先等下一次 sync —— 此时不能落 mountedKey，
      // 否则下次带着容器进来会被判成“没变化”而永远挂不上
      if (needsOwnContainer(input.app) && !input.ownContainer)
        return
      const key = computeKey(input)
      if (key === mountedKey)
        return
      unmount()
      mountedKey = key
      mount(input)
    },
    destroy() {
      mountedKey = null
      unmount()
    },
  }
}
