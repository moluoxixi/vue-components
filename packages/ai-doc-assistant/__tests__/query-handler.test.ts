import type {
  RetrievalStrategy,
  StrategyChunk,
  StrategyResult,
} from '../src/core/retrieval'
import type { AiDocUIMessage } from '../src/shared/protocol'
// @vitest-environment node
import {
  readUIMessageStream,
  simulateReadableStream,
} from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import {
  createQueryUIMessageStream,
  exampleBlocksFromAnswer,
  prepareQuery,
} from '../src/server/query-handler'

function chunk(name: string): StrategyChunk {
  return {
    component: name,
    packageName: '@moluoxixi/components',
    docPath: `packages/${name}/src/index.vue`,
    source: 'internal',
    knowledgeKey: `internal:%40moluoxixi%2Fcomponents:${name}`,
    body: `${name} body`,
    example: `<${name} />`,
    exampleCode: { ts: `<${name} />`, js: `<${name} js />` },
    score: 0.9,
  }
}

function stubStrategy(result: StrategyResult): RetrievalStrategy {
  return {
    mode: 'content',
    build: async () => ({ builtAt: 'x', componentCount: result.chunks.length }),
    isReady: () => true,
    retrieve: vi.fn(async () => result),
  }
}

function userMessage(id: string, text: string): AiDocUIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] }
}

function assistantMessage(id: string, text: string): AiDocUIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text }] }
}

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

function languageModel(answer: string): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doStream: {
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start' as const, warnings: [] },
          { type: 'text-start' as const, id: 'answer' },
          { type: 'text-delta' as const, id: 'answer', delta: answer },
          { type: 'text-end' as const, id: 'answer' },
          { type: 'finish' as const, finishReason: { unified: 'stop' as const, raw: undefined }, usage: USAGE },
        ],
        initialDelayInMs: null,
        chunkDelayInMs: null,
      }),
    },
  })
}

async function consumeStream(stream: ReturnType<typeof createQueryUIMessageStream>) {
  const [rawStream, messageStream] = stream.tee()
  const raw: Array<{ type: string }> = []
  const reader = rawStream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    raw.push(value)
  }

  let final: AiDocUIMessage | undefined
  for await (const message of readUIMessageStream<AiDocUIMessage>({ stream: messageStream }))
    final = message
  return { raw, final }
}

describe('aI SDK UI Message Stream query orchestration', () => {
  it('emits sources before text and examples after the complete answer', async () => {
    const messages = [userMessage('u1', '怎么用按钮')]
    const prepared = await prepareQuery(
      messages,
      5,
      stubStrategy({ chunks: [chunk('MyButton')], empty: false }),
    )
    const model = languageModel('这是回答')
    const { raw, final } = await consumeStream(
      createQueryUIMessageStream(prepared, { model }),
    )

    const sourceIndex = raw.findIndex(part => part.type === 'data-sources')
    const textIndex = raw.findIndex(part => part.type === 'text-delta')
    const exampleIndex = raw.findIndex(part => part.type === 'data-example')
    const finishIndex = raw.findIndex(part => part.type === 'finish')
    expect(sourceIndex).toBeGreaterThanOrEqual(0)
    expect(textIndex).toBeGreaterThan(sourceIndex)
    expect(exampleIndex).toBeGreaterThan(textIndex)
    expect(finishIndex).toBeGreaterThan(exampleIndex)
    expect(final?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'data-sources' }),
      expect.objectContaining({ type: 'text', text: '这是回答' }),
      expect.objectContaining({ type: 'data-example' }),
    ]))
  })

  it('returns the fixed no-match answer without calling a chat model', async () => {
    const model = new MockLanguageModelV3()
    const prepared = await prepareQuery(
      [userMessage('u1', '不存在的组件')],
      5,
      stubStrategy({ chunks: [], empty: true }),
    )
    const { final } = await consumeStream(
      createQueryUIMessageStream(prepared, { model: null }),
    )

    expect(model.doStreamCalls).toHaveLength(0)
    expect(final?.parts).toEqual(expect.arrayContaining([
      { type: 'data-sources', data: [] },
      expect.objectContaining({ type: 'text', text: expect.stringContaining('未找到') }),
    ]))
  })

  it('uses the newest two user questions for retrieval and injects context into model messages', async () => {
    const strategy = stubStrategy({ chunks: [chunk('RequestSelectV2')], empty: false })
    const messages = [
      userMessage('u0', '最早的问题'),
      assistantMessage('a0', '最早的回答'),
      userMessage('u1', '第一问'),
      assistantMessage('a1', '第一答'),
      userMessage('u2', 'RequestSelectV2 怎么用？'),
      assistantMessage('a2', '它是远程选择器。'),
      userMessage('u3', '它支持清空吗？'),
    ]
    const prepared = await prepareQuery(messages, 5, strategy)
    const model = languageModel('支持')
    await consumeStream(createQueryUIMessageStream(prepared, { model }))

    const retrieve = strategy.retrieve as ReturnType<typeof vi.fn>
    expect(retrieve.mock.calls[0][0]).not.toContain('最早的问题')
    expect(retrieve.mock.calls[0][0]).toContain('第一问')
    expect(retrieve.mock.calls[0][0]).toContain('RequestSelectV2 怎么用？')
    expect(retrieve.mock.calls[0][0]).toContain('它支持清空吗？')
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain('组件契约上下文')
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain('RequestSelectV2 body')
  })

  it('propagates retrieval failures before a stream is created', async () => {
    const failing = stubStrategy({ chunks: [], empty: true })
    failing.retrieve = async () => {
      throw new Error('embedding upstream failed')
    }

    await expect(prepareQuery([userMessage('u1', 'q')], 5, failing))
      .rejects
      .toThrow('embedding upstream failed')
  })
})

describe('exampleBlocksFromAnswer', () => {
  it('keeps allowlisted blocks and marks non-allowlisted imports as source-only', () => {
    const answer = [
      '```vue',
      '<script setup lang="ts">',
      'import { ElButton } from \'element-plus\'',
      '</script>',
      '<template><ElButton>确认</ElButton></template>',
      '```',
      '```vue',
      '<script setup lang="ts">',
      'import axios from \'axios\'',
      '</script>',
      '<template><div /></template>',
      '```',
    ].join('\n')

    const blocks = exampleBlocksFromAnswer(answer, chunk('MyButton'))
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ renderable: true })
    expect(blocks[0].js).toContain('<script setup>')
    expect(blocks[1]).toMatchObject({ renderable: false })
    expect(blocks[1].reason).toContain('axios')
  })

  it('appends a runnable fallback when every extracted block is source-only', () => {
    const answer = [
      '```vue no-demo',
      '<script setup lang="ts">',
      'const count: number = 1',
      '</script>',
      '<template><div>{{ count }}</div></template>',
      '```',
    ].join('\n')

    const blocks = exampleBlocksFromAnswer(answer, chunk('MyButton'))
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ renderable: false })
    expect(blocks[1]).toEqual({ ts: '<MyButton />', js: '<MyButton js />', renderable: true })
  })

  it('marks TypeScript syntax failures and preserves a runnable fallback', () => {
    const broken = [
      '```vue',
      '<script setup lang="ts">',
      'const columns = [{ field: \'name\', title商品名称\', width: 150 }]',
      '</script>',
      '<template><MyButton /></template>',
      '```',
    ].join('\n')

    const blocks = exampleBlocksFromAnswer(broken, chunk('MyButton'))
    expect(blocks[0]).toMatchObject({ renderable: false })
    expect(blocks[0].js).toBeUndefined()
    expect(blocks[0].reason).toContain('语法')
    expect(blocks[1]).toMatchObject({ renderable: true })
  })
})
