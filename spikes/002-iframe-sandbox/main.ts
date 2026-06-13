// 宿主页面：创建 sandbox iframe，注入打包好的沙箱脚本，驱动 postMessage 协议。
// 沙箱构建产物以 raw 文本引入（Vite ?raw），内联进 srcdoc —— 沙箱无网络依赖，自包含。
import sandboxScript from './sandbox-build/sandbox.iife.js?raw'
import { SANDBOX_SFC } from './src/fixtures'

const logEl = document.getElementById('log')!
const probeEl = document.getElementById('probe')!
function log(line: string) {
  logEl.textContent += line + '\n'
}

// 关键：sandbox="allow-scripts" 但【不加】allow-same-origin → opaque origin，
// 沙箱内访问 parent.document / cookie / localStorage 抛 SecurityError。
const iframe = document.createElement('iframe')
iframe.id = 'sandbox'
iframe.setAttribute('sandbox', 'allow-scripts')
iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body><div id="mount"></div><script>${sandboxScript}<\/script></body></html>`
document.getElementById('frame-host')!.appendChild(iframe)

const win = () => iframe.contentWindow!

window.addEventListener('message', (ev: MessageEvent) => {
  const msg = ev.data
  if (!msg || typeof msg !== 'object' || !msg.type)
    return
  switch (msg.type) {
    case 'ready':
      log('ready')
      // 沙箱就绪后下发挂载
      win().postMessage({ type: 'mount', payload: { source: SANDBOX_SFC, props: { label: 'Hello Sandbox', count: 1 } } }, '*')
      break
    case 'isolation-probe':
      // 把隔离探测结果写进可见 DOM
      probeEl.textContent = JSON.stringify(msg.payload)
      log('isolation-probe: ' + JSON.stringify(msg.payload))
      break
    case 'mounted':
      log('mounted')
      break
    case 'event':
      log('event: ' + JSON.stringify(msg.payload))
      break
    case 'error':
      log('error: ' + JSON.stringify(msg.payload))
      break
  }
})

// 暴露给 Playwright 的操作钩子
;(window as any).__updateProps = (props: Record<string, unknown>) => {
  win().postMessage({ type: 'update-props', payload: props }, '*')
}
