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

/**
 * 最小可解析 SFC fixture：驱动契约抽取 → content 全量上下文。
 *
 * 关键：组件目录与包名刻意对齐为 packages/components/src/EnterNextContainer/index.vue，
 * 使 resolveFiles 解析出 packageName=@moluoxixi/components、组件名=EnterNextContainer。
 * 这样 query 生成的 example SFC `import { EnterNextContainer } from '@moluoxixi/components'`
 * 能命中 DemoPreview 运行时 compile 的 moduleCache（dist 实体），真实组件被挂载。
 * fixture 自身渲染 default 插槽，便于断言「真实组件已挂载」。
 */
const SFC = `<script setup lang="ts">
defineProps<{ label?: string }>()
</script>
<template><div class="enter-next"><slot>fixture-fallback</slot></div></template>`

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
  // 组件入口约定与真实库一致：packages/<pkg>/src/<Comp>/src/index.vue。
  // glob `packages/*/src/**/index.vue` 命中；直接父目录为 src；segs[1]=components →
  // packageName=@moluoxixi/components；resolveComponentName 取 src 的上级目录名 → EnterNextContainer。
  await mkdir(join(root, 'packages', 'components', 'src', 'EnterNextContainer', 'src'), { recursive: true })
  await writeFile(join(root, 'packages', 'components', 'src', 'EnterNextContainer', 'src', 'index.vue'), SFC, 'utf8')

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

test('打开面板 → 构建索引 → 提问 → 渲染来源/回答 + demo 预览块真实挂载组件 + 双码切换', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.goto(`${baseUrl}${UI_PREFIX}/`, { waitUntil: 'networkidle' })

  // 健康态渲染：mode=content，chat=configured
  await expect(page.getByTestId('mode-chip')).toContainText('content')
  await expect(page.getByTestId('chat-chip')).toContainText('configured')

  // 构建索引 → 索引态变 ready
  await page.getByTestId('build-btn').click()
  await expect(page.getByTestId('index-chip')).toContainText('ready', { timeout: 15000 })

  // 构建后总览卡片加载到组件
  await expect(page.getByTestId('component-card').first()).toContainText('EnterNextContainer', { timeout: 15000 })

  // 重构后问答在独立 Chat 视图：点 AI 图标切到 Chat 视图再提问
  await page.getByTestId('ai-icon').click()
  await expect(page.getByTestId('chat-view')).toBeVisible()

  // 提问并提交
  await page.getByTestId('question-input').fill('EnterNextContainer 怎么用？')
  await page.getByTestId('ask-btn').click()

  // 来源卡片真实渲染（/query 的 sources 事件）
  await expect(page.getByTestId('sources')).toContainText('EnterNextContainer', { timeout: 15000 })
  // 流式回答文本（stub 上游逐 token）
  await expect(page.getByTestId('answer')).toContainText('两个 Props', { timeout: 15000 })

  // demo 预览块出现（example 事件携带双码 + 组件标识）
  await expect(page.getByTestId('demo-preview')).toBeVisible({ timeout: 15000 })

  // 真实组件挂载：DemoPreview 在浏览器运行时 compile example SFC，注入 dist 实体后挂载
  // 真实 EnterNextContainer。断言三件事证明「真实编译挂载成功」（非静默吞、非空白）：
  //  1) 挂载容器存在于 DOM；2) 未进入编译错误态；3) 容器内已渲染出真实组件产生的 DOM 节点。
  // 不用 toBeVisible：EnterNextContainer 是无可见自身内容的「按 Enter 聚焦下一项」容器型组件，
  // 真实挂载后其根节点高度可能为 0，但 DOM 子树非空即证明组件已被真实编译并挂载。
  await expect(page.getByTestId('demo-mounted')).toBeAttached({ timeout: 15000 })
  // 编译未进入错误态（compile 成功）
  await expect(page.getByTestId('demo-error')).toHaveCount(0)
  // 编译完成（非加载中）
  await expect(page.getByTestId('demo-compiling')).toHaveCount(0)
  // 挂载容器内真实渲染出组件 DOM（vue3-sfc-loader 产物，非空白静默）
  const mountedHtml = await page.getByTestId('demo-mounted').innerHTML()
  expect(mountedHtml.trim().length, '真实组件挂载后容器 DOM 不应为空').toBeGreaterThan(0)

  // 默认 TS 码块含 lang="ts" 与本地组件库 import
  const tsCode = await page.getByTestId('code-block').textContent()
  expect(tsCode ?? '').toContain('lang="ts"')
  expect(tsCode ?? '').toContain('@moluoxixi/components')

  // 切到 JS：码块变为 <script setup>（无 lang="ts"）
  await page.getByTestId('tab-js').click()
  const jsCode = await page.getByTestId('code-block').textContent()
  expect(jsCode ?? '').not.toContain('lang="ts"')
  expect(jsCode ?? '').toContain('@moluoxixi/components')

  // 复制当前码：点击不抛错（clipboard 写入）
  await page.getByTestId('copy-current').click()

  expect(errors, `页面 JS 错误：${errors.join('; ')}`).toEqual([])
})
