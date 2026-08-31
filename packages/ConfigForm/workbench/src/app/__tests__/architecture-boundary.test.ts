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

  it('routes normal Design rendering through Canonical IR and the Vue backend', () => {
    const source = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    expect(source).toContain('compileCanonicalProject')
    expect(source).toContain('createCompileCoordinator')
    expect(source).toContain('coordinator.compilePage(pageId)')
    expect(source).toContain('coordinator.compileDraftPage(snapshot, pageId, changeSet)')
    expect(source).toContain('createProjectDraftSnapshotFromTransaction')
    expect(source).toContain('compileCanonicalPageRuntime')
    expect(source).toContain('canonicalPageRuntime')
    const realtimeCompiler = source.slice(
      source.indexOf('function compileCanonicalDocument'),
      source.indexOf('function projectSnapshotFromEditorSession'),
    )
    expect(realtimeCompiler).not.toContain('compileCanonicalProject')
    expect(source).not.toContain('configModelToDesignerDocument')
    expect(source).not.toContain('compileDesignerDocument(document')
  })

  it('keeps Preview inside an iframe RuntimeHost with a data-only protocol', () => {
    const drawer = readFileSync(new URL('../../studio/PreviewDrawer.vue', import.meta.url), 'utf8')
    const host = readFileSync(new URL('../../runtime-host/RuntimeHostApp.vue', import.meta.url), 'utf8')
    const protocol = readFileSync(new URL('../../runtime-host/protocol.ts', import.meta.url), 'utf8')

    expect(drawer).toContain('PreviewRuntimeHostFrame')
    expect(drawer).not.toContain('RuntimeSurface')
    expect(drawer).not.toContain('VueRuntimeCompileSuccess')
    expect(host).toContain('compileCanonicalPageRuntime')
    expect(host).toContain('loadWorkbenchRuntimeAdapter')
    expect(protocol).toContain('compilation: PageCompilation')
    expect(protocol).not.toContain('from \'@moluoxixi/config-form/renderer\'')
  })

  it('keeps property mutations on the single Designer command bridge', () => {
    const shell = readFileSync(new URL('../WorkbenchShell.vue', import.meta.url), 'utf8')
    const controller = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    expect(shell).not.toContain('@model-operation')
    expect(controller).toContain('applyModelOperation: updateModelOperation')
    expect(controller).toContain('executeProjectActions(\'Update design\'')
  })

  it('delegates event-flow execution to the page Flow Engine', () => {
    const controller = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    const engine = readFileSync(new URL('../../flow/page-flow-engine.ts', import.meta.url), 'utf8')

    expect(controller).toContain('createWorkbenchPageFlowEngine')
    expect(controller).toContain('pageFlowEngine.dispatch')
    expect(controller).not.toContain('new ConfigFormFlowInterpreter')
    expect(controller).not.toContain('new PreviewFlowCoordinator')
    expect(controller).not.toContain('previewFlowProjections')
    expect(engine).toContain('new ConfigFormFlowInterpreter')
    expect(engine).toContain('new PreviewFlowCoordinator')
    expect(engine).toContain('createWorkbenchFlowActionRegistry')
  })

  it('uses Flow as the only normal Workbench editor for registered component events', () => {
    const shell = readFileSync(new URL('../WorkbenchShell.vue', import.meta.url), 'utf8')
    const dialog = readFileSync(new URL('../../features/flow/FlowDialog.vue', import.meta.url), 'utf8')

    expect(shell).toContain('event-editor="flow"')
    expect(shell).toContain('@configure-event="showComponentEventFlow"')
    expect(shell).not.toContain('@model-operation')
    expect(dialog).toContain(':initial-trigger="initialTrigger"')
  })
})
