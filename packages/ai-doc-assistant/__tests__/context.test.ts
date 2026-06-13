// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ServerContext } from '../src/server/context'

// 一个最小可解析的 SFC：驱动契约抽取 → content 策略全量上下文构建。
const SFC = `<script setup lang="ts">
defineProps<{ label: string, disabled?: boolean }>()
defineEmits<{ click: [id: number] }>()
</script>
<template><button>{{ label }}</button></template>`

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ai-doc-ctx-'))
  await mkdir(join(root, 'packages', 'demo', 'src'), { recursive: true })
  await writeFile(join(root, 'packages', 'demo', 'src', 'index.vue'), SFC, 'utf8')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

// chat 走 provider key；content 模式构建无需任何 key。
const ENV = { AI_DOC_CHAT_API_KEY: 'k' }

describe('serverContext（默认 content 策略，全量上下文）', () => {
  it('构造时加载 provider 配置（chat key 存在）', () => {
    const ctx = new ServerContext({ root, env: ENV })
    expect(ctx.config).toBeTruthy()
    expect(ctx.config!.chatApiKey).toBe('k')
  })

  it('默认 mode 为 content', () => {
    const ctx = new ServerContext({ root, env: ENV })
    expect(ctx.mode).toBe('content')
  })

  it('环境变量可切 vector 模式', () => {
    const ctx = new ServerContext({ root, env: { ...ENV, AI_DOC_RETRIEVAL_MODE: 'vector' } })
    expect(ctx.mode).toBe('vector')
  })

  it('非法 mode 环境变量 → 构造时抛错（边界校验，不静默回落）', () => {
    expect(() => new ServerContext({ root, env: { ...ENV, AI_DOC_RETRIEVAL_MODE: 'bogus' } }))
      .toThrow(/invalid AI_DOC_RETRIEVAL_MODE/)
  })

  it('无 chat key 时 config 为 null（chat 是核心边界）', () => {
    const ctx = new ServerContext({ root, env: {} })
    expect(ctx.config).toBeNull()
  })

  it('未构建时 getStrategy 返回 null（由上层映射 INDEX_NOT_READY）', () => {
    const ctx = new ServerContext({ root, env: ENV })
    expect(ctx.getStrategy()).toBeNull()
    expect(ctx.state.isReady()).toBe(false)
  })

  it('buildIndex（content）无需 provider key 即可完成', async () => {
    const ctx = new ServerContext({ root, env: {} })
    await ctx.buildIndex()
    expect(ctx.state.isReady()).toBe(true)
    expect(ctx.getStrategy()).not.toBeNull()
    expect(ctx.getStrategy()!.mode).toBe('content')
  })

  it('buildIndex 全链路：提取契约 → content 策略就绪 → 可检索', async () => {
    const ctx = new ServerContext({ root, env: ENV })
    await ctx.buildIndex()
    expect(ctx.state.isReady()).toBe(true)
    expect(ctx.getContracts().length).toBe(1)
    expect(ctx.getContracts()[0].props.length).toBeGreaterThan(0)
    const strategy = ctx.getStrategy()
    expect(strategy).not.toBeNull()
    expect(strategy!.isReady()).toBe(true)
    // content 策略全量纳入：检索返回全部契约
    const result = await strategy!.retrieve('任意问题', 5)
    expect(result.empty).toBe(false)
    expect(result.chunks.length).toBe(1)
  })

  it('空目录 buildIndex → ready 但契约为空（不静默失败）', async () => {
    const emptyRoot = await mkdtemp(join(tmpdir(), 'ai-doc-empty-'))
    try {
      const ctx = new ServerContext({ root: emptyRoot, env: ENV })
      await ctx.buildIndex()
      expect(ctx.state.isReady()).toBe(true)
      expect(ctx.getContracts().length).toBe(0)
    }
    finally {
      await rm(emptyRoot, { recursive: true, force: true })
    }
  })
})
