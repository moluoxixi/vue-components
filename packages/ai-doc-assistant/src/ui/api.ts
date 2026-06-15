import type {
  ComponentDetailResponse,
  ComponentListItem,
  HealthResponse,
  IndexStatusResponse,
  SseEvent,
} from '../shared/protocol'
/**
 * UI 侧 API 客户端：消费 BFF 的 SSE 问答流与状态接口。
 *
 * 复用 shared/protocol 的 SseEvent 类型与 parseSseFrame，保证前后端协议单一事实源。
 * /query 是 SSE 流，用 fetch + ReadableStream 逐帧解析（浏览器原生 EventSource 不支持 POST，故手解）。
 */
import { API_PREFIX, parseSseFrame } from '../shared/protocol'

/** GET /health。 */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_PREFIX}/health`)
  if (!res.ok)
    throw new Error(`health failed: ${res.status}`)
  return res.json() as Promise<HealthResponse>
}

/** GET /index/status。 */
export async function fetchStatus(): Promise<IndexStatusResponse> {
  const res = await fetch(`${API_PREFIX}/index/status`)
  if (!res.ok)
    throw new Error(`status failed: ${res.status}`)
  return res.json() as Promise<IndexStatusResponse>
}

/** POST /index/build —— 触发索引构建，完成后返回最新状态。 */
export async function buildIndex(): Promise<IndexStatusResponse> {
  const res = await fetch(`${API_PREFIX}/index/build`, { method: 'POST' })
  if (!res.ok)
    throw new Error(`build failed: ${res.status}`)
  return res.json() as Promise<IndexStatusResponse>
}

/** GET /components。 */
export async function fetchComponents(): Promise<ComponentListItem[]> {
  const res = await fetch(`${API_PREFIX}/components`)
  if (!res.ok)
    throw new Error(`components failed: ${res.status}`)
  return res.json() as Promise<ComponentListItem[]>
}

/** GET /components/:name —— 单组件完整契约（props/emits/slots/models/typeDefs）。 */
export async function fetchComponentDetail(name: string): Promise<ComponentDetailResponse> {
  const res = await fetch(`${API_PREFIX}/components/${encodeURIComponent(name)}`)
  if (!res.ok)
    throw new Error(`component detail failed: ${res.status}`)
  return res.json() as Promise<ComponentDetailResponse>
}

/**
 * POST /query 的 SSE 流式消费。逐事件回调，调用方据 type 更新 UI。
 * 用 fetch 读 body 流，按 SSE 帧分隔（空行）切分后交 parseSseFrame 解析。
 * 网络/HTTP 错误显式抛出，不静默吞掉。
 */
export async function streamQuery(
  question: string,
  topK: number,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_PREFIX}/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, topK }),
    signal,
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`query failed: ${res.status} ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // 逐块读取并按 SSE 帧边界（\n\n）切分，剩余不完整帧留在 buffer 等下一块
  while (true) {
    const { value, done } = await reader.read()
    if (done)
      break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      if (!frame.trim())
        continue
      const event = parseSseFrame(frame)
      if (event)
        onEvent(event)
    }
  }
  // flush 末帧（若服务端最后一帧未带空行结尾）
  if (buffer.trim()) {
    const event = parseSseFrame(buffer)
    if (event)
      onEvent(event)
  }
}
