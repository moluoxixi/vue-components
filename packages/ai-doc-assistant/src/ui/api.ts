import type {
  ChatHistoryMessage,
  ComponentDetailResponse,
  ComponentListItem,
  HealthResponse,
  IndexStatusResponse,
  KnowledgeImportPayload,
  KnowledgeImportResult,
  SseEvent,
} from '../shared/protocol'
/**
 * UI 侧 API 客户端：消费 BFF 的 SSE 问答流与状态接口。
 *
 * 复用 shared/protocol 的 SseEvent 类型与 parseSseFrame，保证前后端协议单一事实源。
 * /query 是 SSE 流，用 fetch + ReadableStream 逐帧解析（浏览器原生 EventSource 不支持 POST，故手解）。
 */
import { API_PREFIX, parseSseFrame } from '../shared/protocol'

async function apiError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null) as { message?: unknown } | null
  const message = body && typeof body.message === 'string' ? body.message : `${fallback}: ${res.status}`
  return new Error(message)
}

/** GET /health。 */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_PREFIX}/health`)
  if (!res.ok)
    throw await apiError(res, 'health failed')
  return res.json() as Promise<HealthResponse>
}

/** GET /index/status。 */
export async function fetchStatus(): Promise<IndexStatusResponse> {
  const res = await fetch(`${API_PREFIX}/index/status`)
  if (!res.ok)
    throw await apiError(res, 'status failed')
  return res.json() as Promise<IndexStatusResponse>
}

/** POST /index/build —— 触发索引构建，完成后返回最新状态。 */
export async function buildIndex(): Promise<IndexStatusResponse> {
  const res = await fetch(`${API_PREFIX}/index/build`, { method: 'POST' })
  if (!res.ok)
    throw await apiError(res, 'build failed')
  return res.json() as Promise<IndexStatusResponse>
}

/** GET /components。 */
export async function fetchComponents(): Promise<ComponentListItem[]> {
  const res = await fetch(`${API_PREFIX}/components`)
  if (!res.ok)
    throw await apiError(res, 'components failed')
  return res.json() as Promise<ComponentListItem[]>
}

/** GET /components/:name —— 单组件完整契约（props/emits/slots/models/typeDefs）。 */
export async function fetchComponentDetail(name: string): Promise<ComponentDetailResponse> {
  const res = await fetch(`${API_PREFIX}/components/${encodeURIComponent(name)}`)
  if (!res.ok)
    throw await apiError(res, 'component detail failed')
  return res.json() as Promise<ComponentDetailResponse>
}

/** POST /knowledge/import —— 导入外部知识库，重复外部项由调用方二次确认 overwrite。 */
export async function importKnowledge(payload: KnowledgeImportPayload, overwrite = false): Promise<KnowledgeImportResult> {
  const res = await fetch(`${API_PREFIX}/knowledge/import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload, overwrite }),
  })
  const body = await res.json().catch(() => null) as KnowledgeImportResult | { message?: string } | null
  if (!res.ok && body && 'status' in body && body.status === 'conflict')
    return body
  if (!res.ok)
    throw new Error((body && 'message' in body && body.message) ? body.message : `knowledge import failed: ${res.status}`)
  return body as KnowledgeImportResult
}

/**
 * POST /query 的 SSE 流式消费。逐事件回调，调用方据 type 更新 UI。
 * 用 fetch 读 body 流，按 SSE 帧分隔（空行）切分后交 parseSseFrame 解析。
 * 网络/HTTP 错误显式抛出，不静默吞掉。
 */
export async function streamQuery(
  question: string,
  topK: number,
  history: ChatHistoryMessage[],
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_PREFIX}/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, topK, history }),
    signal,
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`query failed: ${res.status} ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminalEventSeen = false

  const consumeFrame = (frame: string): void => {
    if (!frame.trim())
      return
    const event = parseSseFrame(frame)
    if (!event)
      return
    if (terminalEventSeen)
      throw new Error('query stream received data after terminal event')
    onEvent(event)
    if (event.type === 'done' || event.type === 'error')
      terminalEventSeen = true
  }

  try {
    // 同时兼容 LF 与 CRLF 帧边界，剩余不完整帧留在 buffer 等下一块。
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''
      for (const frame of frames)
        consumeFrame(frame)
    }
    buffer += decoder.decode()
    // flush 末帧（若服务端最后一帧未带空行结尾）
    consumeFrame(buffer)
    if (!terminalEventSeen)
      throw new Error('query stream ended before a terminal event')
  }
  finally {
    reader.releaseLock()
  }
}
