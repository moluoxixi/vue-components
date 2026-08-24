#!/usr/bin/env node

import process from 'node:process'
import { build, createServer } from 'vitepress'
import { watchElementPlusDocsContent } from './content'
import { prepareElementPlusDocs } from './prepare'
import { loadElementPlusDocsProject } from './project/load-config'

interface CliArguments {
  command: 'build' | 'dev' | 'prepare'
  configPath?: string
  host?: boolean | string
  open?: boolean | string
  port?: number
}

const usage = 'Usage: element-plus-docs <prepare|dev|build> [--config <path>] [--host [host]] [--port <port>] [--open]'

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
  if (command !== 'prepare' && command !== 'dev' && command !== 'build')
    throw new TypeError(usage)
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
    else if (argument === '--open' || argument.startsWith('--open=')) {
      const option = readOption(args, index)
      parsed.open = option.value ?? true
      index = option.nextIndex
    }
    else {
      throw new TypeError(`Unsupported element-plus-docs option: ${argument}`)
    }
  }
  return parsed
}

function selectedToken(providerId: string): string | undefined {
  switch (providerId) {
    case 'github': return process.env.GITHUB_TOKEN
    case 'gitlab': return process.env.GITLAB_TOKEN
    case 'gitee': return process.env.GITEE_TOKEN
    case 'yunxiao': return process.env.YUNXIAO_TOKEN
    default: return undefined
  }
}

function redactError(error: unknown, tokens: Array<string | undefined>): string {
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

async function main(): Promise<void> {
  if (process.argv.slice(2).some(argument => argument === '--help' || argument === '-h')) {
    console.log(usage)
    return
  }
  let providerId: string | undefined
  try {
    const args = parseArguments(process.argv.slice(2))
    const loaded = await loadElementPlusDocsProject({ configPath: args.configPath })
    providerId = process.env.VITE_DOCS_REPOSITORY_METADATA_PROVIDER?.trim()
      || loaded.project.repository.provider
    await prepareElementPlusDocs(loaded, { providerOverride: providerId })
    if (args.command === 'prepare')
      return
    if (args.command === 'build') {
      await build(loaded.docsRoot)
      return
    }

    const server = await createServer(loaded.docsRoot, {
      host: args.host,
      open: args.open,
      port: args.port,
    })
    const stopWatchingContent = watchElementPlusDocsContent(server, {
      docsRoot: loaded.docsRoot,
      generatedRoot: loaded.generatedRoot,
      project: loaded.project,
      projectRoot: loaded.projectRoot,
    })
    server.httpServer?.once('close', stopWatchingContent)
    await server.listen()
    server.printUrls()
  }
  catch (error) {
    const tokens = providerId
      ? [selectedToken(providerId)]
      : [process.env.GITHUB_TOKEN, process.env.GITLAB_TOKEN, process.env.GITEE_TOKEN, process.env.YUNXIAO_TOKEN]
    console.error(redactError(error, tokens))
    process.exitCode = error && typeof error === 'object' && 'exitCode' in error
      ? Number((error as { exitCode: unknown }).exitCode) || 1
      : 1
  }
}

void main()
