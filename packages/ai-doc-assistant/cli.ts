#!/usr/bin/env node
import { resolve } from 'node:path'
/**
 * CLI：抽取并校验组件契约（构建知识库）。
 *
 * 用法：
 *   ai-doc-assistant build-index [--root <dir>] [--globs <glob1,glob2>]
 *
 * 架构（ADR-0006）：组件库为小知识库，全量契约喂 chat 模型，无向量索引/持久化。
 * 本命令做一次性契约抽取，打印组件数量，用于 CI 校验抽取链路与组件可解析性。
 *
 * 设计：CLI 参数是系统边界，对必需输入做显式校验，缺失即报错退出（非 0）。
 */
import process from 'node:process'
import { ServerContext } from './src/server/context'

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
  const componentGlobs = args.globs ? args.globs.split(',') : undefined

  const ctx = new ServerContext({ root, componentGlobs })
  await ctx.buildIndex()
  const snap = ctx.state.snapshot()
  process.stdout.write(`[ai-doc] contracts extracted: ${snap.meta?.componentCount ?? 0} components\n`)
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv
  const args = parseArgs(rest)

  switch (cmd) {
    case 'build-index':
      await cmdBuildIndex(args)
      break
    default:
      process.stderr.write('usage: ai-doc-assistant build-index [--root <dir>] [--globs <glob1,glob2>]\n')
      process.exit(1)
  }
}

main().catch((err: unknown) => {
  // CLI 失败显式非 0 退出并打印原因，绝不静默成功
  process.stderr.write(`[ai-doc] error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
