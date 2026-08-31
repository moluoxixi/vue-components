import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('configForm model architecture boundary', () => {
  it('keeps the project domain engine independent from UI and persistence', () => {
    const source = readFileSync(new URL('../src/engine.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/from ['"](?:vue|@moluoxixi\/config-form-designer|@config-form\/workbench)['"]/)
    expect(source).not.toContain('from \'./repository\'')
    expect(source).not.toContain('ProjectRepository')
    expect(source).not.toContain('currentPageId')
    expect(source).not.toContain('saving')
  })

  it('keeps removed schema and history aliases outside the public model package', () => {
    const types = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8')
    const history = types.match(/export interface ProjectHistory \{[\s\S]*?\n\}/)?.[0]
    const removedModules = [
      `../src/${['leg', 'acy'].join('')}.ts`,
      `../src/${['mig', 'rate'].join('')}.ts`,
    ]

    expect(history).toBeDefined()
    expect(history).not.toContain('present:')
    removedModules.forEach(path => expect(existsSync(new URL(path, import.meta.url))).toBe(false))
  })
})
