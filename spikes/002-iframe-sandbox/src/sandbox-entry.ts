import type {App} from 'vue';
import type {Options} from 'vue3-sfc-loader';
import * as vueRuntime from 'vue'
import { createApp, reactive  } from 'vue'
// 运行在 sandbox iframe 内部。esbuild 打包成自包含 IIFE 注入 srcdoc。
// 缺 allow-same-origin → opaque origin，访问父页面会抛 SecurityError。
import { loadModule  } from 'vue3-sfc-loader'

type HostMsg =
  | { type: 'mount', payload: { source: string, props: Record<string, unknown> } }
  | { type: 'update-props', payload: Record<string, unknown> }

function post(type: string, payload?: unknown) {
  // 父窗口是 opaque cross-origin，targetOrigin 用 '*'（沙箱无法得知父 origin）
  parent.postMessage({ type, payload }, '*')
}

// 主动探测隔离强度：尝试触碰父页面，预期全部抛错或不可达
function probeIsolation() {
  const results: Record<string, string> = {}
  try {
    // 读父 DOM
    const t = (parent as any).document.title
    results.readParentDoc = `LEAK: ${t}`
  }
  catch (e) {
    results.readParentDoc = `BLOCKED: ${(e as Error).name}`
  }
  try {
    // 写父 DOM
    ;(parent as any).document.title = 'HACKED'
    results.writeParentDoc = 'LEAK: wrote parent title'
  }
  catch (e) {
    results.writeParentDoc = `BLOCKED: ${(e as Error).name}`
  }
  try {
    const href = (parent as any).location.href
    results.readParentLocation = `LEAK: ${href}`
  }
  catch (e) {
    results.readParentLocation = `BLOCKED: ${(e as Error).name}`
  }
  post('isolation-probe', results)
}

let app: App | null = null
const propsState = reactive<Record<string, unknown>>({})

const options: Options = {
  moduleCache: { vue: vueRuntime },
  getFile: async (url: string) => {
    if (url === '/sandbox.vue')
      return currentSource
    throw new Error(`sandbox 不允许加载外部模块: ${url}`)
  },
  addStyle: (textContent: string) => {
    // 样式注入 iframe 自身 head，不会泄漏到宿主
    const style = document.createElement('style')
    style.textContent = textContent
    document.head.appendChild(style)
  },
  log: () => {},
}

let currentSource = ''

async function mount(source: string, props: Record<string, unknown>) {
  currentSource = source
  Object.keys(propsState).forEach(k => delete propsState[k])
  Object.assign(propsState, props)
  try {
    if (app) {
      app.unmount()
      app = null
    }
    const component = await loadModule('/sandbox.vue', options)
    app = createApp({
      render() {
        const h = (vueRuntime as any).h
        return h(component as any, {
          ...propsState,
          // fixture emit('ping', n) → 透传回宿主
          onPing: (...args: unknown[]) => post('event', { name: 'ping', args }),
        })
      },
    })
    const host = document.getElementById('mount')!
    app.mount(host)
    post('mounted', { ok: true })
  }
  catch (e) {
    post('error', { message: (e as Error).message })
  }
}

window.addEventListener('message', (ev: MessageEvent<HostMsg>) => {
  const msg = ev.data
  if (!msg || typeof msg !== 'object')
    return
  if (msg.type === 'mount')
    void mount(msg.payload.source, msg.payload.props)
  else if (msg.type === 'update-props')
    Object.assign(propsState, msg.payload)
})

// 启动即探测隔离 + 通知就绪
probeIsolation()
post('ready')
