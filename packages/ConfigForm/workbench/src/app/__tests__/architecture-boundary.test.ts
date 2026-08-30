import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('workbench production architecture boundary', () => {
  it('does not restore legacy reducers or mixed ProjectStore ownership', () => {
    const source = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    const forbidden = [
      'WorkspaceSession',
      'createWorkspaceSession',
      'openDefaultWorkspaceApplicationRepository',
      'applyWorkspaceApplicationOperation',
      'ProjectStore',
      'createProjectStore',
      'setCurrentPage(',
      'type: \'update-page-model\'',
    ]
    forbidden.forEach(token => expect(source).not.toContain(token))
  })

  it('routes normal Design and Preview rendering through Canonical IR and the Vue backend', () => {
    const source = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    expect(source).toContain('compileCanonicalProject')
    expect(source).toContain('compileCanonicalPageRuntime')
    expect(source).toContain('canonicalPageRuntime')
    expect(source).not.toContain('configModelToDesignerDocument')
    expect(source).not.toContain('compileDesignerDocument(document')
  })

  it('keeps property mutations on the single Designer command bridge', () => {
    const shell = readFileSync(new URL('../WorkbenchShell.vue', import.meta.url), 'utf8')
    const controller = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    expect(shell).not.toContain('@model-operation')
    expect(controller).toContain('applyModelOperation: updateModelOperation')
    expect(controller).toContain('executeProjectActions(\'Update design\'')
  })
})
