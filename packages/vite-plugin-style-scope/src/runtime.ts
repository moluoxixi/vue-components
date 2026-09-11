export interface StyleScopeRuntimeOptions {
  /** 作用域属性名，默认 data-qiankun（与 qiankun experimentalStyleIsolation 同名） */
  scopeAttr: string
  /** 作用域属性值，即子应用名 */
  scopeValue: string
  /**
   * 是否劫持 document.head / document.body 的动态插入（默认 true）。
   * 生效后：动态插入 head 的 <style> / <link rel="stylesheet"> 会被改挂到
   * 子应用的 <qiankun-head>；动态插入 body 的元素（Teleport 弹窗等）会被
   * 改挂到子应用根容器内。仅在检测到 qiankun 环境（存在 qiankun-head）时开启，
   * 独立运行时自动关闭。
   */
  patchDom?: boolean
}

export interface StyleScopeHandle {
  /** 卸载时调用：还原 DOM 劫持并摘掉作用域标记，可重复调用 */
  dispose: () => void
}

/** 从容器向上逐层查找 qiankun 渲染出来的 <qiankun-head>，找不到说明不在 qiankun 环境 */
function findQiankunHead(container: Element): Element | null {
  let cur: Element | null = container
  while (cur && cur !== document.documentElement) {
    const head = cur.querySelector('qiankun-head')
    if (head) return head
    cur = cur.parentElement
  }
  return null
}

/** 动态样式节点：<style> 或 <link rel="stylesheet"> */
function isStyleNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const el = node as HTMLElement
  return (
    el.tagName === 'STYLE'
    || (el.tagName === 'LINK' && (el as HTMLLinkElement).rel === 'stylesheet')
  )
}

/**
 * 在实例（而非原型）上覆盖 appendChild / insertBefore：
 * - 不污染 Node.prototype，主应用其他 DOM 操作不受影响；
 * - 还原时恢复被覆盖前的自有属性，支持多个子应用先 patch 后 unpatch。
 * redirect 返回非 null 表示已接管插入，否则回落到原生行为。
 */
function patchInsertion(
  target: HTMLElement,
  redirect: (node: Node) => Node | null,
): () => void {
  const prevAppend = Object.getOwnPropertyDescriptor(target, 'appendChild')
  const prevInsert = Object.getOwnPropertyDescriptor(target, 'insertBefore')
  const rawAppend = target.appendChild.bind(target)
  const rawInsert = target.insertBefore.bind(target)

  target.appendChild = function appendChild<T extends Node>(node: T): T {
    return (redirect(node) as T | null) ?? rawAppend(node)
  }
  // ref 节点在原容器里，重定向后语义退化为 append —— 对样式/弹窗节点无影响
  target.insertBefore = function insertBefore<T extends Node>(node: T, ref: Node | null): T {
    return (redirect(node) as T | null) ?? rawInsert(node, ref)
  }

  return () => {
    if (prevAppend) Object.defineProperty(target, 'appendChild', prevAppend)
    else Reflect.deleteProperty(target, 'appendChild')
    if (prevInsert) Object.defineProperty(target, 'insertBefore', prevInsert)
    else Reflect.deleteProperty(target, 'insertBefore')
  }
}

/**
 * 仿 qiankun 沙箱对动态插入的接管（vite ESM 脚本不经过 import-html-entry，
 * qiankun 自己的 patch 打不到，所以这里补上）：
 * - head 上的样式节点 → <qiankun-head>，随子应用卸载一起被移除，不残留；
 * - body 上的元素节点 → 子应用根容器，让 Teleport 出去的弹窗落在作用域内。
 *
 * 时序补偿：入口模块的 import（如 App.vue 的样式）在 applyStyleScope 之前
 * 就已注入 head，所以 patch 时会把存量的本应用前缀样式一并收编进 qiankun-head；
 * 还原时再搬回 document.head —— dev 下 ESM 模块有缓存，重新挂载不会重新注入样式，
 * 若随容器一起销毁，二次挂载就丢样式；放回 head 也不污染 —— 作用域属性已摘，
 * 前缀选择器命中不了任何元素。
 */
function patchDomInjection(
  container: Element,
  scopeAttr: string,
  scopeValue: string,
): () => void {
  const qiankunHead = findQiankunHead(container)
  // 找不到 qiankun-head 说明是独立运行，保持原生行为
  if (!qiankunHead) return () => {}

  /** 被我们搬进 qiankun-head 的样式节点，还原时需要搬回 head */
  const managedStyles = new Set<Node>()

  const restoreHead = patchInsertion(document.head, (node) => {
    if (!isStyleNode(node)) return null
    managedStyles.add(node)
    return qiankunHead.appendChild(node)
  })

  const restoreBody = patchInsertion(document.body, (node) => {
    // 只接管元素节点；<script>（部分 SDK 动态注入）保持原生行为
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const el = node as HTMLElement
    if (el.tagName === 'SCRIPT') return null
    return container.appendChild(el)
  })

  // 收编存量：patch 前已注入 head 的本应用样式（凭前缀里的作用域属性识别，
  // 未加前缀的 node_modules 样式可能与主应用共享，不动）
  const marker = `[${scopeAttr}="${scopeValue}"]`
  for (const style of Array.from(document.head.querySelectorAll('style'))) {
    if (style.textContent && style.textContent.includes(marker)) {
      managedStyles.add(style)
      qiankunHead.appendChild(style)
    }
  }

  return () => {
    restoreHead()
    restoreBody()
    // 搬回 head，保住 dev 模块缓存里的样式节点引用，二次挂载直接复用
    for (const style of managedStyles) {
      if (style.isConnected) document.head.appendChild(style)
    }
    managedStyles.clear()
  }
}

/**
 * 确保子应用处在作用域标记内；qiankun 环境下再劫持 head / body 的
 * 动态插入（见 patchDom 选项），Teleport 到 body 的弹窗会被重定向进容器，
 * 业务 DOM 和弹窗 DOM 都落在作用域内，无需额外的 portal 容器。
 *
 * 默认属性 data-qiankun="<appName>"：qiankun 开启 experimentalStyleIsolation
 * 时会自动打在包裹节点上，此时直接复用、不重复打；没开时才由这里补到容器上。
 *
 * qiankun 环境下标记只能在「容器/包裹节点」上而不是 document.body 上——
 * 打在 body 上会让 :where([data-qiankun="x"]) .foo 匹配到页面上任何 .foo
 * （含主应用），隔离归零。独立运行时页面上只有子应用自己，body 上追加
 * 一份标记是安全的，这样 Teleport 到 body 的弹窗（没有劫持兜底）也能命中前缀样式。
 */
export function createStyleScope(
  container: Element,
  { scopeAttr, scopeValue, patchDom = true }: StyleScopeRuntimeOptions,
): StyleScopeHandle {
  // qiankun 的包裹节点（或更上层）已有同名同值标记时直接复用，不重复打也不负责摘
  const marked = !container.closest(`[${scopeAttr}="${scopeValue}"]`)
  if (marked) container.setAttribute(scopeAttr, scopeValue)

  const restorePatch = patchDom ? patchDomInjection(container, scopeAttr, scopeValue) : () => {}

  // 独立运行（不在 qiankun 内）时给 body 兜底打标记
  const standalone = !findQiankunHead(container)
  if (standalone) document.body.setAttribute(scopeAttr, scopeValue)

  let disposed = false
  return {
    dispose() {
      // 幂等：qiankun unmount 与业务代码可能重复调用
      if (disposed) return
      disposed = true
      restorePatch()
      if (marked) container.removeAttribute(scopeAttr)
      if (standalone) document.body.removeAttribute(scopeAttr)
    },
  }
}
