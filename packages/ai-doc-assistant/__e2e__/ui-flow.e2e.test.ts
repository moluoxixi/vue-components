import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
/**
 * UI 真实浏览器端到端验证（@playwright/test + 真实 Chromium）。
 *
 * 不 mock 浏览器、不信日志：起两个真实 HTTP server——
 *  1) BFF + UI 静态资源 server：用编译产物 dist 的 dispatch(API) 驱动真实 ServerContext
 *     （content 模式 + 临时组件库 fixture），并以静态文件服务 dist/ui。
 *  2) stub 上游：实现 OpenAI 兼容 /chat/completions 流式协议，逐 token 吐字，
 *     使 SSE 链路 sources→token→example→done 真实跑通（真实网络往返，非内存 mock）。
 *
 * 真实 Chromium 打开 UI → 点构建索引 → 输入问题 → 提交 → 断言页面真实渲染出
 * 来源卡片、流式回答文本、示例代码块；任一环节失败即测试失败。
 */
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
// 用编译产物，确保测的是真实发布形态
// eslint-disable-next-line antfu/no-import-dist -- E2E 刻意校验 dist 真实发布形态
import { dispatch, ServerContext } from '../dist/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UI_DIR = resolve(__dirname, '..', 'dist', 'ui')
const UI_PREFIX = '/__ai-doc'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

/** 最小可解析 SFC fixture：驱动契约抽取 → content 全量上下文。 */
const SFC = `<script setup lang="ts">
defineProps<{ label: string, disabled?: boolean }>()
defineEmits<{ click: [id: number] }>()
</script>
<template><button>{{ label }}</button></template>`

/** 静态资源服务：仅 dist/ui 内，未知子路径回落 index.html（SPA）。 */
function serveUi(req: IncomingMessage, res: ServerResponse): boolean {
  const url = (req.url ?? '').split('?')[0]
  if (url !== UI_PREFIX && url !== `${UI_PREFIX}/` && !url.startsWith(`${UI_PREFIX}/`))
    return false
  if (url.startsWith(`${UI_PREFIX}/api`))
    return false
  const rel = url === UI_PREFIX || url === `${UI_PREFIX}/`
    ? 'index.html'
    : url.slice(`${UI_PREFIX}/`.length)
  const candidate = join(UI_DIR, rel)
  const fsPath = candidate.startsWith(UI_DIR) && existsSync(candidate) ? candidate : join(UI_DIR, 'index.html')
  if (!existsSync(fsPath))
    return false
  res.writeHead(200, { 'content-type': MIME[extname(fsPath)] ?? 'application/octet-stream' })
  res.end(readFileSync(fsPath))
  return true
}

/** stub OpenAI 兼容上游：/chat/completions 流式逐 token。 */
function startUpstream(): Promise<{ server: Server, url: string }> {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' })
      const tokens = ['Button', ' 组件', '支持', ' label', ' 与', ' disabled', ' 两个 Props。']
      for (const t of tokens)
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      ok({ server, url: `http://127.0.0.1:${port}/v1` })
    })
  })
}

let appServer: Server
let upstream: Server
let baseUrl: string
let root: string

test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'ai-doc-e2e-'))
  await mkdir(join(root, 'packages', 'demo', 'src', 'Button'), { recursive: true })
  await writeFile(join(root, 'packages', 'demo', 'src', 'Button', 'index.vue'), SFC, 'utf8')

  const up = await startUpstream()
  upstream = up.server

  const ctx = new ServerContext({
    root,
    env: {
      AI_DOC_CHAT_API_KEY: 'e2e-test-key',
      AI_DOC_CHAT_BASE_URL: up.url,
      AI_DOC_CHAT_MODEL: 'stub-model',
    },
  })

  appServer = createServer((req, res) => {
    dispatch(ctx, req, res).then((handled) => {
      if (handled)
        return
      if (serveUi(req, res))
        return
      res.writeHead(404)
      res.end()
    }).catch(() => {
      if (!res.headersSent)
        res.writeHead(500)
      res.end()
    })
  })
  await new Promise<void>((ok) => {
    appServer.listen(0, '127.0.0.1', () => {
      const addr = appServer.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      baseUrl = `http://127.0.0.1:${port}`
      ok()
    })
  })
})

test.afterAll(async () => {
  appServer?.close()
  upstream?.close()
  if (root)
    await rm(root, { recursive: true, force: true })
})

test('打开面板 → 构建索引 → 提问 → 渲染来源/回答/示例', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto(`${baseUrl}${UI_PREFIX}/`, { waitUntil: 'networkidle' })

  // 健康态渲染：mode=content，chat=configured
  await expect(page.getByTestId('mode-chip')).toContainText('content')
  await expect(page.getByTestId('chat-chip')).toContainText('configured')

  // 构建索引 → 索引态变 ready
  await page.getByTestId('build-btn').click()
  await expect(page.getByTestId('index-chip')).toContainText('ready', { timeout: 15000 })

  // 构建后总览卡片加载到 Button
  await expect(page.getByTestId('component-card').first()).toContainText('Button', { timeout: 15000 })

  // 重构后问答在独立 Chat 视图：点 AI 图标切到 Chat 视图再提问
  await page.getByTestId('ai-icon').click()
  await expect(page.getByTestId('chat-view')).toBeVisible()

  // 提问并提交
  await page.getByTestId('question-input').fill('Button 有哪些 Props？')
  await page.getByTestId('ask-btn').click()

  // 来源卡片真实渲染（/query 的 sources 事件）
  await expect(page.getByTestId('sources')).toContainText('Button', { timeout: 15000 })
  // 流式回答文本（stub 上游逐 token）
  await expect(page.getByTestId('answer')).toContainText('两个 Props', { timeout: 15000 })
  // 示例代码块（example 事件）
  await expect(page.getByTestId('example')).toContainText('Button', { timeout: 15000 })

  expect(errors, `页面 JS 错误：${errors.join('; ')}`).toEqual([])
})
