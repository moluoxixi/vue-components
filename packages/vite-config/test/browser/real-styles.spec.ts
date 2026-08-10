import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { ConfigEnv, UserConfig, UserConfigExport } from 'vite'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAppConfig } from '@moluoxixi/vite-config'
import { expect, test } from '@playwright/test'
import { build } from 'vite'

const buildEnv: ConfigEnv = { command: 'build', mode: 'production' }
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.resolve(currentDir, '../fixtures/real-styles')
const outDir = path.resolve(fixturePath, 'dist-playwright')

let server: Server | undefined
let serverUrl = ''

/**
 * 解析 Vite 配置对象或配置工厂，确保浏览器测试使用真实生产构建配置。
 */
async function resolveConfig(config: UserConfigExport): Promise<UserConfig> {
  return typeof config === 'function' ? config(buildEnv) : config
}

/**
 * 构建真实样式 fixture，产物会被静态服务器提供给各浏览器项目访问。
 */
async function buildStyleFixture(): Promise<void> {
  await fs.promises.rm(outDir, { force: true, recursive: true })

  const config = await resolveConfig(createAppConfig({
    viteConfig: {
      build: { emptyOutDir: true, outDir },
      root: fixturePath,
    },
  }))

  await build({ ...config, logLevel: 'silent' })
}

/**
 * 根据文件扩展名返回静态资源 MIME，避免浏览器因类型错误拒绝加载产物。
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath)
  if (ext === '.css') {
    return 'text/css; charset=utf-8'
  }
  if (ext === '.html') {
    return 'text/html; charset=utf-8'
  }
  if (ext === '.js') {
    return 'text/javascript; charset=utf-8'
  }

  return 'application/octet-stream'
}

/**
 * 从请求 URL 解析 dist 内文件路径，并阻止路径穿越访问构建目录之外的文件。
 */
function resolveStaticFile(root: string, requestUrl = '/'): string {
  const url = new URL(requestUrl, 'http://127.0.0.1')
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname
  const filePath = path.resolve(root, `.${decodeURIComponent(pathname)}`)
  const relativePath = path.relative(root, filePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`[playwright] rejected path traversal request: ${pathname}`)
  }

  return filePath
}

/**
 * 处理单个静态资源请求；缺失资源显式返回 404，内部错误返回 500。
 */
async function handleStaticRequest(root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const filePath = resolveStaticFile(root, request.url)

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(`Not found: ${request.url}`)
    return
  }

  response.writeHead(200, { 'content-type': getContentType(filePath) })
  response.end(await fs.promises.readFile(filePath))
}

/**
 * 启动只服务构建产物的本地静态服务器，端口由系统分配以避免矩阵并发冲突。
 */
async function startStaticServer(root: string): Promise<{ server: Server, url: string }> {
  const startedServer = http.createServer((request, response) => {
    handleStaticRequest(root, request, response).catch((cause) => {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(cause instanceof Error ? cause.stack : String(cause))
    })
  })

  await new Promise<void>((resolve, reject) => {
    startedServer.once('error', reject)
    startedServer.listen(0, '127.0.0.1', () => {
      startedServer.off('error', reject)
      resolve()
    })
  })

  const address = startedServer.address() as AddressInfo | null
  if (!address) {
    throw new Error('[playwright] failed to resolve static server address')
  }

  return {
    server: startedServer,
    url: `http://127.0.0.1:${address.port}`,
  }
}

/**
 * 关闭静态服务器并暴露关闭失败，避免后台进程掩盖测试结果。
 */
async function closeStaticServer(target: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    target.close((error?: Error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

/**
 * 根据当前 viewport 判断 Tailwind 响应式背景色应命中的分支。
 */
function getExpectedResponsiveBackground(width: number): string {
  return width >= 768 ? 'rgb(59, 130, 246)' : 'rgb(16, 185, 129)'
}

test.beforeAll(async () => {
  await buildStyleFixture()
  const started = await startStaticServer(outDir)
  server = started.server
  serverUrl = started.url
})

test.afterAll(async () => {
  if (server) {
    await closeStaticServer(server)
  }

  await fs.promises.rm(outDir, { force: true, recursive: true })
})

test('renders Tailwind and UnoCSS output across browser device matrix', async ({ page }) => {
  await page.goto(serverUrl)

  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error('[playwright] viewport is unavailable')
  }

  const app = page.locator('#app')
  await expect(app).toHaveText('real style addon')
  await expect(app).toHaveCSS('color', 'rgb(15, 23, 42)')
  await expect(app).toHaveCSS('background-color', getExpectedResponsiveBackground(viewport.width))

  const unoTextOpacity = await app.evaluate(element =>
    getComputedStyle(element).getPropertyValue('--un-text-opacity').trim())
  expect(unoTextOpacity).toBe('1')
})
