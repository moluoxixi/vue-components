// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readMeta } from '../src/core/indexing'
import { ServerContext } from '../src/server/context'

// 实际抽取契约的用例必须用包内 fixture 工作区：vue-component-meta 需被分析 SFC 落在 tsconfig
// program 内（临时目录无法解析 vue 类型）。fixture 工作区含 demo 包 + tsconfig，可被 checker 解析。
const FIXTURE_ROOT = resolve(__dirname, 'fixtures', 'ctx-workspace')
const CONFIG_FORM_ANTD_PACKAGE_ROOT = resolve(__dirname, '../../ConfigForm/antd')

// 一个最小可解析的 SFC：驱动契约抽取 → content 策略关键词检索态构建。
const SFC = `<script setup lang="ts">
defineProps<{ label: string, disabled?: boolean }>()
defineEmits<{ click: [id: number] }>()
</script>
<template><button>{{ label }}</button></template>`

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ai-doc-ctx-'))
  await mkdir(join(root, 'packages', 'demo', 'src'), { recursive: true })
  await writeFile(join(root, 'packages', 'demo', 'package.json'), JSON.stringify({
    exports: {
      '.': {
        source: './index.ts',
      },
    },
    name: '@demo/components',
  }), 'utf8')
  await writeFile(
    join(root, 'packages', 'demo', 'index.ts'),
    `import DemoButtonSource from './src/index.vue'\nexport const DemoButton = DemoButtonSource\n`,
    'utf8',
  )
  await writeFile(join(root, 'packages', 'demo', 'src', 'index.vue'), SFC, 'utf8')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

// Chat config is explicit; content mode construction still works without it.
const ENV = {
  AI_DOC_CHAT_PROVIDER: 'openai',
  AI_DOC_CHAT_API_KEY: 'k',
  AI_DOC_CHAT_MODEL: 'gpt-4o-mini',
}

describe('serverContext（默认 content 策略，关键词 topK）', () => {
  it('构造时加载 provider 配置（chat key 存在）', () => {
    const ctx = new ServerContext({ root, env: ENV })
    expect(ctx.config.chat).toEqual({
      provider: 'openai',
      apiKey: 'k',
      model: 'gpt-4o-mini',
    })
  })

  it('默认 mode 为 content', () => {
    const ctx = new ServerContext({ root, env: ENV })
    expect(ctx.mode).toBe('content')
  })

  it('content 模式完全忽略 qdrant 后端与缺失的连接配置', () => {
    const ctx = new ServerContext({
      root,
      env: { ...ENV, AI_DOC_VECTOR_STORE: 'qdrant' },
    })
    expect(ctx.mode).toBe('content')
    expect(ctx.vectorStore).toBe('orama')
  })

  it('环境变量可切 vector 模式', () => {
    const ctx = new ServerContext({ root, env: { ...ENV, AI_DOC_RETRIEVAL_MODE: 'vector' } })
    expect(ctx.mode).toBe('vector')
  })

  it('非法 mode 环境变量 → 构造时抛错（边界校验，不静默回落）', () => {
    expect(() => new ServerContext({ root, env: { ...ENV, AI_DOC_RETRIEVAL_MODE: 'bogus' } }))
      .toThrow(/invalid AI_DOC_RETRIEVAL_MODE/)
  })

  it('无 AI 配置时两个 capability 均 missing', () => {
    const ctx = new ServerContext({ root, env: {} })
    expect(ctx.config).toEqual({ chat: null, embedding: null })
  })

  it('vector + qdrant 仍要求显式连接配置', () => {
    expect(() => new ServerContext({
      root,
      env: {
        ...ENV,
        AI_DOC_RETRIEVAL_MODE: 'vector',
        AI_DOC_VECTOR_STORE: 'qdrant',
      },
    })).toThrow(/AI_DOC_QDRANT_URL.*AI_DOC_QDRANT_COLLECTION/)
  })

  it('未构建时 getStrategy 返回 null（由上层映射 INDEX_NOT_READY）', () => {
    const ctx = new ServerContext({ root, env: ENV })
    expect(ctx.getStrategy()).toBeNull()
    expect(ctx.state.isReady()).toBe(false)
  })

  it('buildIndex（content）无需 provider key 即可完成', async () => {
    // 实际抽取走 fixture 工作区（vue-component-meta 需 tsconfig program）
    const ctx = new ServerContext({ root: FIXTURE_ROOT, env: {} })
    await ctx.buildIndex()
    expect(ctx.state.isReady()).toBe(true)
    expect(ctx.getStrategy()).not.toBeNull()
    expect(ctx.getStrategy()!.mode).toBe('content')
  }, 15_000)

  it('buildIndex 全链路：提取契约 → content 策略就绪 → 可检索', async () => {
    const ctx = new ServerContext({ root: FIXTURE_ROOT, env: ENV })
    await ctx.buildIndex()
    expect(ctx.state.isReady()).toBe(true)
    expect(ctx.getContracts().length).toBe(1)
    expect(ctx.getContracts()[0].props.length).toBeGreaterThan(0)
    const strategy = ctx.getStrategy()
    expect(strategy).not.toBeNull()
    expect(strategy!.isReady()).toBe(true)
    // content 策略按结构化关键词命中并返回 topK 契约
    const result = await strategy!.retrieve('label disabled 按钮', 5)
    expect(result.empty).toBe(false)
    expect(result.chunks.length).toBe(1)
  })

  it('package discovery root 不限制兄弟 workspace 包的类型闭包', async () => {
    const ctx = new ServerContext({
      componentGlobs: ['src/services/components/AntdConfigForm/index.vue'],
      env: {},
      root: CONFIG_FORM_ANTD_PACKAGE_ROOT,
    })
    await ctx.buildIndex()

    const contract = ctx.getContracts()[0]
    const payload = contract.typeDefs.find(def => def.name === 'ConfigFormFieldChangePayload')
    expect(payload?.fields.map(field => field.name)).toEqual(['field', 'value', 'values'])
  }, 30_000)

  it('空目录 buildIndex → FAIL，不伪装为空索引 ready', async () => {
    const emptyRoot = await mkdtemp(join(tmpdir(), 'ai-doc-empty-'))
    try {
      const ctx = new ServerContext({ root: emptyRoot, env: ENV })
      await expect(ctx.buildIndex()).rejects.toThrow(/component entry auto-discovery failed/)
      expect(ctx.state.isReady()).toBe(false)
      expect(ctx.getContracts().length).toBe(0)
    }
    finally {
      await rm(emptyRoot, { recursive: true, force: true })
    }
  })

  it('componentEntries 与 componentGlobs 同时配置 → FAIL 配置冲突', async () => {
    const ctx = new ServerContext({
      root,
      componentEntries: ['packages/demo/index.ts'],
      componentGlobs: ['packages/demo/src/index.vue'],
      env: ENV,
    })

    await expect(ctx.buildIndex()).rejects.toThrow(/componentEntries and componentGlobs cannot be used together/)
  })

  it('legacy componentGlobs 是显式配置：匹配不到文件即 FAIL', async () => {
    const ctx = new ServerContext({
      root,
      componentGlobs: ['packages/demo/missing/**/*.vue'],
      env: ENV,
    })

    await expect(ctx.buildIndex()).rejects.toThrow(/componentGlobs matched no Vue component files/)
  })

  it('buildIndex 重建内部知识库时保留外部导入知识库', async () => {
    const ctx = new ServerContext({ root: FIXTURE_ROOT, env: ENV })
    await ctx.buildIndex()
    const internalCount = ctx.getContracts().length
    await ctx.importKnowledge({
      name: 'ExternalOnly',
      packageName: '@external/ui',
      description: '外部知识库组件',
      docPath: 'external/ExternalOnly.md',
      props: [],
      emits: [],
      slots: [],
      models: [],
      typeDefs: [],
    })
    expect(ctx.getExternalContracts()).toHaveLength(1)

    await ctx.buildIndex()

    expect(ctx.getContracts()).toHaveLength(internalCount)
    expect(ctx.getExternalContracts()).toHaveLength(1)
    expect(ctx.getAllContracts()).toHaveLength(internalCount + 1)
    expect(ctx.getAllContracts().map(item => item.key)).toContain('external:%40external%2Fui:ExternalOnly')
  })

  it('vector index persists, hydrates without re-embedding, and becomes stale after model change', async () => {
    const indexDir = join(root, 'persisted-vector')
    const embeddingEnv = {
      AI_DOC_RETRIEVAL_MODE: 'vector',
      AI_DOC_EMBEDDING_PROVIDER: 'openai-compatible',
      AI_DOC_EMBEDDING_API_KEY: 'embedding-secret',
      AI_DOC_EMBEDDING_MODEL: 'embed-v1',
      AI_DOC_EMBEDDING_BASE_URL: 'https://embedding.example/v1',
    }
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { input: string | string[] }
      const values = Array.isArray(body.input) ? body.input : [body.input]
      return new Response(JSON.stringify({
        object: 'list',
        data: values.map((_value, index) => ({
          object: 'embedding',
          index,
          embedding: [1, 0, 0],
        })),
        model: 'embed-v1',
        usage: { prompt_tokens: values.length, total_tokens: values.length },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const built = new ServerContext({
        root: FIXTURE_ROOT,
        env: embeddingEnv,
        indexDir,
      })
      await built.buildIndex()
      const buildCalls = fetchMock.mock.calls.length
      const meta = await readMeta(indexDir)
      expect(meta?.embeddingIdentity).toMatchObject({
        provider: 'openai-compatible',
        model: 'embed-v1',
        dimension: 3,
      })
      expect(JSON.stringify(meta)).not.toContain('embedding-secret')
      expect(JSON.stringify(meta)).not.toContain('embedding.example')

      const restored = new ServerContext({
        root: FIXTURE_ROOT,
        env: embeddingEnv,
        indexDir,
      })
      await restored.initialize()
      expect(restored.state.snapshot().status).toBe('ready')
      expect(restored.getStrategy()?.isReady()).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(buildCalls)

      const stale = new ServerContext({
        root: FIXTURE_ROOT,
        env: { ...embeddingEnv, AI_DOC_EMBEDDING_MODEL: 'embed-v2' },
        indexDir,
      })
      await stale.initialize()
      expect(stale.state.snapshot().status).toBe('stale')
      expect(stale.getStrategy()).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(buildCalls)
    }
    finally {
      vi.unstubAllGlobals()
    }
  }, 20_000)
})
