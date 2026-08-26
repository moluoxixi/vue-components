import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
/**
 * UI 真实浏览器端到端验证（@playwright/test + 真实 Chromium）。
 *
 * 不 mock 浏览器、不信日志：起两个真实 HTTP server——
 *  1) BFF + UI 静态资源 server：用编译产物 dist 的 dispatch(API) 驱动真实 ServerContext
 *     （content 模式 + 临时组件库 fixture），并以静态文件服务 dist/ui。
 *  2) stub 上游：实现 OpenAI 兼容 /chat/completions 流式协议，逐 token 吐字，
 *     使 SSE 链路 sources→token→example→done 真实跑通（真实网络往返，非内存 mock）。
 *
 * 真实 Chromium 打开 UI → 自动准备知识库 → 输入问题 → 提交 → 断言页面真实渲染出
 * 来源卡片、流式回答文本、示例代码块；任一环节失败即测试失败。
 */
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
// 用编译产物，确保测的是真实发布形态
// eslint-disable-next-line antfu/no-import-dist -- E2E 刻意校验 dist 真实发布形态
import { dispatch, ServerContext } from '../dist/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const UI_DIR = resolve(__dirname, '..', 'dist', 'ui')
const UI_PREFIX = '/__ai-doc'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

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
      const tokens = [
        'Button',
        ' 组件',
        '支持',
        ' label',
        ' 与',
        ' disabled',
        ' 两个 Props。',
        '\n```vue\n<script setup lang="ts">\nimport { ElButton } from \'element-plus\'\n</script>\n<template><ElButton type="primary">确认</ElButton></template>\n```',
      ]
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

test.beforeAll(async () => {
  const up = await startUpstream()
  upstream = up.server

  const ctx = new ServerContext({
    root: REPO_ROOT,
    componentEntries: ['packages/components/index.ts'],
    env: {
      AI_DOC_CHAT_API_KEY: 'e2e-test-key',
      AI_DOC_CHAT_BASE_URL: up.url,
      AI_DOC_CHAT_MODEL: 'stub-model',
    },
  })
  await ctx.buildIndex()
  await ctx.importKnowledge({
    name: 'TypedFixture',
    packageName: '@fixture/external',
    description: '用于验证移动端类型详情',
    docPath: 'external/typed-fixture.json',
    props: [{
      name: 'options',
      type: 'EnterNextOptions',
      required: false,
      defaultValue: null,
      description: '交互选项',
      typeRefs: ['EnterNextOptions'],
    }],
    emits: [],
    slots: [],
    models: [],
    typeDefs: [{
      name: 'EnterNextOptions',
      kind: 'interface',
      raw: 'interface EnterNextOptions { tone?: string; delay?: number }',
      fields: [
        { name: 'tone', type: 'string', optional: true, description: '视觉状态' },
        { name: 'delay', type: 'number', optional: true, description: '延迟时间' },
      ],
    }],
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
})

async function openReadyPanel(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${baseUrl}${UI_PREFIX}/`, { waitUntil: 'networkidle' })
  await expect.poll(async () => {
    const error = page.getByTestId('error-bar')
    if (await error.isVisible())
      return `ERROR: ${await error.textContent()}`
    return await page.getByTestId('index-chip').textContent()
  }, { timeout: 15000 }).toContain('知识库可用')
}

test('桌面工作区完成知识浏览、问答、Markdown 与 Demo 真实挂载', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.context().grantPermissions(['clipboard-write'], { origin: baseUrl })
  await openReadyPanel(page)

  // Chat 常驻挂载；切换知识库时只隐藏，不卸载。
  await expect(page.getByTestId('chat-view')).toBeVisible()
  await expect(page.getByTestId('component-card')).toHaveCount(0)

  await page.getByTestId('workspace-knowledge-tab').click()
  await expect(page.getByTestId('knowledge-workspace')).toBeVisible()
  await expect(page.getByTestId('chat-view')).toBeHidden()

  // 构建后总览卡片加载到组件。
  const internalCard = page.getByTestId('component-card').filter({ hasText: 'EnterNextContainer' })
  await expect(internalCard).toBeVisible({ timeout: 15000 })
  const overviewExportTrigger = internalCard.getByTestId('card-export-trigger')
  await overviewExportTrigger.focus()
  await overviewExportTrigger.press('ArrowDown')
  const overviewExportOption = page.getByTestId('card-export-option').filter({ visible: true })
  await expect(overviewExportOption).toBeFocused()
  await overviewExportOption.press('ArrowUp')
  await overviewExportOption.press('Escape')
  await expect(overviewExportOption).toBeHidden()
  await expect(overviewExportTrigger).toBeFocused()
  await page.getByTestId('workspace-chat-tab').click()
  await expect(page.getByTestId('chat-view')).toBeVisible()

  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(desktopOverflow).toBeLessThanOrEqual(0)

  // 提问并提交
  await page.getByTestId('question-input').fill('EnterNextContainer 怎么用？')
  await page.getByTestId('ask-btn').click()

  // 来源卡片真实渲染（/query 的 sources 事件）
  await expect(page.getByTestId('sources')).toContainText('EnterNextContainer', { timeout: 15000 })
  await expect(page.getByTestId('sources')).toContainText('index.vue')
  await expect(page.getByTestId('sources')).toContainText('项目')
  // 流式回答文本（stub 上游逐 token）
  await expect(page.getByTestId('answer')).toContainText('两个 Props', { timeout: 15000 })

  // demo 预览块出现（example 事件携带双码 + 组件标识）
  await expect(page.getByTestId('demo-preview')).toBeVisible({ timeout: 15000 })

  // 真实组件挂载：DemoPreview 在浏览器运行时 compile 回答里的 Element Plus SFC，
  // moduleCache 解析 element-plus，宿主入口全局注册样式与插件，最终挂载出真实按钮。
  await expect(page.getByTestId('demo-mounted')).toBeAttached({ timeout: 15000 })
  // 编译未进入错误态（compile 成功）
  await expect(page.getByTestId('demo-error')).toHaveCount(0)
  // 编译完成（非加载中）
  await expect(page.getByTestId('demo-compiling')).toHaveCount(0)
  // 挂载容器内真实渲染出组件 DOM（vue3-sfc-loader 产物，非空白静默）
  const mountedHtml = await page.getByTestId('demo-mounted').innerHTML()
  expect(mountedHtml.trim().length, '真实组件挂载后容器 DOM 不应为空').toBeGreaterThan(0)
  await expect(page.getByTestId('demo-mounted')).toContainText('确认')

  // 操作栏直接提供四个按钮：查看 TS / 查看 JS / 复制 TS / 复制 JS。
  await expect(page.getByTestId('view-ts')).toBeVisible()
  await expect(page.getByTestId('copy-ts')).toBeVisible()
  await expect(page.getByTestId('view-js')).toBeVisible()
  await expect(page.getByTestId('copy-js')).toBeVisible()

  // 点击查看 TS 后，码块含 lang="ts" 与 Element Plus import
  await page.getByTestId('view-ts').click()
  const tsCode = await page.getByTestId('code-block').textContent()
  expect(tsCode ?? '').toContain('lang="ts"')
  expect(tsCode ?? '').toContain('element-plus')

  // 切到 JS：码块变为 <script setup>（无 lang="ts"）
  await page.getByTestId('view-js').click()
  const jsCode = await page.getByTestId('code-block').textContent()
  expect(jsCode ?? '').not.toContain('lang="ts"')
  expect(jsCode ?? '').toContain('element-plus')

  // 复制 TS / JS：四按钮模式下不需要展开到对应源码也能直接复制。
  await page.getByTestId('copy-ts').click()
  await expect(page.getByTestId('copy-ts')).toContainText('已复制')
  await page.getByTestId('copy-js').click()
  await expect(page.getByTestId('copy-js')).toContainText('已复制')

  expect(errors, `页面 JS 错误：${errors.join('; ')}`).toEqual([])
})

test('移动工作区无页面横向溢出，类型与导出操作可由触屏和键盘访问', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.setViewportSize({ width: 390, height: 844 })
  await openReadyPanel(page)
  await page.getByTestId('workspace-knowledge-tab').click()
  await expect(page.getByTestId('component-card').first()).toBeVisible()
  const typedCard = page.getByTestId('component-card').filter({ hasText: 'TypedFixture' })
  await expect(typedCard).toBeVisible()
  await typedCard.getByTestId('component-open').click()
  await expect(page.getByTestId('detail-view')).toBeVisible()
  await expect(page.getByTestId('detail-nav')).toBeVisible()

  const mobileLayout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    appHeight: document.querySelector('.ai-doc-app')?.getBoundingClientRect().height ?? 0,
  }))
  expect(mobileLayout.overflow).toBeLessThanOrEqual(0)
  expect(mobileLayout.appHeight).toBe(844)

  const typeReference = page.getByTestId('type-reference').first()
  await expect(typeReference).toBeVisible()
  await typeReference.tap()
  await expect(page.getByTestId('type-popover-content')).toContainText('EnterNextOptions')
  await page.getByTestId('detail-title').click()
  await expect(page.getByTestId('type-popover-content')).toBeHidden()
  await expect(typeReference).toBeFocused()
  await typeReference.tap()
  await expect(page.getByTestId('type-popover-content')).toBeVisible()
  await typeReference.press('Escape')
  await expect(page.getByTestId('type-popover-content')).toBeHidden()
  await expect(typeReference).toBeFocused()

  const exportTrigger = page.getByTestId('detail-export-trigger')
  await exportTrigger.focus()
  await exportTrigger.press('ArrowDown')
  const exportOption = page.getByTestId('detail-export-option')
  await expect(exportOption).toBeVisible()
  await expect(exportOption).toBeFocused()
  await exportOption.press('ArrowUp')
  await exportOption.press('Home')
  await exportOption.press('End')
  await exportOption.press('Escape')
  await expect(exportOption).toBeHidden()
  await expect(exportTrigger).toBeFocused()

  await exportTrigger.click()
  await expect(exportOption).toBeVisible()
  await page.getByTestId('detail-title').click()
  await expect(exportOption).toBeHidden()
  await expect(exportTrigger).toBeFocused()

  expect(errors, `页面 JS 错误：${errors.join('; ')}`).toEqual([])
})
