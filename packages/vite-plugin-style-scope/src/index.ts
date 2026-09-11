import type { Plugin } from 'vite'
import type { AtRule } from 'postcss'
import prefixer from 'postcss-prefix-selector'

export interface StyleScopeOptions {
  /** 子应用名，作为作用域属性的值，需与 qiankun 注册的 name 保持一致 */
  appName: string
  /**
   * 是否给 node_modules 里的样式（组件库）也加前缀。
   * 默认 false —— 组件库的类名冲突应该用 Element Plus namespace / antd prefixCls 根治，
   * 靠前缀处理会让产物膨胀，且组件库自己 teleport 出去的元素依然打不到。
   */
  includeDeps?: boolean
  /**
   * 是否在 qiankun 环境下劫持 head / body 的动态插入（默认 true）：
   * 动态 <style> / <link> 改挂到 <qiankun-head>、body 上的弹窗改挂到子应用容器。
   * 也可在调用 applyStyleScope 时按次覆盖。
   */
  patchDom?: boolean
  /**
   * 扩展选项：自定义作用域属性名，默认 `data-qiankun` ——
   * qiankun 开启 experimentalStyleIsolation 时会给子应用包裹节点打上
   * `data-qiankun="<appName>"`，默认值让前缀直接复用 qiankun 自己的标记，
   * 无需运行时额外打属性。仅在需要避开 qiankun 语义时才自定义。
   */
  scopeAttr?: string
}

const VIRTUAL_ID = 'virtual:style-scope'
// Rollup 约定：虚拟模块的 resolved id 以 NUL 开头，避免其他插件把它当真实文件处理
const RESOLVED_ID = '\0' + VIRTUAL_ID

/** 属性名 / 属性值里只允许安全字符，否则属性选择器会成为非法选择器并静默失效 */
const SAFE_TOKEN_RE = /^[a-zA-Z][\w-]*$/
/** 兼容 @keyframes / @-webkit-keyframes / @-moz-keyframes */
const KEYFRAMES_RE = /-?keyframes$/i
/** 整条选择器就是根元素本身 */
const ROOT_ONLY_RE = /^(?::root|html|body)$/i
/** 以 :root 开头（含 :root.dark 这类复合写法） */
const ROOT_PSEUDO_LEAD_RE = /^:root(?![\w-])/i
/** 以 html / body 开头（含 html.dark 这类复合写法） */
const HTML_BODY_LEAD_RE = /^(?:html|body)(?![\w-])/i
/** 选择器的首个复合 token（到第一个组合器为止） */
const FIRST_TOKEN_RE = /^([^\s>~+]+)/

export function styleScope(options: StyleScopeOptions): Plugin {
  const { appName, includeDeps = false, patchDom = true, scopeAttr = 'data-qiankun' } = options

  if (!SAFE_TOKEN_RE.test(appName)) {
    throw new Error(
      `[vite-plugin-style-scope] appName "${appName}" 含非法字符，` +
        '只允许字母开头、由字母 / 数字 / - / _ 组成，否则属性选择器会静默失效',
    )
  }
  if (!SAFE_TOKEN_RE.test(scopeAttr)) {
    throw new Error(
      `[vite-plugin-style-scope] scopeAttr "${scopeAttr}" 含非法字符，` +
        '只允许字母开头、由字母 / 数字 / - / _ 组成，否则属性选择器会静默失效',
    )
  }

  /**
   * 原始前缀，权重 0,1,0 —— 用于需要保留权重的场合（:root 等）。
   * 默认形态 [data-qiankun="sub-b"]：qiankun experimentalStyleIsolation
   * 会给包裹节点打上同名属性，前缀直接复用它；带值匹配保证多个子应用互不误伤。
   */
  const rawPrefix = `[${scopeAttr}="${appName}"]`
  /**
   * :where() 包裹后权重归零，`:where([data-qiankun="x"]) .foo` 的权重等于 `.foo`。
   * 这样加前缀不会抬高权重去压过子应用自己的 scoped 样式。
   */
  const prefix = `:where(${rawPrefix})`

  // 虚拟模块只负责注入本应用的常量，真正的 DOM 逻辑在包内 runtime 模块里（可被类型检查）
  const virtualModule = `
import { createStyleScope } from 'vite-plugin-style-scope/runtime'

export const SCOPE_ATTR = ${JSON.stringify(scopeAttr)}
export const SCOPE_VALUE = ${JSON.stringify(appName)}

export function applyStyleScope(container, options) {
  return createStyleScope(container, {
    scopeAttr: SCOPE_ATTR,
    scopeValue: SCOPE_VALUE,
    patchDom: ${JSON.stringify(patchDom)},
    ...options,
  })
}
`

  return {
    name: 'vite-plugin-style-scope',

    config() {
      return {
        css: {
          postcss: {
            plugins: [
              prefixer({
                prefix,
                transform(_prefix, selector, prefixedSelector, filePath, rule) {
                  const parent = rule.parent

                  // 坑 1：@keyframes 内的 from / to / 50% 是关键帧选择器，
                  //       加前缀会让所有动画静默失效
                  if (parent?.type === 'atrule' && KEYFRAMES_RE.test((parent as AtRule).name)) {
                    return selector
                  }

                  // 坑 2：组件库样式默认不动，交给 namespace 方案
                  if (!includeDeps && filePath && filePath.includes('node_modules')) {
                    return selector
                  }

                  const trimmed = selector.trim()

                  // 坑 3：:root / html / body 要替换成前缀「本身」，否则定义在上面的
                  //       CSS 变量和盒模型丢作用域。这里用 rawPrefix 而非 :where()，
                  //       保住原有的 0,1,0 权重，避免变量被别处轻易覆盖。
                  if (ROOT_ONLY_RE.test(trimmed)) {
                    return rawPrefix
                  }
                  // `:root .foo` / `:root.dark ...`：:root 语义上就是「子应用根」，
                  // 直接替换成容器选择器，否则加完前缀永远匹配不到
                  if (ROOT_PSEUDO_LEAD_RE.test(trimmed)) {
                    return trimmed.replace(ROOT_PSEUDO_LEAD_RE, rawPrefix)
                  }
                  // `body .foo` / `html.dark .foo`：html / body 是容器的祖先，
                  // 在首个复合 token 之后插入前缀，而不是插在整条选择器前面
                  if (HTML_BODY_LEAD_RE.test(trimmed)) {
                    return trimmed.replace(FIRST_TOKEN_RE, '$1 ' + rawPrefix)
                  }

                  return prefixedSelector
                },
              }),
            ],
          },
        },
      }
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },

    load(id) {
      return id === RESOLVED_ID ? virtualModule : null
    },
  }
}

export default styleScope
