import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

export function syncApiOutputDirectory(outDir: string, componentNames: string[]): string[] {
  mkdirSync(outDir, { recursive: true })

  const expectedFiles = new Set(componentNames.map(name => `${name}.json`))
  const apiEntries = readdirSync(outDir, { withFileTypes: true })
    .filter(entry => entry.name.endsWith('.json'))
  const unsupportedEntries = apiEntries
    .filter(entry => !entry.isFile())
    .map(entry => entry.name)
    .sort()

  if (unsupportedEntries.length > 0)
    throw new Error(`API output contains non-file entries: ${unsupportedEntries.join(', ')}`)

  const removed: string[] = []
  for (const entry of apiEntries) {
    if (expectedFiles.has(entry.name))
      continue
    const path = resolve(outDir, entry.name)
    if (existsSync(path))
      unlinkSync(path)
    removed.push(entry.name)
  }

  return removed.sort()
}
