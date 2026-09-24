import type { Alias } from 'vite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packagesDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** Internal tsconfig path aliases used by inlined ConfigForm package sources. */
const INTERNAL_SOURCE_ALIASES: Record<string, Record<string, string>> = {
  '@moluoxixi/config-form-designer': { '@designer': './src' },
}

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
    const aliases: Alias[] = [{
      find: new RegExp(`^${manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      replacement: resolve(directory, source),
    }]
    // Packages whose sources declare internal path aliases in tsconfig.app.json need the
    // same mapping here: workbench compiles their sources in place through the entry alias.
    const internalAliases = INTERNAL_SOURCE_ALIASES[manifest.name]
    if (internalAliases) {
      for (const [find, to] of Object.entries(internalAliases)) {
        aliases.push({ find, replacement: resolve(directory, to) })
      }
    }
    return aliases
  })
