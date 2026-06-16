/**
 * Vite 插件入口：把 AI 文档助手的 BFF 挂到 Vite dev server 的 middleware。
 *
 * 安全（ADR-0005）：默认只在 dev server 生效，密钥经 server 进程，绝不进客户端 bundle。
 * 架构（ADR-0006）：默认 build 只抽取公共契约并建立关键词检索态，无向量索引/持久化。
 * UI：在 /__ai-doc/ 提供可视化面板静态资源（dist/ui），消费 /__ai-doc/api/* 接口。
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ServerContext } from './context'
import { dispatch } from './router'

/** UI 面板挂载前缀（与 vite.ui.config.ts 的 base 一致）。 */
const UI_PREFIX = '/__ai-doc'

/** 常见静态资源 content-type 映射。 */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/** 插件选项。 */
export interface AiDocPluginOptions {
  /** 项目根目录，默认 Vite config root。 */
  root?: string
  /** 组件库公共入口文件（相对 root 或绝对路径）。 */
  componentEntries?: string[]
  /** legacy 显式 SFC glob（相对 root），与 componentEntries 互斥。 */
  componentGlobs?: string[]
  /** UI 静态资源目录，默认包内 dist/ui。 */
  uiDir?: string
}

/** 解析包内 dist/ui 目录（本文件位于 dist/plugin.js，故 dist/ui 为同级子目录）。 */
function defaultUiDir(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, 'ui')
}

/**
 * 解析 UI 静态资源请求路径（纯函数，便于单测越界防护）。
 *
 * 返回值：
 *  - null：URL 不属于 UI 前缀，或属于 api 前缀（交还 BFF），调用方应跳过。
 *  - { rel }：URL 命中 UI，rel 为相对 uiDir 的安全相对路径；越界/解码失败一律回落 'index.html'。
 *
 * 越界防护：URL 先解码（闭合 %2e%2e 编码绕过）再 resolve，最终用 path.relative 判定
 * 解析结果严格位于 uiDir 内——拒绝 `..` 逃逸与 `dist/ui-backup` 这类同前缀同级目录绕过。
 */
export function resolveUiAsset(uiDir: string, rawUrl: string): { rel: string } | null {
  const url = (rawUrl ?? '').split('?')[0]
  if (url !== UI_PREFIX && url !== `${UI_PREFIX}/` && !url.startsWith(`${UI_PREFIX}/`))
    return null
  // api 前缀交还 BFF dispatch，不在此处理
  if (url.startsWith(`${UI_PREFIX}/api`))
    return null

  // 先 URL 解码，闭合 %2e%2e 等编码绕过；解码失败视为非法请求回落 index.html
  let rel: string
  try {
    rel = url === UI_PREFIX || url === `${UI_PREFIX}/`
      ? 'index.html'
      : decodeURIComponent(url.slice(`${UI_PREFIX}/`.length))
  }
  catch {
    return { rel: 'index.html' }
  }

  const candidate = resolve(uiDir, rel)
  // 越界判定：relative(uiDir, candidate) 不得以 .. 开头、不得为绝对路径，
  // 即 candidate 必须等于 uiDir 或严格位于其子树内（带分隔符边界，杜绝同前缀目录绕过）
  const relToBase = relative(uiDir, candidate)
  const inside = relToBase === '' || (!relToBase.startsWith('..') && !isAbsolute(relToBase))
  return { rel: inside ? rel : 'index.html' }
}

/**
 * 处理 UI 静态资源请求。返回 true 表示已响应。
 * 仅服务 dist/ui 内文件；未知子路径回落 index.html（SPA 单页）。
 */
function serveUi(uiDir: string, req: IncomingMessage, res: ServerResponse): boolean {
  const resolved = resolveUiAsset(uiDir, req.url ?? '')
  if (resolved === null)
    return false

  const candidate = resolve(uiDir, resolved.rel)
  const fsPath = existsSync(candidate) ? candidate : join(uiDir, 'index.html')

  if (!existsSync(fsPath))
    return false

  const ext = extname(fsPath)
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' })
  res.end(readFileSync(fsPath))
  return true
}

/**
 * 创建 Vite 插件。挂载 /__ai-doc/api/* BFF 与 /__ai-doc/ 可视化面板。
 */
export function aiDocAssistant(options: AiDocPluginOptions = {}): Plugin {
  let ctx: ServerContext
  const uiDir = options.uiDir ?? defaultUiDir()

  return {
    name: 'vite-plugin-ai-doc-assistant',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const root = options.root ?? server.config.root
      ctx = new ServerContext({
        root,
        componentEntries: options.componentEntries,
        componentGlobs: options.componentGlobs,
      })

      server.middlewares.use((req, res, next) => {
        // 先尝试 BFF API；非 API 再尝试 UI 静态资源；都不命中交还下游
        dispatch(ctx, req, res).then((handled) => {
          if (handled)
            return
          if (serveUi(uiDir, req, res))
            return
          next()
        }).catch(next)
      })

      server.config.logger.info('  [ai-doc] BFF ready at /__ai-doc/api/*')
      server.config.logger.info('  [ai-doc] UI panel at /__ai-doc/')
    },
  }
}

export default aiDocAssistant
