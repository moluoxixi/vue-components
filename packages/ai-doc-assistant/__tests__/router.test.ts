import type { RetrievalStrategy } from '../src/core/retrieval-strategy'
import type { ServerContext } from '../src/server/context'

// @vitest-environment node
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { dispatch } from '../src/server/router'

// mock ai-client：query 成功路径用流式 token，避免真实上游（content 策略无 embed）
vi.mock('../src/server/ai-client', () => ({
  streamChat: vi.fn(async function* () {
    yield 'Hello'
    yield ' world'
  }),
}))

/** 捕获响应的 mock ServerResponse。 */
function makeRes() {
  const res: any = {
    statusCode: 0,
    headers: {} as Record<string, unknown>,
    chunks: [] as string[],
    headersSent: false,
    writeHead(status: number, headers?: Record<string, unknown>) {
      res.statusCode = status
      if (headers)
        res.headers = headers
      res.headersSent = true
      return res
    },
    write(s: string) {
      res.chunks.push(s)
      return true
    },
    end(s?: string) {
      if (s)
        res.chunks.push(s)
      res.ended = true
    },
    get body() {
      return res.chunks.join('')
    },
    json() {
      return JSON.parse(res.body)
    },
  }
  return res
}

/** 构造 mock IncomingMessage（可选 JSON body）。 */
function makeReq(method: string, url: string, body?: unknown): any {
  const raw = body === undefined ? '' : JSON.stringify(body)
  const stream: any = Readable.from(raw ? [Buffer.from(raw)] : [])
  stream.method = method
  stream.url = url
  return stream
}

/** 构造 stub ServerContext。 */
function makeCtx(overrides: Partial<Record<string, unknown>> = {}): ServerContext {
  const base: any = {
    config: { chatApiKey: 'k', embeddingApiKey: 'k' },
    mode: 'content',
    state: { snapshot: () => ({ status: 'idle', meta: null, error: null }) },
    getStrategy: () => ({
      mode: 'content',
      isReady: () => true,
      build: async () => ({ builtAt: 'x', componentCount: 0 }),
      retrieve: async () => ({ chunks: [], empty: true }),
    }) as unknown as RetrievalStrategy,
    getContracts: () => [],
    buildIndex: async () => {},
  }
  return Object.assign(base, overrides) as ServerContext
}

describe('dispatch 路由分发', () => {
  it('非本插件前缀 → 返回 false（交还下游）', async () => {
    const res = makeRes()
    const handled = await dispatch(makeCtx(), makeReq('GET', '/other'), res)
    expect(handled).toBe(false)
  })

  it('gET /health → 暴露配置态，绝不含密钥值', async () => {
    const res = makeRes()
    await dispatch(makeCtx(), makeReq('GET', '/__ai-doc/api/health'), res)
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.ok).toBe(true)
    expect(json.providers).toEqual({ chat: 'configured' })
    expect(json.mode).toBe('content')
    expect(res.body).not.toContain('"k"')
  })

  it('gET /index/status → 返回 not_built（idle）', async () => {
    const res = makeRes()
    await dispatch(makeCtx(), makeReq('GET', '/__ai-doc/api/index/status'), res)
    expect(res.json().state).toBe('not_built')
  })

  it('gET /components → 映射契约列表', async () => {
    const ctx = makeCtx({
      getContracts: () => [{ name: 'Btn', packageName: '@x/c', props: [{}, {}], sourceFile: 'a.vue' }],
    })
    const res = makeRes()
    await dispatch(ctx, makeReq('GET', '/__ai-doc/api/components'), res)
    expect(res.json()).toEqual([{ name: 'Btn', packageName: '@x/c', propsCount: 2, docPath: 'a.vue' }])
  })

  it('gET /components/:name → 返回单组件完整契约', async () => {
    const ctx = makeCtx({
      getContracts: () => [{
        name: 'PopoverTableSelect',
        packageName: '@x/c',
        sourceFile: 'a.vue',
        description: '弹窗表格选择',
        props: [{ name: 'columns', type: 'PopoverTableColumn[]', required: false, description: '列配置', typeRefs: ['PopoverTableColumn'] }],
        emits: [{ name: 'select', payloadType: '[row: PopoverTableRow]', description: '选择', typeRefs: ['PopoverTableRow'] }],
        slots: [{ name: 'cell', scopeType: '{ row: PopoverTableRow }', description: '单元格', typeRefs: ['PopoverTableRow'] }],
        models: [{ name: 'modelValue', type: 'string' }],
        exposed: [{ name: 'options', type: 'ThrottleOrDebounceOptions', description: '节流配置', typeRefs: ['ThrottleOrDebounceOptions'] }],
        typeDefs: [
          { name: 'PopoverTableColumn', kind: 'interface', raw: 'interface ...', fields: [{ name: 'field', type: 'string', optional: false, description: '字段' }] },
          { name: 'PopoverTableRow', kind: 'interface', raw: 'interface ...', fields: [{ name: 'id', type: 'string', optional: false, description: '行ID' }] },
          { name: 'ThrottleOrDebounceOptions', kind: 'interface', raw: 'interface ...', fields: [{ name: 'wait', type: 'number', optional: false, description: '等待时间' }] },
        ],
      }],
    })
    const res = makeRes()
    await dispatch(ctx, makeReq('GET', '/__ai-doc/api/components/PopoverTableSelect'), res)
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.name).toBe('PopoverTableSelect')
    expect(json.props[0].typeRefs).toEqual(['PopoverTableColumn'])
    expect(json.emits[0].typeRefs).toEqual(['PopoverTableRow'])
    expect(json.slots[0].scopeType).toBe('{ row: PopoverTableRow }')
    expect(json.slots[0].typeRefs).toEqual(['PopoverTableRow'])
    expect(json.exposed[0].typeRefs).toEqual(['ThrottleOrDebounceOptions'])
    expect(json.typeDefs[0].fields[0].name).toBe('field')
  })

  it('gET /components/:name → URL 编码组件名可解析', async () => {
    const ctx = makeCtx({
      getContracts: () => [{ name: 'Foo Bar', packageName: '@x/c', sourceFile: 'a.vue', props: [], emits: [], slots: [], models: [], typeDefs: [] }],
    })
    const res = makeRes()
    await dispatch(ctx, makeReq('GET', '/__ai-doc/api/components/Foo%20Bar'), res)
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Foo Bar')
  })

  it('gET /components/:name → 未知组件返回 NOT_FOUND', async () => {
    const res = makeRes()
    await dispatch(makeCtx(), makeReq('GET', '/__ai-doc/api/components/Nope'), res)
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('NOT_FOUND')
  })

  it('pOST /query 缺 question → INVALID_REQUEST', async () => {
    const res = makeRes()
    await dispatch(makeCtx(), makeReq('POST', '/__ai-doc/api/query', {}), res)
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('INVALID_REQUEST')
  })

  it('pOST /query provider 未配置 → UPSTREAM_ERROR', async () => {
    const ctx = makeCtx({ config: null })
    const res = makeRes()
    await dispatch(ctx, makeReq('POST', '/__ai-doc/api/query', { question: 'hi' }), res)
    expect(res.json().error).toBe('UPSTREAM_ERROR')
  })

  it('pOST /index/build 失败 → 映射错误码', async () => {
    const ctx = makeCtx({
      buildIndex: async () => { throw new Error('provider not configured: key missing') },
    })
    const res = makeRes()
    await dispatch(ctx, makeReq('POST', '/__ai-doc/api/index/build'), res)
    expect(res.json().error).toBe('UPSTREAM_ERROR')
  })

  it('未知路由 → INVALID_REQUEST', async () => {
    const res = makeRes()
    const handled = await dispatch(makeCtx(), makeReq('GET', '/__ai-doc/api/nope'), res)
    expect(handled).toBe(true)
    expect(res.json().error).toBe('INVALID_REQUEST')
  })

  it('pOST /query 成功 → SSE 流式输出 token 并以 done 收尾', async () => {
    const ctx = makeCtx({
      getStrategy: () => ({
        mode: 'content',
        isReady: () => true,
        build: async () => ({ builtAt: 'x', componentCount: 1 }),
        retrieve: async () => ({
          empty: false,
          chunks: [{ component: 'Btn', packageName: '@x/c', docPath: 'packages/Btn/src/index.vue', body: 'Btn docs', example: '<Btn />', exampleCode: { ts: '<Btn />', js: '<Btn />' }, score: 0.9 }],
        }),
      }) as unknown as RetrievalStrategy,
    })
    const res = makeRes()
    const handled = await dispatch(ctx, makeReq('POST', '/__ai-doc/api/query', { question: 'how to use Btn' }), res)
    expect(handled).toBe(true)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    // SSE 帧含流式 token 与 done 事件
    expect(res.body).toContain('Hello')
    expect(res.body).toContain('event: done')
    expect(res.ended).toBe(true)
  })
})
