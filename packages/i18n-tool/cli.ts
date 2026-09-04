#!/usr/bin/env node
import type { I18nToolCliOverrides } from './src/config'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { loadI18nToolConfig } from './src/config'
import { ServerContext } from './src/server/context'
import { i18nToolServerPlugin } from './src/server/plugin'

const USAGE = `Usage: i18n-tool [options]

Options:
  --config <path>       Config file path
  --root <path>         Override project root
  --host [host]         Override host (default 127.0.0.1)
  --port <port>         Override port
  --open [path]         Open the workbench
  -h, --help            Show help`

export interface I18nToolCliOptions extends I18nToolCliOverrides {
  configPath?: string
  help: boolean
}

function splitArgument(argument: string): { key: string, value?: string } {
  const equals = argument.indexOf('=')
  return equals < 0
    ? { key: argument }
    : { key: argument.slice(0, equals), value: argument.slice(equals + 1) }
}

function requiredValue(
  args: readonly string[],
  index: number,
  inline: string | undefined,
  option: string,
): { consumed: number, value: string } {
  const value = inline ?? args[index + 1]
  if (!value || value.startsWith('--'))
    throw new Error(`${option} requires a value.`)
  return { consumed: inline === undefined ? 1 : 0, value }
}

export function parseCliArgs(args: readonly string[]): I18nToolCliOptions {
  const parsed: I18nToolCliOptions = { help: false }
  for (let index = 0; index < args.length; index += 1) {
    const { key, value: inline } = splitArgument(args[index])
    if (key === '-h' || key === '--help') {
      parsed.help = true
      continue
    }
    if (key === '--config' || key === '--root' || key === '--port') {
      const { consumed, value } = requiredValue(args, index, inline, key)
      index += consumed
      if (key === '--config') {
        parsed.configPath = value
      }
      else if (key === '--root') {
        parsed.root = value
      }
      else {
        const port = Number(value)
        if (!Number.isInteger(port) || port < 1 || port > 65_535)
          throw new Error('--port must be an integer between 1 and 65535.')
        parsed.port = port
      }
      continue
    }
    if (key === '--host' || key === '--open') {
      if (inline !== undefined && !inline)
        throw new Error(`${key} cannot be blank.`)
      const following = args[index + 1]
      const optional = inline ?? (following && !following.startsWith('-') ? following : undefined)
      if (inline === undefined && optional !== undefined)
        index += 1
      if (key === '--host')
        parsed.host = optional ?? true
      else
        parsed.open = optional ?? true
      continue
    }
    throw new Error(`Unsupported i18n-tool option: ${key}`)
  }
  return parsed
}

function uiRoot(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url))
  return resolve(moduleDirectory, 'ui')
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(args)
  if (options.help) {
    console.log(USAGE)
    return
  }
  const config = await loadI18nToolConfig({
    cli: options,
    configPath: options.configPath,
  })
  const context = new ServerContext({ config })
  const server = await createServer({
    appType: 'spa',
    configFile: false,
    plugins: [i18nToolServerPlugin(context)],
    root: uiRoot(),
    server: {
      host: config.server.host,
      open: config.server.open,
      port: config.server.port,
    },
  })
  await server.listen()
  console.log(`[i18n-tool] config: ${config.configPath}`)
  console.log(`[i18n-tool] root: ${config.root}`)
  server.printUrls()
}

export async function runCliEntry(args = process.argv.slice(2)): Promise<void> {
  try {
    await runCli(args)
  }
  catch (error) {
    console.error(`[i18n-tool] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined
if (entry === import.meta.url)
  void runCliEntry()
