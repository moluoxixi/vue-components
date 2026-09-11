// 主应用侧的应用清单：直接吃 qiankun 官方 registerMicroApps 的那份 RegistrableApp[]。
// 使用方不用为微前端另学一套配置格式，清单也能在 kit 与官方
// registerMicroApps 之间原样互换。
//
// 本文件只做校验与归一化，**不绑任何 router 实现**：把前缀翻译成路由记录的
// createMicroAppRoutes 各框架一份（./vue3/routes、./vue2/routes、./react/routes），
// 因为路由记录的形状是 router 库特有的。
//
// 类型一律从 qiankun 官方类型派生，不平行重写 —— 否则 qiankun 改了格式我们察觉不到，
// “照抄官方文档就能用”的承诺会静默失效。全部是 `import type`，编译后消失，
// 不会把 qiankun 运行时拖进这个框架无关入口。
import type { Entry, FrameworkConfiguration, FrameworkLifeCycles, HTMLContentRender, ObjectType, RegistrableApp } from 'qiankun'
import type { RouterMode } from '../../sub/core/index'

/** 就是 qiankun 的 `Entry`：入口 URL，或手动指定的资源清单 */
export type MicroAppEntry = Entry

/** 就是 qiankun `activeRule` 的类型（即 single-spa 的 `Activity`） */
export type MicroAppActiveRule = RegistrableApp<ObjectType>['activeRule']

/** activeRule 里的判定函数形态（single-spa 的 `ActivityFn`），kit 不支持它 */
export type MicroAppActivityFn = Extract<MicroAppActiveRule, (...args: never[]) => unknown>

/** 下发给子应用的 props，其中两个路由字段由 kit 填充 */
export interface MicroAppProps {
  /** 路由前缀，不传则由 activeRule 推导 */
  routerBase?: string
  /** history 绑地址栏 / memory 用于同页多实例共存，默认 history */
  routerMode?: RouterMode
  [key: string]: unknown
}

/**
 * 清单里的一条 —— 就是 qiankun `registerMicroApps` 的 `RegistrableApp`：
 * `{ name, entry, activeRule, container?, render?, loader?, props? }`，官方清单原样搬过来即可，
 * 额外的业务字段（title、icon、权限码等）随便带，kit 不碰。
 *
 * `container` / `render` 官方是二选一的联合类型，这里展平成两个可选字段，
 * 两种官方写法都能原样进来；都不写时 `MicroApp` 组件自建容器（路由驱动的默认）。
 *
 * 与官方格式唯一的收窄：`activeRule` 必须能反推出 URL 前缀（字符串或字符串数组），
 * 判定函数会被拒绝 —— 路由驱动要从它生成 path，函数推不出来。
 */
export interface MicroAppConfig {
  name: string
  entry: MicroAppEntry
  /**
   * 子应用的挂载点，语义与官方完全一致（选择器或元素，qiankun 把子应用
   * wrapper 塞进去，卸载时又清掉）。它可以是布局里的固定节点 —— 官方最常见的
   * 用法就是所有子应用共用一个 `#subapp-viewport`。不写则由 MicroApp 组件自建。
   */
  container?: string | HTMLElement
  /** 官方的自定义渲染函数（qiankun 已标 deprecated，仍可用），原样透传给 loadMicroApp */
  render?: HTMLContentRender
  activeRule: MicroAppActiveRule
  loader?: (loading: boolean) => void
  props?: MicroAppProps
  [key: string]: unknown
}

// 编译期断言：官方 `RegistrableApp` 的**两种变体**（container / render）都必须能原样当清单用。
// 这里直接断言完整联合类型，qiankun 日后改动必填字段或类型会直接编译不过，
// 而不是等到使用方照抄官方文档时才发现对不上。
const _officialConfigFitsManifest: (app: RegistrableApp<MicroAppProps>) => MicroAppConfig = app => app
void _officialConfigFitsManifest

const FORMAT_HINT = '应用清单必须是 qiankun registerMicroApps 的格式：'
  + '{ name, entry, activeRule, container?, render?, loader?, props? }'

function fail(index: number, field: string, reason: string): never {
  const at = field ? `apps[${index}].${field}` : `apps[${index}]`
  throw new TypeError(`[qiankun-router-kit] ${at} ${reason}。${FORMAT_HINT}`)
}

// container 只做格式校验（能不能真正选中节点要到挂载时才知道）。这里不能写
// `instanceof HTMLElement`：清单校验是纯数据逻辑，可能跑在没有 DOM 全局的环境
// （SSR、Node 脚本）里，那样会抛 ReferenceError 而不是我们想给的 TypeError。
// 改用 nodeType 鸭子判定，顺带兼容跨 realm（iframe）的元素。
function isValidContainer(container: unknown): boolean {
  if (typeof container === 'string')
    return Boolean(container.trim())
  return typeof container === 'object' && container !== null
    && (container as { nodeType?: unknown }).nodeType === 1
}

function assertEntry(entry: unknown, index: number): void {
  if (typeof entry === 'string') {
    if (!entry.trim())
      fail(index, 'entry', '不能是空字符串')
    return
  }
  if (entry !== null && typeof entry === 'object') {
    const { scripts, styles, html } = entry as Record<string, unknown>
    if (scripts === undefined && styles === undefined && html === undefined)
      fail(index, 'entry', '写成对象时至少要有 scripts / styles / html 之一')
    return
  }
  fail(index, 'entry', '必须是入口 URL 字符串，或 { scripts, styles, html } 资源清单')
}

/**
 * 剥掉 hash 模式的 '#'（vue-router 的 path 不含 '#'）、去掉尾部 '/'、补上前导 '/'。
 * 归一化后为空说明 activeRule 指向根路径。
 */
function toPrefix(rule: string): string {
  const prefix = rule.trim().replace(/^#/, '').replace(/\/+$/, '')
  if (!prefix)
    return ''
  return prefix.startsWith('/') ? prefix : `/${prefix}`
}

/**
 * activeRule → URL 前缀。qiankun 的 `'/sub-a'`、`'#/sub-a'`（hash 模式）、
 * 带参数的 `'/tenant/:id/sub-a'`、以及它们的数组都支持。
 *
 * 判定函数 `(location) => boolean` 反推不出 path，直接拒绝 —— 这种应用别进清单，
 * 自己写一条路由配上 MicroApp 组件即可。
 */
function normalizePrefixes(activeRule: unknown, index: number): string[] {
  const rules = Array.isArray(activeRule) ? activeRule : [activeRule]
  if (!rules.length)
    fail(index, 'activeRule', '不能是空数组')
  return rules.map((rule) => {
    if (typeof rule === 'function') {
      fail(index, 'activeRule', '不支持判定函数：路由驱动要从 activeRule 反推路由 path，函数推不出来。'
        + '改成字符串前缀，或者让这个应用不进清单 —— 自己写一条路由配上 MicroApp 组件')
    }
    if (typeof rule !== 'string' || !rule.trim())
      fail(index, 'activeRule', '必须是非空字符串前缀')
    const prefix = toPrefix(rule)
    if (!prefix)
      fail(index, 'activeRule', `'${rule}' 指向根路径，会吞掉主应用自己的全部路由，不能作为子应用前缀`)
    return prefix
  })
}

export interface NormalizedMicroApp {
  app: MicroAppConfig
  /** activeRule 归一化后的 URL 前缀，一个前缀对应一条路由记录 */
  prefixes: string[]
}

/**
 * 校验并归一化应用清单。格式不对当场抛错（而不是等挂载时才炸），
 * 错误信息带上是第几条、哪个字段、为什么不行。
 */
export function normalizeMicroApps(apps: MicroAppConfig[]): NormalizedMicroApp[] {
  if (!Array.isArray(apps))
    throw new TypeError(`[qiankun-router-kit] apps 必须是数组。${FORMAT_HINT}`)

  const names = new Set<string>()
  return apps.map((app, index) => {
    if (app === null || typeof app !== 'object')
      fail(index, '', '必须是对象')
    if (typeof app.name !== 'string' || !app.name.trim())
      fail(index, 'name', '必须是非空字符串（qiankun 用它做沙箱标识）')
    if (names.has(app.name))
      fail(index, 'name', `'${app.name}' 与前面的应用重名，name 必须唯一`)
    names.add(app.name)
    if (app.entry === undefined)
      fail(index, 'entry', '是必填字段')
    assertEntry(app.entry, index)
    // container 是真正的挂载点，但不强制填（不填就由 MicroApp 自建）；
    // 填了就得是合法值，别拿个空串拖到挂载时才炸
    if (app.container !== undefined && !isValidContainer(app.container))
      fail(index, 'container', '要么不填（由 MicroApp 组件自建容器），要么是非空选择器字符串或 HTMLElement')
    if (app.render !== undefined && typeof app.render !== 'function')
      fail(index, 'render', '必须是官方 HTMLContentRender 函数')
    if (app.activeRule === undefined)
      fail(index, 'activeRule', '是必填字段，kit 靠它生成路由')
    if (app.loader !== undefined && typeof app.loader !== 'function')
      fail(index, 'loader', '必须是 (loading: boolean) => void 函数')
    if (app.props !== undefined && (app.props === null || typeof app.props !== 'object'))
      fail(index, 'props', '必须是对象')
    return { app, prefixes: normalizePrefixes(app.activeRule, index) }
  })
}

/**
 * 各框架的路由参数对象都能塑进这个形状（vue-router 3/4/5 的 `route.params`、
 * react-router 6 的 `useParams()`），所以不引任何 router 类型。
 */
export type MicroAppRouteParams = Record<string, string | string[] | undefined>

/**
 * 用实际路由参数还原前缀（activeRule 里可能有 :id 这类动态段）。
 * 各框架的 createMicroAppRoutes 在下发 props 时调它算 routerBase。
 */
export function resolvePrefix(prefix: string, params: MicroAppRouteParams): string {
  if (!prefix.includes(':'))
    return prefix
  return prefix.replace(/:(\w+)/g, (_, key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value.join('/') : value ?? ''
  })
}

/**
 * 子应用的默认路由前缀。与 normalizeMicroApps 不同，这里**不抛错**：
 * 手动用 MicroApp 组件挂载（activeRule 是判定函数、干脆不写、或多实例共存）
 * 是合法退路，取第一个字符串 activeRule，实在没有就退回 `/${name}`。
 */
export function resolveDefaultBase({ name, activeRule }: { name: string, activeRule?: MicroAppActiveRule }): string {
  const rules = Array.isArray(activeRule) ? activeRule : [activeRule]
  const rule = rules.find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  return (rule && toPrefix(rule)) || `/${name}`
}

/**
 * qiankun 的两份全局配置，官方分别传给 `start(configuration)` 和
 * `registerMicroApps(apps, lifeCycles)`；路由驱动下统一在这里给，
 * 由 kit 透传给每个 `loadMicroApp(app, configuration, lifeCycles)`。
 */
export interface MicroAppRuntimeOptions {
  /** 官方 `start()` 的参数：沙箱、singular、excludeAssetFilter 等。不传用 kit 默认值 */
  configuration?: FrameworkConfiguration
  /** 官方 `registerMicroApps` 的第二个参数：beforeLoad / beforeMount / afterMount / ... */
  lifeCycles?: FrameworkLifeCycles<MicroAppProps>
}

