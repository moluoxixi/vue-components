import process from 'node:process'
import { build, createServer, serve } from 'vitepress'
import { watchElementPlusDocsContent } from '../content'
import { loadElementPlusDocsProject } from '../project'
import { prepareElementPlusDocs } from './prepare'

interface CliArguments {
  command: 'build' | 'dev' | 'prepare' | 'preview'
  configPath?: string
  host?: boolean | string
  open?: boolean | string
  port?: number
  strictPort?: boolean
}

export interface ElementPlusDocsCliRuntime {
  build: typeof build
  createServer: typeof createServer
  loadProject: typeof loadElementPlusDocsProject
  prepare: typeof prepareElementPlusDocs
  serve: typeof serve
  watchContent: typeof watchElementPlusDocsContent
}

export const elementPlusDocsCliUsage = 'Usage: element-plus-docs <prepare|dev|build> [--config <path>] [--host [host]] [--port <port>] [--strictPort] [--open]\n       element-plus-docs preview [--config <path>] [--port <port>]'

const defaultRuntime: ElementPlusDocsCliRuntime = {
  build,
  createServer,
  loadProject: loadElementPlusDocsProject,
  prepare: prepareElementPlusDocs,
  serve,
  watchContent: watchElementPlusDocsContent,
}

export function redactElementPlusDocsCliError(
  error: unknown,
  tokens: Array<string | undefined>,
): string {
  const messages: string[] = []
  let current: unknown = error
  const visited = new Set<unknown>()
  while (current !== undefined && current !== null && !visited.has(current)) {
    visited.add(current)
    messages.push(current instanceof Error ? (current.stack ?? current.message) : String(current))
    current = current instanceof Error ? current.cause : undefined
  }
  let message = messages.join('\nCaused by: ')
  for (const token of tokens) {
    if (!token)
      continue
    const queryEncodedToken = new URLSearchParams({ access_token: token })
      .toString()
      .slice('access_token='.length)
    for (const secret of new Set([token, encodeURIComponent(token), queryEncodedToken]))
      message = message.replaceAll(secret, '[REDACTED]')
  }
  return message
}

function readOption(args: string[], index: number): { nextIndex: number, value: string | undefined } {
  const current = args[index]!
  const separator = current.indexOf('=')
  if (separator >= 0)
    return { nextIndex: index, value: current.slice(separator + 1) }
  const next = args[index + 1]
  if (next && !next.startsWith('-'))
    return { nextIndex: index + 1, value: next }
  return { nextIndex: index, value: undefined }
}

function parseArguments(args: string[]): CliArguments {
  const command = args[0]
  if (command !== 'prepare' && command !== 'dev' && command !== 'build' && command !== 'preview')
    throw new TypeError(elementPlusDocsCliUsage)
  const parsed: CliArguments = { command }
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === '--config' || argument.startsWith('--config=')) {
      const option = readOption(args, index)
      if (!option.value)
        throw new TypeError('--config requires a path')
      parsed.configPath = option.value
      index = option.nextIndex
    }
    else if (argument === '--host' || argument.startsWith('--host=')) {
      const option = readOption(args, index)
      parsed.host = option.value ?? true
      index = option.nextIndex
    }
    else if (argument === '--port' || argument.startsWith('--port=')) {
      const option = readOption(args, index)
      const port = Number(option.value)
      if (!Number.isInteger(port) || port <= 0 || port > 65535)
        throw new TypeError('--port requires a valid TCP port')
      parsed.port = port
      index = option.nextIndex
    }
    else if (argument === '--strictPort') {
      parsed.strictPort = true
    }
    else if (argument === '--open' || argument.startsWith('--open=')) {
      const option = readOption(args, index)
      parsed.open = option.value ?? true
      index = option.nextIndex
    }
    else {
      throw new TypeError(`Unsupported element-plus-docs option: ${argument}`)
    }
  }
  if (parsed.command === 'preview' && (parsed.host !== undefined || parsed.open !== undefined || parsed.strictPort)) {
    throw new TypeError('element-plus-docs preview supports only --config and --port')
  }
  return parsed
}

export async function runElementPlusDocsCli(
  argv: string[],
  runtime: ElementPlusDocsCliRuntime = defaultRuntime,
): Promise<void> {
  const args = parseArguments(argv)
  const loaded = await runtime.loadProject({ configPath: args.configPath })
  const providerId = process.env.VITE_DOCS_REPOSITORY_METADATA_PROVIDER?.trim()
    || loaded.project.repository.provider
  await runtime.prepare(loaded, { providerOverride: providerId })
  if (args.command === 'prepare')
    return
  if (args.command === 'build') {
    await runtime.build(loaded.docsRoot)
    return
  }
  if (args.command === 'preview') {
    await runtime.serve({
      port: args.port,
      root: loaded.docsRoot,
    })
    return
  }

  const server = await runtime.createServer(loaded.docsRoot, {
    host: args.host,
    open: args.open,
    port: args.port,
    strictPort: args.strictPort,
  })
  const stopWatchingContent = runtime.watchContent(server, {
    docsRoot: loaded.docsRoot,
    generatedRoot: loaded.generatedRoot,
    project: loaded.project,
    projectRoot: loaded.projectRoot,
  })
  server.httpServer?.once('close', stopWatchingContent)
  await server.listen()
  server.printUrls()
}
