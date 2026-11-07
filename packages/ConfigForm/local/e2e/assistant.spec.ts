import type { LivePreviewSession } from '@moluoxixi/config-form-studio/client'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createStudioNode } from '@moluoxixi/config-form-studio'
import { WORKSPACE_API_PATH, workspaceRequest } from '@moluoxixi/config-form-studio/client'
import { expect, test } from '@playwright/test'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { startLocalWorkspace } from '../src/services/server'

type StreamPart = Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer T> ? T : never
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }

test('chat and MCP update one live preview, undo and save at desktop and phone sizes', async ({ page }) => {
  const directory = await mkdtemp(join(tmpdir(), 'config-form-ai-e2e-'))
  let step = 0
  const field = createStudioNode({ preset: 'element-plus', component: 'element.input', id: 'customer', field: 'customer', label: '姓名' })
  const model = new MockLanguageModelV3({ doStream: async () => ({ stream: simulateReadableStream<StreamPart>({ chunks: step++ === 0
    ? [
        { type: 'stream-start', warnings: [] },
        { type: 'tool-call', toolCallId: 'insert', toolName: 'apply_operations', input: JSON.stringify({ label: '添加姓名字段', expectedSessionRevision: 0, operations: [{ type: 'node.insert', surfaceId: 'home', subgraph: field, target: { parentId: null } }] }) },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage },
      ]
    : [
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'answer' },
        { type: 'text-delta', id: 'answer', delta: '已添加姓名，预览中可以直接填写。' },
        { type: 'text-end', id: 'answer' },
        { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
      ], initialDelayInMs: null, chunkDelayInMs: 40 }) }) })
  const service = await startLocalWorkspace({ directory, port: 0, staticDirectory: resolve(import.meta.dirname, '../dist/designer'), assistant: { model } })
  const client = new Client({ name: 'config-form-live-preview-e2e', version: '1' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(import.meta.dirname, '../dist/cli.js'), 'mcp', '--url', service.url], stderr: 'pipe' }))
    await page.goto(`${service.url}/#/assistant/new`)
    await page.getByRole('textbox', { name: '描述表单需求' }).fill('添加姓名字段')
    await page.getByRole('button', { name: '发送', exact: true }).click()
    await expect(page).toHaveURL(/#\/assistant\/(?!new)[\w-]+$/)
    const sessionId = page.url().split('/').at(-1)!
    const frame = page.frameLocator('iframe[data-preview-runtime-host]')
    await expect(frame.locator('[data-field="customer"]')).toContainText('姓名')
    await expect(page.getByText('已添加姓名，预览中可以直接填写。', { exact: true })).toBeVisible()
    await frame.locator('[data-field="customer"] input').fill('预览用户')
    await expect(frame.locator('[data-field="customer"] input')).toHaveValue('预览用户')
    expect(await service.repository.list()).toHaveLength(0)
    await expect(page.getByRole('button', { name: '撤销上一批修改', exact: true })).toBeEnabled()
    const changed = await client.callTool({ name: 'apply_preview_operations', arguments: { sessionId, expectedSessionRevision: 1, commandId: 'mcp-label', label: '调整为联系人', operations: [{ type: 'node.settings', surfaceId: 'home', nodeId: 'customer', settings: { kind: 'field', component: 'element.input', field: 'customer', label: '联系人' } }] } })
    expect(changed.isError, JSON.stringify(changed.content)).not.toBe(true)
    await expect(frame.locator('[data-field="customer"]')).toContainText('联系人')
    await page.getByRole('button', { name: '撤销上一批修改', exact: true }).click()
    await expect(frame.locator('[data-field="customer"]')).toContainText('姓名')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByText('已保存到本地项目', { exact: true })).toBeVisible()
    const saved = await workspaceRequest<LivePreviewSession>(`${service.url}${WORKSPACE_API_PATH}/preview-session/read`, { sessionId })
    expect((await service.repository.get(saved.document.id))?.document.surfacesById.home!.graph.nodesById.customer).toMatchObject({ label: '姓名' })
    for (const width of [320, 390, 678]) {
      await page.setViewportSize({ width, height: 827 })
      await page.getByRole('tab', { name: /^实时预览/ }).click()
      await expect(frame.locator('[data-field="customer"]')).toBeVisible()
      await expect(page.getByRole('button', { name: '手机预览', exact: true })).toHaveAttribute('aria-pressed', 'true')
      expect(await frame.locator('body').evaluate(element => element.scrollWidth > element.ownerDocument.documentElement.clientWidth)).toBe(false)
      await page.screenshot({ path: `.tmp-test-results/assistant-preview-${width}.png` })
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
      const preview = await page.locator('iframe[data-preview-runtime-host]').boundingBox()
      expect(preview!.height).toBeGreaterThan(350)
      await page.getByRole('tab', { name: '对话', exact: true }).click()
      await expect(page.getByRole('textbox', { name: '描述表单需求' })).toBeInViewport()
      await page.screenshot({ path: `.tmp-test-results/assistant-${width}.png` })
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.screenshot({ path: '.tmp-test-results/assistant-desktop.png' })
    await page.getByRole('link', { name: '继续设计', exact: true }).click()
    await expect(page).toHaveURL(/\/design$/)
    await expect(page.frameLocator('iframe[data-design-runtime-variant="canvas"]').locator('[data-field="customer"]')).toContainText('姓名')
    expect(errors).toEqual([])
  }
  finally {
    await client.close()
    await service.close()
    await rm(directory, { recursive: true, force: true })
  }
})
