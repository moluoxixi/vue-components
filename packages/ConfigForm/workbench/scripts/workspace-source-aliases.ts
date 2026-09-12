import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Alias } from 'vite'

const packagesDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const configFormSourceAliases: Alias[] = readdirSync(packagesDirectory, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .flatMap((entry) => {
    const directory = resolve(packagesDirectory, entry.name)
    const manifestPath = resolve(directory, 'package.json')
    if (!existsSync(manifestPath))
      return []
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const source = manifest.exports?.['.']?.source
    if (typeof manifest.name !== 'string'
      || !manifest.name.startsWith('@moluoxixi/config-form')
      || typeof source !== 'string') {
      return []
    }
    return [{
      find: new RegExp(`^${manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      replacement: resolve(directory, source),
    }]
  })
