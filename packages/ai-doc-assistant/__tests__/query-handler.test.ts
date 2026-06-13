import type {
  RetrievalStrategy,
  StrategyChunk,
  StrategyResult,
} from '../src/core/retrieval-strategy'
import type { ProviderConfig } from '../src/server/ai-provider'
import type { QueryDeps } from '../src/server/query-handler'
import type { SseEvent } from '../src/shared/protocol'
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { runQuery } from '../src/server/query-handler'

const CONFIG = {} as ProviderConfig

function chunk(name: string): StrategyChunk {
  return {
    component: name,
    packageName: '@moluoxixi/components',
    docPath: `packages/${name}/src/index.vue`,
    body: `${name} body`,
    example: `<${name} />`,
    score: 0.9,
  }
}

/** 构造 stub 策略：retrieve 返回固定结果。 */
function stubStrategy(result: StrategyResult): RetrievalStrategy {
  return {
    mode: 'content',
    build: async () => ({ builtAt: 'x', componentCount: result.chunks.length }),
    isReady: () => true,
    retrieve: async () => result,
  }
}

/** 收集生成器全部事件。 */
async function collect(gen: AsyncGenerator<SseEvent>): Promise<SseEvent[]> {
  const events: SseEvent[] = []
  for await (const e of gen)
    events.push(e)
  return events
}

describe('runQuery SSE 编排', () => {
  it('命中：sources → token* → example → done', async () => {
    const deps: QueryDeps = {
      strategy: stubStrategy({ chunks: [chunk('MyButton')], empty: false }),
      config: CONFIG,
      async* chat() {
        yield '这是'
        yield '回答'
      },
    }
    const events = await collect(runQuery('怎么用按钮', 5, deps))
    expect(events[0]).toEqual({
      type: 'sources',
      sources: [{ component: 'MyButton', packageName: '@moluoxixi/components', docPath: 'packages/MyButton/src/index.vue', score: 0.9 }],
    })
    expect(events.filter(e => e.type === 'token').map(e => (e as { text: string }).text)).toEqual(['这是', '回答'])
    const example = events.find(e => e.type === 'example')
    expect(example).toEqual({ type: 'example', code: '<MyButton />', lang: 'vue' })
    expect(events[events.length - 1]).toEqual({ type: 'done' })
  })

  it('无命中：兜底告知不编造，不调用 chat', async () => {
    let chatCalled = false
    const deps: QueryDeps = {
      strategy: stubStrategy({ chunks: [], empty: true }),
      config: CONFIG,
      async* chat() {
        chatCalled = true
      },
    }
    const events = await collect(runQuery('不存在的组件', 5, deps))
    expect(chatCalled).toBe(false)
    expect(events[0]).toEqual({ type: 'sources', sources: [] })
    const token = events.find(e => e.type === 'token') as { text: string }
    expect(token.text).toContain('未找到')
    expect(events.find(e => e.type === 'example')).toBeUndefined()
    expect(events[events.length - 1]).toEqual({ type: 'done' })
  })

  it('策略 retrieve 抛错时向上传播（不静默吞）', async () => {
    const failing: RetrievalStrategy = {
      mode: 'content',
      build: async () => ({ builtAt: 'x', componentCount: 0 }),
      isReady: () => true,
      retrieve: async () => { throw new Error('strategy not built') },
    }
    const deps: QueryDeps = {
      strategy: failing,
      config: CONFIG,
      async* chat() {},
    }
    await expect(collect(runQuery('q', 5, deps))).rejects.toThrow(/not built/)
  })
})
