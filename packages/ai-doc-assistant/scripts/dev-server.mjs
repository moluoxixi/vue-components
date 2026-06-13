#!/usr/bin/env node
/**
 * 本地可视化面板 dev launcher（手动体验用，非自动化测试）。
 *
 * 起一个真实 HTTP server：
 *  - /__ai-doc/api/*  → dispatch(ctx) 驱动真实 ServerContext（BFF）
 *  - /__ai-doc/        → 静态服务 dist/ui（编译后的 Vue 面板）
 *
 * 组件根目录默认指向本 monorepo 的 packages（可用 --root 覆盖），
 * 这样构建索引后能在面板左侧看到真实组件清单。
 *
 * chat 问答需要 AI_DOC_CHAT_API_KEY（缺失时面板照常打开、可浏览组件清单与构建索引，
 * 但提问会因 provider 未配置而失败——health 会显示 chat=missing）。
 *
 * 用法：
 *   node scripts/dev-server.mjs [--root <dir>] [--port <n>] [--host <h>]
 */
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line antfu/no-import-dist -- dev 面板刻意运行真实 dist 发布形态
import { dispatch, ServerContext } from '../dist/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = resolve(__dirname, '..')
const UI_DIR = resolve(PKG_ROOT, 'dist', 'ui')
const UI_PREFIX = '/__ai-doc'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/** 极简参数解析：--key value。 */
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      out[key] = val
    }
  }
  return out
}

/** 静态资源服务：仅 dist/ui 内，未知子路径回落 index.html（SPA）。 */
function serveUi(req, res) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  // 默认指向 monorepo 根（packages/ai-doc-assistant 往上两级），扫真实组件库
  const root = resolve(args.root ?? resolve(PKG_ROOT, '..', '..'))
  const port = Number(args.port ?? 5180)
  const host = args.host ?? '127.0.0.1'

  if (!existsSync(UI_DIR)) {
    process.stderr.write(`[ai-doc] 缺少 UI 构建产物：${UI_DIR}\n先运行 pnpm build（或 pnpm build:ui）。\n`)
    process.exit(1)
  }

  const ctx = new ServerContext({ root })

  const server = createServer((req, res) => {
    dispatch(ctx, req, res).then((handled) => {
      if (handled)
        return
      if (serveUi(req, res))
        return
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
    }).catch((err) => {
      // 显式暴露错误，绝不静默吞
      process.stderr.write(`[ai-doc] request error: ${err instanceof Error ? err.message : String(err)}\n`)
      if (!res.headersSent)
        res.writeHead(500)
      res.end()
    })
  })

  server.listen(port, host, () => {
    const chatConfigured = !!process.env.AI_DOC_CHAT_API_KEY
    process.stdout.write(`\n[ai-doc] 面板已启动：http://${host}:${port}${UI_PREFIX}/\n`)
    process.stdout.write(`[ai-doc] 组件根目录：${root}\n`)
    process.stdout.write(`[ai-doc] chat 上游：${chatConfigured ? 'configured（可问答）' : 'missing（仅可浏览/构建索引，提问会失败）'}\n\n`)
  })
}

main().catch((err) => {
  process.stderr.write(`[ai-doc] 启动失败：${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
