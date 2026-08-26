/**
 * 路由处理器：框架无关的 (req,res) 处理，兼容 Vite middleware 与 standalone http server。
 * 统一错误码映射 + SSE 写入。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  ApiErrorCode,
  ChatHistoryMessage,
  ComponentDetailResponse,
  ComponentListItem,
  HealthResponse,
  IndexState,
  IndexStatusResponse,
  KnowledgeImportRequest,
  QueryRequest,
} from '../shared/protocol'
import type { ServerContext } from './context'
import { Buffer } from 'node:buffer'
import { contractToDetail } from '../core/knowledge-source'
import {
  API_PREFIX,
  encodeSseEvent,
  ERROR_STATUS,
  MAX_HISTORY_CHARACTERS,
  MAX_HISTORY_MESSAGES,
} from '../shared/protocol'
import { streamChat } from './ai-client'
import { providerStatusOf } from './ai-provider'
import { runQuery } from './query-handler'

const MAX_QUESTION_CHARACTERS = 4_000
const MAX_TOP_K = 20

/** 读取并解析 JSON 请求体（边界输入，解析失败抛 INVALID_REQUEST 语义）。 */
async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw)
    return {} as T
  try {
    return JSON.parse(raw) as T
  }
  catch {
    throw new Error('invalid json body')
  }
}

/** 写 JSON 响应。 */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/** 写统一错误响应。 */
function sendError(res: ServerResponse, code: ApiErrorCode, message: string): void {
  sendJson(res, ERROR_STATUS[code], { error: code, message })
}

/** 把内部错误归类为对外错误码。 */
function classifyError(err: unknown): ApiErrorCode {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('index not ready') || msg.includes('index not found'))
    return 'INDEX_NOT_READY'
  if (msg.includes('invalid json body'))
    return 'INVALID_REQUEST'
  if (msg.includes('upstream') || msg.includes('provider not configured'))
    return 'UPSTREAM_ERROR'
  return 'INTERNAL_ERROR'
}

/** 推导对外索引状态。 */
function deriveIndexState(ctx: ServerContext): IndexState {
  const snap = ctx.state.snapshot()
  if (snap.status === 'building')
    return 'building'
  if (snap.status === 'ready')
    return 'ready'
  return 'not_built'
}

/** 校验不可信 query body；客户端只可回传完整的 user/assistant 对。 */
function queryValidationError(body: QueryRequest): string | null {
  if (typeof body.question !== 'string' || body.question.trim().length === 0)
    return 'question is required'
  if (body.question.length > MAX_QUESTION_CHARACTERS)
    return `question must not exceed ${MAX_QUESTION_CHARACTERS} characters`
  if (body.topK !== undefined && (!Number.isInteger(body.topK) || body.topK < 1 || body.topK > MAX_TOP_K))
    return `topK must be an integer between 1 and ${MAX_TOP_K}`
  if (body.history === undefined)
    return null
  if (!Array.isArray(body.history))
    return 'history must be an array'
  if (body.history.length > MAX_HISTORY_MESSAGES)
    return `history must not exceed ${MAX_HISTORY_MESSAGES} messages`
  if (body.history.length % 2 !== 0)
    return 'history must contain complete user/assistant pairs'

  let totalCharacters = 0
  for (const [index, message] of body.history.entries()) {
    const expectedRole: ChatHistoryMessage['role'] = index % 2 === 0 ? 'user' : 'assistant'
    if (!message || message.role !== expectedRole)
      return `history message ${index} must have role ${expectedRole}`
    if (typeof message.content !== 'string' || message.content.trim().length === 0)
      return `history message ${index} content is required`
    totalCharacters += message.content.length
  }
  if (totalCharacters > MAX_HISTORY_CHARACTERS)
    return `history must not exceed ${MAX_HISTORY_CHARACTERS} characters`
  return null
}

/** POST /query —— SSE 流式问答。 */
async function handleQuery(ctx: ServerContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<QueryRequest>(req)
  const validationError = queryValidationError(body)
  if (validationError) {
    sendError(res, 'INVALID_REQUEST', validationError)
    return
  }
  if (!ctx.config) {
    sendError(res, 'UPSTREAM_ERROR', 'provider not configured')
    return
  }
  // 索引未构建时策略为 null，明确返回 INDEX_NOT_READY，不静默空答
  const strategy = ctx.getStrategy()
  if (!strategy) {
    sendError(res, 'INDEX_NOT_READY', 'index not ready')
    return
  }

  const controller = new AbortController()
  let clientDisconnected = false
  const abortUpstream = (): void => {
    clientDisconnected = true
    controller.abort()
  }
  const onResponseClose = (): void => {
    if (!res.writableEnded)
      abortUpstream()
  }
  req.once('aborted', abortUpstream)
  res.once('close', onResponseClose)

  if (req.aborted || res.destroyed)
    abortUpstream()

  const canWrite = (): boolean =>
    !clientDisconnected && !controller.signal.aborted && !res.destroyed && !res.writableEnded

  if (!canWrite()) {
    req.off('aborted', abortUpstream)
    res.off('close', onResponseClose)
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
  })

  const deps = {
    strategy,
    config: ctx.config,
    chat: streamChat,
  }

  try {
    for await (const event of runQuery(
      body.question.trim(),
      body.topK ?? 5,
      deps,
      body.history ?? [],
      controller.signal,
    )) {
      if (!canWrite())
        break
      res.write(encodeSseEvent(event))
    }
  }
  catch (err) {
    if (canWrite()) {
      const code = classifyError(err)
      res.write(encodeSseEvent({
        type: 'error',
        error: code,
        message: err instanceof Error ? err.message : String(err),
      }))
    }
  }
  finally {
    req.off('aborted', abortUpstream)
    res.off('close', onResponseClose)
    if (canWrite())
      res.end()
  }
}

/** GET /index/status。 */
function handleStatus(ctx: ServerContext, res: ServerResponse): void {
  const snap = ctx.state.snapshot()
  const internalContracts = ctx.getContracts()
  const externalContracts = typeof ctx.getExternalContracts === 'function' ? ctx.getExternalContracts() : []
  const body: IndexStatusResponse = {
    state: deriveIndexState(ctx),
    builtAt: snap.meta?.builtAt ?? null,
    stale: false,
    componentCount: snap.meta?.componentCount ?? 0,
    internalCount: internalContracts.length,
    externalCount: externalContracts.length,
  }
  sendJson(res, 200, body)
}

/** POST /index/build。 */
async function handleBuild(ctx: ServerContext, res: ServerResponse): Promise<void> {
  try {
    await ctx.buildIndex()
    handleStatus(ctx, res)
  }
  catch (err) {
    sendError(res, classifyError(err), err instanceof Error ? err.message : String(err))
  }
}

/** GET /components。 */
function handleComponents(ctx: ServerContext, res: ServerResponse): void {
  const contracts = typeof ctx.getAllContracts === 'function'
    ? ctx.getAllContracts()
    : ctx.getContracts().map(contract => ({ contract, source: 'internal' as const, key: `internal:${encodeURIComponent(contract.packageName)}:${encodeURIComponent(contract.name)}` }))
  const items: ComponentListItem[] = contracts.map(({ contract: c, source, key }) => ({
    name: c.name,
    packageName: c.packageName,
    propsCount: c.props.length,
    docPath: c.sourceFile,
    source,
    knowledgeKey: key,
  }))
  sendJson(res, 200, items)
}

/** GET /components/:name —— 单组件完整契约（含展开的关联类型定义）。 */
function handleComponentDetail(ctx: ServerContext, name: string, res: ServerResponse): void {
  const decoded = decodeURIComponent(name)
  const contracts = typeof ctx.getAllContracts === 'function'
    ? ctx.getAllContracts()
    : ctx.getContracts().map(contract => ({ contract, source: 'internal' as const, key: `internal:${encodeURIComponent(contract.packageName)}:${encodeURIComponent(contract.name)}` }))
  const found = contracts.find(x => x.key === decoded || x.contract.name === decoded)
  if (!found) {
    sendError(res, 'NOT_FOUND', `component not found: ${decoded}`)
    return
  }
  const c = found.contract
  // core 契约字段与 wire 形态同构，直接结构化投影（避免泄漏 core 内部引用）
  const body: ComponentDetailResponse = contractToDetail(c, found.source)
  sendJson(res, 200, body)
}

/** POST /knowledge/import —— 导入外部知识库。 */
async function handleKnowledgeImport(ctx: ServerContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<KnowledgeImportRequest>(req)
  if (!body.payload) {
    sendError(res, 'INVALID_REQUEST', 'payload is required')
    return
  }
  try {
    const result = await ctx.importKnowledge(body.payload, body.overwrite === true)
    sendJson(res, result.status === 'conflict' ? 409 : 200, result)
  }
  catch (err) {
    sendError(res, 'INVALID_REQUEST', err instanceof Error ? err.message : String(err))
  }
}

/** GET /health —— 仅暴露配置态，绝不含密钥。 */
function handleHealth(ctx: ServerContext, res: ServerResponse): void {
  const status = providerStatusOf(ctx.config)
  const body: HealthResponse = {
    ok: true,
    providers: { chat: status.chat },
    mode: ctx.mode,
    index: deriveIndexState(ctx),
  }
  sendJson(res, 200, body)
}

/**
 * 主分发：返回 true 表示已处理该请求，false 表示非本插件路由（交还下游）。
 */
export async function dispatch(
  ctx: ServerContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? ''
  if (!url.startsWith(API_PREFIX))
    return false

  const path = url.slice(API_PREFIX.length).split('?')[0]
  const method = req.method ?? 'GET'

  try {
    if (method === 'POST' && path === '/query') {
      await handleQuery(ctx, req, res)
      return true
    }
    if (method === 'GET' && path === '/index/status') {
      handleStatus(ctx, res)
      return true
    }
    if (method === 'POST' && path === '/index/build') {
      await handleBuild(ctx, res)
      return true
    }
    if (method === 'GET' && path === '/components') {
      handleComponents(ctx, res)
      return true
    }
    if (method === 'GET' && path.startsWith('/components/')) {
      handleComponentDetail(ctx, path.slice('/components/'.length), res)
      return true
    }
    if (method === 'POST' && path === '/knowledge/import') {
      await handleKnowledgeImport(ctx, req, res)
      return true
    }
    if (method === 'GET' && path === '/health') {
      handleHealth(ctx, res)
      return true
    }
    sendError(res, 'INVALID_REQUEST', `unknown route: ${method} ${path}`)
    return true
  }
  catch (err) {
    if (!res.destroyed && !res.writableEnded) {
      if (!res.headersSent)
        sendError(res, classifyError(err), err instanceof Error ? err.message : String(err))
      else
        res.end()
    }
    return true
  }
}
