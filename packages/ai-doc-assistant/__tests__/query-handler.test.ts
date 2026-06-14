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
    // exampleCode 为 StrategyChunk 必填契约字段（双码），mock 必须满足
    exampleCode: { ts: `<${name} />`, js: `<${name} js />` },
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
    // 回答无 vue 代码块 → blocks 回退首个命中组件的确定性骨架；兼容字段指向该骨架
    expect(example).toEqual({
      type: 'example',
      code: '<MyButton />',
      lang: 'vue',
      ts: '<MyButton />',
      js: '<MyButton js />',
      component: 'MyButton',
      packageName: '@moluoxixi/components',
      blocks: [{ ts: '<MyButton />', js: '<MyButton js />', renderable: true }],
    })
    expect(events[events.length - 1]).toEqual({ type: 'done' })
  })

  it('回答含 vue 块：提取为 blocks，白名单内可渲染、白名单外标记不可渲染', async () => {
    const okBlock = '```vue\n<script setup lang="ts">\nimport { PopoverTableSelect } from \'@moluoxixi/components\'\n</script>\n<template><PopoverTableSelect /></template>\n```'
    const badBlock = '```vue\n<script setup lang="ts">\nimport { ElButton } from \'element-plus\'\n</script>\n<template><ElButton /></template>\n```'
    const deps: QueryDeps = {
      strategy: stubStrategy({ chunks: [chunk('PopoverTableSelect')], empty: false }),
      config: CONFIG,
      async* chat() {
        yield `示例如下：\n${okBlock}\n另一个需要外部库：\n${badBlock}`
      },
    }
    const events = await collect(runQuery('下拉表格配置', 5, deps))
    const example = events.find(e => e.type === 'example') as Extract<SseEvent, { type: 'example' }>
    expect(example.blocks).toHaveLength(2)
    expect(example.blocks[0].renderable).toBe(true)
    expect(example.blocks[0].ts).toContain('PopoverTableSelect')
    expect(example.blocks[1].renderable).toBe(false)
    expect(example.blocks[1].reason).toContain('element-plus')
    expect(example.ts).toContain('PopoverTableSelect')
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
