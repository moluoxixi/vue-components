import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))
const responsibilityDirectories = ['constants', 'schemas', 'services', 'types']

describe('configForm model architecture boundary', () => {
  it('keeps the project domain engine independent from UI and persistence', () => {
    const source = readFileSync(new URL('../src/services/engine.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/from ['"](?:vue|@moluoxixi\/config-form-designer|@config-form\/workbench)['"]/)
    expect(source).not.toContain('from \'./repository\'')
    expect(source).not.toContain('ProjectRepository')
    expect(source).not.toContain('currentPageId')
    expect(source).not.toContain('saving')
  })

  it('keeps removed schema and history contracts outside the public model package', () => {
    const types = readFileSync(new URL('../src/types/contracts.ts', import.meta.url), 'utf8')
    const history = types.match(/export interface ProjectHistory \{[\s\S]*?\n\}/)?.[0]
    const removedModules = [
      `../src/${['leg', 'acy'].join('')}.ts`,
      `../src/${['mig', 'rate'].join('')}.ts`,
      '../src/command.ts',
      '../src/engine.ts',
      '../src/history.ts',
      '../src/registry.ts',
      '../src/repository.ts',
      '../src/schema.ts',
      '../src/transaction.ts',
      '../src/types.ts',
    ]

    expect(history).toBeDefined()
    expect(history).not.toContain('present:')
    removedModules.forEach(path => expect(existsSync(new URL(path, import.meta.url))).toBe(false))
  })

  it('groups model code by responsibility without forwarding files', () => {
    const sourceEntries = readdirSync(sourceRoot, { withFileTypes: true })
    const rootFiles = sourceEntries.filter(entry => entry.isFile()).map(entry => entry.name)
    const rootDirectories = sourceEntries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    const missingBarrels = responsibilityDirectories.filter(
      directory => !existsSync(join(sourceRoot, directory, 'index.ts')),
    )
    const executableTypeFiles = readdirSync(join(sourceRoot, 'types'), { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
      .filter((entry) => {
        const source = readFileSync(join(sourceRoot, 'types', entry.name), 'utf8')
        return /^export\s+(?:class|const|function|let|var)\b/m.test(source)
      })
      .map(entry => entry.name)
    const rootEntry = readFileSync(new URL('../index.ts', import.meta.url), 'utf8')

    expect(rootFiles).toEqual([])
    expect(rootDirectories).toEqual(responsibilityDirectories)
    expect(missingBarrels).toEqual([])
    expect(executableTypeFiles).toEqual([])
    expect(rootEntry).toContain('from \'./src/constants\'')
    expect(rootEntry).toContain('from \'./src/schemas\'')
    expect(rootEntry).toContain('from \'./src/services\'')
    expect(rootEntry).toContain('from \'./src/types\'')
    expect(rootEntry).not.toMatch(/from ['"]\.\/src['"]/)
  })
})
