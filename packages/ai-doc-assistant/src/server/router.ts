/**
 * 路由处理器：框架无关的 (req,res) 处理，兼容 Vite middleware 与 standalone http server。
 * 统一错误码映射 + SSE 写入。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  AiDocUIMessage,
  ApiErrorCode,
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
import { pipeUIMessageStreamToResponse, validateUIMessages } from 'ai'
import { contractToDetail } from '../core/knowledge-source'
import {
  API_PREFIX,
  ERROR_STATUS,
  MAX_HISTORY_CHARACTERS,
  MAX_HISTORY_MESSAGES,
} from '../shared/protocol'
import { providerStatusOf } from './ai-provider'
import { createQueryUIMessageStream, prepareQuery } from './query-handler'

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
  if (snap.status === 'stale')
    return 'stale'
  return 'not_built'
}

function messageText(message: AiDocUIMessage): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

/** Validate complete historical pairs plus the current final user message. */
function queryValidationError(messages: AiDocUIMessage[], topK: number | undefined): string | null {
  if (topK !== undefined && (!Number.isInteger(topK) || topK < 1 || topK > MAX_TOP_K))
    return `topK must be an integer between 1 and ${MAX_TOP_K}`
  if (messages.length === 0 || messages.length % 2 === 0)
    return 'messages must end with a user message after complete user/assistant pairs'

  const history = messages.slice(0, -1)
  if (history.length > MAX_HISTORY_MESSAGES)
    return `history must not exceed ${MAX_HISTORY_MESSAGES} messages`

  let totalCharacters = 0
  for (const [index, message] of messages.entries()) {
    const expectedRole = index % 2 === 0 ? 'user' : 'assistant'
    if (message.role !== expectedRole)
      return `message ${index} must have role ${expectedRole}`
    if (message.parts.some(part => part.type !== 'text' && !(message.role === 'assistant' && (part.type === 'data-sources' || part.type === 'data-example'))))
      return `message ${index} contains an unsupported part`
    const text = messageText(message)
    if (!text.trim())
      return `message ${index} text is required`
    if (index < messages.length - 1)
      totalCharacters += text.length
  }
  if (totalCharacters > MAX_HISTORY_CHARACTERS)
    return `history must not exceed ${MAX_HISTORY_CHARACTERS} characters`
  const question = messageText(messages[messages.length - 1])
  if (question.length > MAX_QUESTION_CHARACTERS)
    return `question must not exceed ${MAX_QUESTION_CHARACTERS} characters`
  return null
}

/** POST /query —— SSE 流式问答。 */
async function handleQuery(ctx: ServerContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<QueryRequest>(req)
  let messages: AiDocUIMessage[]
  try {
    messages = await validateUIMessages<AiDocUIMessage>({ messages: body.messages })
  }
  catch {
    sendError(res, 'INVALID_REQUEST', 'messages are invalid')
    return
  }
  const validationError = queryValidationError(messages, body.topK)
  if (validationError) {
    sendError(res, 'INVALID_REQUEST', validationError)
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

  try {
    const prepared = await prepareQuery(
      messages,
      body.topK ?? 5,
      strategy,
      controller.signal,
    )
    if (prepared.chunks.length > 0 && !ctx.languageModel)
      throw new Error('provider not configured')

    const stream = createQueryUIMessageStream(
      prepared,
      { model: ctx.languageModel },
      controller.signal,
    )
    await pipeUIMessageStreamToResponse({ response: res, stream })
  }
  catch (err) {
    if (canWrite() && !res.headersSent)
      sendError(res, classifyError(err), 'query stream failed')
  }
  finally {
    req.off('aborted', abortUpstream)
    res.off('close', onResponseClose)
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
    stale: snap.status === 'stale',
    componentCount: snap.meta?.componentCount ?? 0,
    internalCount: internalContracts.length,
    externalCount: externalContracts.length,
    embeddingIdentity: snap.meta?.embeddingIdentity ?? null,
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
    providers: status,
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
    await ctx.initialize()
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
