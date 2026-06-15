/**
 * 路由处理器：框架无关的 (req,res) 处理，兼容 Vite middleware 与 standalone http server。
 * 统一错误码映射 + SSE 写入。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  ApiErrorCode,
  ComponentDetailResponse,
  ComponentListItem,
  HealthResponse,
  IndexState,
  IndexStatusResponse,
  QueryRequest,
} from '../shared/protocol'
import type { ServerContext } from './context'
import { Buffer } from 'node:buffer'
import {
  API_PREFIX,
  encodeSseEvent,
  ERROR_STATUS,
} from '../shared/protocol'
import { streamChat } from './ai-client'
import { providerStatusOf } from './ai-provider'
import { runQuery } from './query-handler'

/** 读取并解析 JSON 请求体（边界输入，解析失败抛 INVALID_REQUEST 语义）。 */
async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw)
    return {} as T
  return JSON.parse(raw) as T
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

/** POST /query —— SSE 流式问答。 */
async function handleQuery(ctx: ServerContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody<QueryRequest>(req)
  if (!body.question || typeof body.question !== 'string') {
    sendError(res, 'INVALID_REQUEST', 'question is required')
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
    for await (const event of runQuery(body.question, body.topK ?? 5, deps))
      res.write(encodeSseEvent(event))
  }
  catch (err) {
    const code = classifyError(err)
    res.write(encodeSseEvent({
      type: 'error',
      error: code,
      message: err instanceof Error ? err.message : String(err),
    }))
  }
  finally {
    res.end()
  }
}

/** GET /index/status。 */
function handleStatus(ctx: ServerContext, res: ServerResponse): void {
  const snap = ctx.state.snapshot()
  const body: IndexStatusResponse = {
    state: deriveIndexState(ctx),
    builtAt: snap.meta?.builtAt ?? null,
    stale: false,
    componentCount: snap.meta?.componentCount ?? 0,
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
  const items: ComponentListItem[] = ctx.getContracts().map(c => ({
    name: c.name,
    packageName: c.packageName,
    propsCount: c.props.length,
    docPath: c.sourceFile,
  }))
  sendJson(res, 200, items)
}

/** GET /components/:name —— 单组件完整契约（含展开的关联类型定义）。 */
function handleComponentDetail(ctx: ServerContext, name: string, res: ServerResponse): void {
  const decoded = decodeURIComponent(name)
  const c = ctx.getContracts().find(x => x.name === decoded)
  if (!c) {
    sendError(res, 'NOT_FOUND', `component not found: ${decoded}`)
    return
  }
  // core 契约字段与 wire 形态同构，直接结构化投影（避免泄漏 core 内部引用）
  const body: ComponentDetailResponse = {
    name: c.name,
    packageName: c.packageName,
    description: c.description,
    docPath: c.sourceFile,
    props: c.props.map(p => ({
      name: p.name,
      type: p.type,
      required: p.required,
      defaultValue: p.defaultValue,
      description: p.description,
      typeRefs: p.typeRefs,
    })),
    emits: c.emits.map(e => ({ name: e.name, payloadType: e.payloadType, description: e.description })),
    slots: c.slots.map(s => ({ name: s.name, description: s.description })),
    models: c.models.map(m => ({ name: m.name, type: m.type })),
    typeDefs: c.typeDefs.map(t => ({
      name: t.name,
      kind: t.kind,
      fields: t.fields.map(f => ({ name: f.name, type: f.type, optional: f.optional, description: f.description })),
      raw: t.raw,
    })),
  }
  sendJson(res, 200, body)
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
    if (method === 'GET' && path === '/health') {
      handleHealth(ctx, res)
      return true
    }
    sendError(res, 'INVALID_REQUEST', `unknown route: ${method} ${path}`)
    return true
  }
  catch (err) {
    if (!res.headersSent)
      sendError(res, classifyError(err), err instanceof Error ? err.message : String(err))
    else
      res.end()
    return true
  }
}
