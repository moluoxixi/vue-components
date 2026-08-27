import type { I18nToolCliOverrides, I18nToolConfigInput, ResolvedI18nToolConfig } from './types'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'
import { createJiti } from 'jiti'
import { resolveI18nToolConfig } from './schema'

export const DEFAULT_CONFIG_FILES = [
  'i18n-tool.config.ts',
  'i18n-tool.config.mts',
  'i18n-tool.config.js',
  'i18n-tool.config.mjs',
] as const

export function defineConfig<const T extends I18nToolConfigInput>(config: T): T {
  return config
}

export function findConfigPath(startDirectory: string, explicitPath?: string): string {
  const start = resolve(startDirectory)
  if (explicitPath) {
    const selected = isAbsolute(explicitPath) ? explicitPath : resolve(start, explicitPath)
    if (!existsSync(selected))
      throw new Error(`i18n-tool config does not exist: ${selected}`)
    return selected
  }

  let current = start
  while (true) {
    for (const filename of DEFAULT_CONFIG_FILES) {
      const candidate = resolve(current, filename)
      if (existsSync(candidate))
        return candidate
    }
    const parent = dirname(current)
    if (parent === current)
      break
    current = parent
  }
  throw new Error(`Unable to find i18n-tool.config.ts from ${start}`)
}

export interface LoadConfigOptions {
  cli?: I18nToolCliOverrides
  configPath?: string
  cwd?: string
}

export async function loadI18nToolConfig(options: LoadConfigOptions = {}): Promise<ResolvedI18nToolConfig> {
  const cwd = resolve(options.cwd ?? process.cwd())
  const configPath = findConfigPath(cwd, options.configPath)
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const input = await jiti.import(configPath, { default: true })
  return resolveI18nToolConfig(input, { cli: options.cli, configPath, cwd })
}
