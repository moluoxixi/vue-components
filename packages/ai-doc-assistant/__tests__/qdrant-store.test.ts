import type { AddressInfo, Server } from 'node:net'
import type { VectorDoc, VectorIndexMetadata } from '../src/core/vector'
import { Buffer } from 'node:buffer'
/**
 * QdrantVectorStore 真实 HTTP 往返测试。
 *
 * @vitest-environment node
 *
 * 本测试不 mock fetch：在进程内起一个实现 Qdrant REST 子集的真实 HTTP server
 * （node:http，真实端口、真实 JSON 协议、真实余弦相似度近邻计算），
 * 让 QdrantVectorStore 经 fetch 真实建集合 / upsert / search 一条往返链路。
 * 验证「可连接外部向量后端」这一契约本身成立，而非桩代码。
 */
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { QdrantVectorStore } from '../src/core/vector/adapters/qdrant-store'

const TEST_VECTOR_DIMENSION = 4

/** 极简内存版 Qdrant：实现适配器用到的 4 个端点 + 真实余弦相似度排序。 */
interface StoredPoint {
  id: string | number
  vector: number[]
  payload: Record<string, unknown>
}

function metadata(sourceHash = 'source-v1', model = 'embed-v1'): VectorIndexMetadata {
  return {
    sourceHash,
    embeddingIdentity: {
      provider: 'openai-compatible',
      model,
      endpointFingerprint: 'endpoint-v1',
      dimension: TEST_VECTOR_DIMENSION,
    },
  }
}

/** 余弦相似度（与 Qdrant Cosine 距离一致的打分方向：越大越相似）。 */
function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/** 起一个真实 HTTP server，模拟 Qdrant REST 行为。返回 server + base url。 */
function startFakeQdrant(): Promise<{
  server: Server
  url: string
  calls: string[]
  searchFilters: unknown[]
}> {
  const collections = new Map<string, StoredPoint[]>()
  const dimensions = new Map<string, number>()
  const calls: string[] = []
  const searchFilters: unknown[] = []

  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c as Buffer))
    req.on('end', () => {
      const url = req.url ?? ''
      const method = req.method ?? 'GET'
      calls.push(`${method} ${url.split('?')[0]}`)
      const raw = Buffer.concat(chunks).toString('utf8')
      const body = raw ? JSON.parse(raw) : {}

      // DELETE /collections/:name —— 幂等删除（不存在也返回 ok）
      const delMatch = url.match(/^\/collections\/([^/?]+)$/)
      if (method === 'DELETE' && delMatch) {
        if (delMatch[1] === 'delete-fails') {
          res.writeHead(503, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ status: { error: 'delete unavailable' } }))
          return
        }
        collections.delete(delMatch[1])
        dimensions.delete(delMatch[1])
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ result: true, status: 'ok' }))
        return
      }

      // PUT /collections/:name —— 建集合
      if (method === 'PUT' && delMatch) {
        collections.set(delMatch[1], [])
        dimensions.set(delMatch[1], body.vectors.size)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ result: true, status: 'ok' }))
        return
      }

      if (method === 'GET' && delMatch && collections.has(delMatch[1])) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          result: { config: { params: { vectors: { size: dimensions.get(delMatch[1]) } } } },
          status: 'ok',
        }))
        return
      }

      // POST /collections/:name/points —— 按 id 读取持久化 metadata 点
      const pointsMatch = url.match(/^\/collections\/([^/?]+)\/points$/)
      if (method === 'POST' && pointsMatch) {
        const ids = new Set(body.ids as Array<string | number>)
        const result = (collections.get(pointsMatch[1]) ?? [])
          .filter(point => ids.has(point.id))
          .map(point => ({ id: point.id, payload: point.payload }))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ result, status: 'ok' }))
        return
      }

      // PUT /collections/:name/points —— upsert 点
      const upsertMatch = url.match(/^\/collections\/([^/?]+)\/points/)
      if (method === 'PUT' && upsertMatch) {
        const list = collections.get(upsertMatch[1])
        if (!list) {
          res.writeHead(404, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ status: { error: 'collection not found' } }))
          return
        }
        for (const p of body.points as StoredPoint[])
          list.push(p)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ result: { status: 'completed' }, status: 'ok' }))
        return
      }

      // POST /collections/:name/points/search —— 向量近邻召回
      const searchMatch = url.match(/^\/collections\/([^/?]+)\/points\/search$/)
      if (method === 'POST' && searchMatch) {
        const list = collections.get(searchMatch[1]) ?? []
        const query = body.vector as number[]
        const filter = body.filter as {
          must?: Array<{ key?: unknown, match?: { value?: unknown } }>
        } | undefined
        searchFilters.push(filter)
        const documentOnly = filter?.must?.some(condition => (
          condition.key === 'kind' && condition.match?.value === 'document'
        ))
        const scored = list
          .filter(point => !documentOnly || point.payload.kind === 'document')
          .map(p => ({ id: p.id, score: cosine(query, p.vector), payload: p.payload }))
          .sort((a, b) => b.score - a.score)
          .slice(0, body.limit ?? 10)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ result: scored, status: 'ok' }))
        return
      }

      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: { error: `unhandled ${method} ${url}` } }))
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ server, url: `http://127.0.0.1:${port}`, calls, searchFilters })
    })
  })
}

/** 造一个指定维度、在某一维置 1 的单位向量，便于构造可预期的相似度排序。 */
function unitVec(hot: number): number[] {
  const v = Array.from({ length: TEST_VECTOR_DIMENSION }).fill(0) as number[]
  v[hot] = 1
  return v
}

function vectorDoc(
  component: string,
  packageName: string,
  docPath: string,
  body: string,
  example: string,
  embedding: number[],
): VectorDoc {
  return {
    component,
    packageName,
    docPath,
    source: 'internal',
    knowledgeKey: `internal:${packageName}:${component}`,
    body,
    example,
    exampleJs: example,
    embedding,
  }
}

describe('qdrantVectorStore 真实 HTTP 往返', () => {
  let fake: { server: Server, url: string, calls: string[], searchFilters: unknown[] }

  beforeAll(async () => {
    fake = await startFakeQdrant()
  })

  afterAll(() => {
    fake.server.close()
  })

  it('build 后经真实 HTTP search 命中最相近文档', async () => {
    const store = new QdrantVectorStore({ url: fake.url, collection: 'docs' })
    await store.build([
      vectorDoc('ElButton', '@moluoxixi/button', 'packages/button/src/index.vue', '按钮组件 支持类型与尺寸', '<ElButton type="primary" />', unitVec(0)),
      vectorDoc('ElTable', '@moluoxixi/table', 'packages/table/src/index.vue', '表格组件 支持分页与排序', '<ElTable :data="rows" />', unitVec(1)),
    ], metadata())

    expect(store.isReady()).toBe(true)

    // 查询向量贴近第 0 维 → 应召回 ElButton 居首，且分数过阈值（非 empty）
    const result = await store.search('按钮怎么用', unitVec(0), 2)
    expect(result.empty).toBe(false)
    expect(result.chunks[0].component).toBe('ElButton')
    expect(result.chunks[0].example).toBe('<ElButton type="primary" />')
    expect(result.chunks[0].score).toBeGreaterThan(0.3)

    // 真实经过了 建集合 + upsert + search 的 HTTP 往返
    expect(fake.calls).toContain('PUT /collections/docs')
    expect(fake.calls).toContain('POST /collections/docs/points/search')
    expect(fake.searchFilters).toContainEqual({
      must: [{ key: 'kind', match: { value: 'document' } }],
    })
  })

  it('未 build 即 search 显式抛错（不静默伪装无命中）', async () => {
    const store = new QdrantVectorStore({ url: fake.url, collection: 'docs2' })
    await expect(store.search('x', unitVec(0), 1)).rejects.toThrow(/not built/)
  })

  it('维度不匹配在 build 时显式抛错', async () => {
    const store = new QdrantVectorStore({ url: fake.url, collection: 'docs3' })
    await expect(store.build([
      vectorDoc('Bad', '@moluoxixi/bad', 'x.vue', 'b', 'e', [1, 2, 3]),
    ], metadata())).rejects.toThrow(/dim mismatch/)
  })

  it('缺失连接配置在构造时显式抛错', () => {
    // @ts-expect-error 故意传非法配置验证边界校验
    expect(() => new QdrantVectorStore({ collection: 'x' })).toThrow(/url/)
    // @ts-expect-error 故意传非法配置验证边界校验
    expect(() => new QdrantVectorStore({ url: fake?.url ?? 'http://x' })).toThrow(/collection/)
  })

  it('dELETE 非 2xx 显式抛错且不继续创建集合', async () => {
    const store = new QdrantVectorStore({ url: fake.url, collection: 'delete-fails' })
    await expect(store.build([
      vectorDoc('Solo', '@moluoxixi/solo', 's.vue', 'b', 'e', unitVec(2)),
    ], metadata())).rejects.toThrow(/DELETE.*503.*delete unavailable/)
    expect(fake.calls).not.toContain('PUT /collections/delete-fails')
  })

  it('hydrate 校验远端 collection 维度与持久化元数据后恢复查询能力', async () => {
    const built = new QdrantVectorStore({ url: fake.url, collection: 'restore' })
    await built.build([
      vectorDoc('Restored', '@moluoxixi/restored', 'r.vue', 'b', 'e', unitVec(0)),
    ], metadata())

    const restored = new QdrantVectorStore({ url: fake.url, collection: 'restore' })
    await restored.hydrate(null, metadata())
    expect(restored.isReady()).toBe(true)
    await expect(restored.hydrate(null, {
      ...metadata(),
      embeddingIdentity: { ...metadata().embeddingIdentity, dimension: TEST_VECTOR_DIMENSION + 1 },
    })).rejects.toThrow(/dimension mismatch/)
  })

  it('hydrate 拒绝同维度但 identity 或 sourceHash 已漂移的远端 collection', async () => {
    const built = new QdrantVectorStore({ url: fake.url, collection: 'drift' })
    await built.build([
      vectorDoc('Original', '@moluoxixi/original', 'o.vue', 'b', 'e', unitVec(0)),
    ], metadata('source-new', 'embed-new'))

    const restored = new QdrantVectorStore({ url: fake.url, collection: 'drift' })
    await expect(restored.hydrate(null, metadata('source-old', 'embed-new')))
      .rejects
      .toThrow(/metadata mismatch/)
    await expect(restored.hydrate(null, metadata('source-new', 'embed-old')))
      .rejects
      .toThrow(/metadata mismatch/)
    expect(restored.isReady()).toBe(false)
  })
})
