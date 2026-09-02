import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(import.meta.dirname, '../src')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry)
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : []
  })
}

describe('vue backend architecture boundary', () => {
  it('keeps one current package entry and indexed responsibility directories', () => {
    const entries = readdirSync(sourceRoot, { withFileTypes: true })
    const files = entries.filter(entry => entry.isFile()).map(entry => entry.name).sort()
    const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    const manifest = JSON.parse(readFileSync(resolve(sourceRoot, '../package.json'), 'utf8')) as {
      exports: Record<string, unknown>
    }
    const source = sourceFiles(sourceRoot).map(file => readFileSync(file, 'utf8')).join('\n')

    expect(files).toEqual(['index.ts'])
    expect(directories).toEqual(['services', 'state', 'types', 'utils'])
    directories.forEach((directory) => {
      expect(existsSync(resolve(sourceRoot, directory, 'index.ts'))).toBe(true)
    })
    expect(existsSync(resolve(sourceRoot, 'compile.ts'))).toBe(false)
    expect(existsSync(resolve(sourceRoot, 'types.ts'))).toBe(false)
    expect(readFileSync(resolve(sourceRoot, '../index.ts'), 'utf8').trim()).toBe('export * from \'./src\'')
    expect(Object.keys(manifest.exports)).toEqual(['.'])
    expect(source).not.toContain('@moluoxixi/config-form/renderer')
  })
})
