#!/usr/bin/env node
import { resolve } from 'node:path'
/**
 * CLI：抽取并校验组件契约（build-index），或起本地调试面板（serve）。
 *
 * 用法：
 *   ai-doc-assistant build-index [--root <dir>] [--entries <entry1,entry2>]
 *   ai-doc-assistant serve [--root <dir>] [--entries <entry1,entry2>] [--port 5173] [--host 127.0.0.1]
 *
 * 架构（ADR-0006）：默认只抽取公共契约并建立关键词检索态，无向量索引/持久化。
 * build-index 做一次性契约抽取打印组件数量（CI 校验抽取链路）；serve 起一个内置 Vite dev
 * server 挂 aiDocAssistant 插件，零配置在 /__ai-doc/ 提供可视化面板，使包自包含、消费方
 * 无需自建 playground。content 模式（默认）浏览契约无需任何 provider key。
 *
 * 设计：CLI 参数是系统边界，对必需输入做显式校验，缺失即报错退出（非 0）。
 */
import process from 'node:process'
import { ServerContext } from './src/server/context'
import { aiDocAssistant } from './src/server/plugin'

/** 极简参数解析：--key value → { key: value }。 */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
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

/** build-index 子命令：抽取契约并打印组件数量。 */
async function cmdBuildIndex(args: Record<string, string>): Promise<void> {
  const root = resolve(args.root ?? process.cwd())
  const componentEntries = args.entries ? args.entries.split(',') : undefined
  const componentGlobs = args.globs ? args.globs.split(',') : undefined

  const ctx = new ServerContext({ root, componentEntries, componentGlobs })
  await ctx.buildIndex()
  const snap = ctx.state.snapshot()
  process.stdout.write(`[ai-doc] contracts extracted: ${snap.meta?.componentCount ?? 0} components\n`)
}

/**
 * serve 子命令：起一个内置 Vite dev server 挂 aiDocAssistant 插件，在 /__ai-doc/ 提供可视化面板。
 *
 * 让包自包含：消费方无需自建 playground，一行 `ai-doc-assistant serve` 即可浏览组件契约。
 * vite 是本包 peerDependency（消费方工程必有），故运行时动态 import，不进 lib bundle。
 * content 模式（默认）浏览契约无需任何 provider key；chat 能力按需读 AI_DOC_CHAT_* 环境变量。
 */
async function cmdServe(args: Record<string, string>): Promise<void> {
  const root = resolve(args.root ?? process.cwd())
  const componentEntries = args.entries ? args.entries.split(',') : undefined
  const componentGlobs = args.globs ? args.globs.split(',') : undefined
  const port = args.port ? Number(args.port) : 5173
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`invalid --port: ${args.port} (expected integer 1..65535)`)
  const host = args.host ?? '127.0.0.1'

  // vite 是 peerDependency，运行时动态加载（消费方工程必装），避免进 lib 产物。
  const { createServer } = await import('vite')
  const server = await createServer({
    root,
    server: { host, port },
    plugins: [aiDocAssistant({ root, componentEntries, componentGlobs })],
  })
  await server.listen()
  const resolvedPort = server.config.server.port ?? port
  process.stdout.write(`[ai-doc] panel ready at http://${host}:${resolvedPort}/__ai-doc/\n`)
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv
  const args = parseArgs(rest)

  switch (cmd) {
    case 'build-index':
      await cmdBuildIndex(args)
      break
    case 'serve':
      await cmdServe(args)
      break
    default:
      process.stderr.write(
        'usage:\n'
        + '  ai-doc-assistant build-index [--root <dir>] [--entries <e1,e2>] [--globs <g1,g2>]\n'
        + '  ai-doc-assistant serve [--root <dir>] [--entries <e1,e2>] [--globs <g1,g2>] [--port 5173] [--host 127.0.0.1]\n',
      )
      process.exit(1)
  }
}

main().catch((err: unknown) => {
  // CLI 失败显式非 0 退出并打印原因，绝不静默成功
  process.stderr.write(`[ai-doc] error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
