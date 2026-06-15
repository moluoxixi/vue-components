/**
 * BFF 客户端：封装 /__ai-doc/api/* 的调用。
 * query 走 POST + SSE（fetch ReadableStream 手动分帧），其余为普通 JSON。
 */

const API_PREFIX = '/__ai-doc/api'

/** SSE 事件（与 server 端 protocol.SseEvent 对齐；前端独立声明避免打包 server 代码）。 */
export type SseEvent
  = | { type: 'sources', sources: SourceRef[] }
    | { type: 'token', text: string }
    | { type: 'example', code: string, lang: string }
    | { type: 'done' }
    | { type: 'error', error: string, message: string }

export interface SourceRef {
  component: string
  packageName: string
  docPath: string
  score: number
}

export interface ComponentListItem {
  name: string
  packageName: string
  propsCount: number
  docPath: string
}

export interface IndexStatusResponse {
  state: 'not_built' | 'building' | 'ready' | 'stale'
  builtAt: string | null
  stale: boolean
  componentCount: number
}

export interface HealthResponse {
  ok: boolean
  providers: { chat: 'configured' | 'missing', embedding: 'configured' | 'missing' }
  index: string
}

/** GET /health。 */
export async function fetchHealth(): Promise<HealthResponse> {
  const resp = await fetch(`${API_PREFIX}/health`)
  return resp.json()
}

/** GET /index/status。 */
export async function fetchStatus(): Promise<IndexStatusResponse> {
  const resp = await fetch(`${API_PREFIX}/index/status`)
  return resp.json()
}

/** GET /components。 */
export async function fetchComponents(): Promise<ComponentListItem[]> {
  const resp = await fetch(`${API_PREFIX}/components`)
  return resp.json()
}

/** POST /index/build。 */
export async function buildIndex(): Promise<IndexStatusResponse> {
  const resp = await fetch(`${API_PREFIX}/index/build`, { method: 'POST' })
  return resp.json()
}

/**
 * POST /query —— SSE 流式问答。
 * 用 fetch + ReadableStream 手动按 \n\n 分帧解析（POST 无法用 EventSource）。
 * 每解析出一个事件即回调 onEvent。
 */
export async function streamQuery(
  question: string,
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch(`${API_PREFIX}/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  })

  // 上游错误以 JSON 返回（非 SSE）：解析并以 error 事件抛给 UI
  if (!resp.ok || !resp.body) {
    const body = await resp.json().catch(() => ({ error: 'INTERNAL_ERROR', message: `HTTP ${resp.status}` }))
    onEvent({ type: 'error', error: body.error ?? 'INTERNAL_ERROR', message: body.message ?? '' })
    return
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const dataLine = frame.split('\n').find(l => l.startsWith('data:'))
      if (!dataLine)
        continue
      const json = dataLine.slice('data:'.length).trim()
      if (!json)
        continue
      onEvent(JSON.parse(json) as SseEvent)
    }
  }
}
