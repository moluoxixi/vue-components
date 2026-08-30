import { readFileSync } from 'node:fs'
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
})
