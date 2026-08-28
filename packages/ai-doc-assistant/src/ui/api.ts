import type {
  ComponentDetailResponse,
  ComponentListItem,
  HealthResponse,
  IndexStatusResponse,
  KnowledgeImportPayload,
  KnowledgeImportResult,
} from '../shared/protocol'
/** UI 侧 REST API 客户端；对话由 ChatView 的 AI SDK transport 管理。 */
import { API_PREFIX } from '../shared/protocol'

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
