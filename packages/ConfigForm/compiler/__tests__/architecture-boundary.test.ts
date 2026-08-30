import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(import.meta.dirname, '../src')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry)
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : []
  })
}

describe('compiler architecture boundary', () => {
  it('does not depend on Vue, Runtime, Designer or Workbench', () => {
    const source = sourceFiles(sourceRoot).map(file => readFileSync(file, 'utf8')).join('\n')

    expect(source).not.toMatch(/from ['"]vue[/'"]/)
    expect(source).not.toContain('@moluoxixi/config-form-designer')
    expect(source).not.toContain('@moluoxixi/config-form/renderer')
    expect(source).not.toContain('@config-form/workbench')
  })
})
