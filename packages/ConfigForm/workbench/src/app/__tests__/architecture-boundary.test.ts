import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const configFormRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const repositoryRoot = fileURLToPath(new URL('../../../../../../', import.meta.url))
const ignoredDirectories = new Set(['coverage', 'dist', 'node_modules'])
const productTextFile = /\.(?:[cm]?[jt]sx?|css|html|json|md|scss|vue)$/

function collectProductTextFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return ignoredDirectories.has(entry.name) ? [] : collectProductTextFiles(path)
    return entry.isFile() && productTextFile.test(entry.name) ? [path] : []
  })
}

describe('workbench production architecture boundary', () => {
  it('keeps ProjectEditorSession as the only production editing owner', () => {
    const source = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    const forbidden = [
      ['Workspace', 'Session'].join(''),
      ['create', 'Workspace', 'Session'].join(''),
      ['openDefault', 'Workspace', 'Application', 'Repository'].join(''),
      ['apply', 'Workspace', 'Application', 'Operation'].join(''),
      ['Project', 'Store'].join(''),
      ['create', 'Project', 'Store'].join(''),
      'setCurrentPage(',
      `type: '${['update', 'page', 'model'].join('-')}'`,
    ]
    forbidden.forEach(token => expect(source).not.toContain(token))
  })

  it('does not ship removed project/session compatibility modules', () => {
    const removedModules = [
      `../../project/${['application', 'repository'].join('-')}.ts`,
      `../../project/${['applica', 'tion'].join('')}.ts`,
      `../../project/${['leg', 'acy-operation-adapter'].join('')}.ts`,
      `../../project/${['project-document', 'compatibility'].join('-')}.ts`,
      `../../project/${['storage', 'migration'].join('-')}.ts`,
      `../../session/${['workspace', 'session'].join('-')}.ts`,
      `../../workbench/${['config', 'codec'].join('-')}.ts`,
    ]

    removedModules.forEach(path => expect(existsSync(new URL(path, import.meta.url))).toBe(false))
  })

  it('keeps legacy contracts out of every ConfigForm source, test, script, template, and public declaration', () => {
    const forbiddenTokens = [
      ['Workspace', 'Application'].join(''),
      ['LowCode', 'PageModel'].join(''),
      ['Designer', 'Document'].join(''),
      ['Workspace', 'Session'].join(''),
      ['Workspace', 'Repository'].join(''),
      ['Project', 'Store'].join(''),
      ['compile', 'Designer', 'Document'].join(''),
      ['designer', 'DocumentToConfigModel'].join(''),
      ['configModel', 'ToDesigner', 'Document'].join(''),
      ['create', 'Designer', 'RuntimeProjection'].join(''),
      ['create', 'Workspace', 'Session'].join(''),
      ['create', 'Project', 'Store'].join(''),
      ['update', 'page', 'model'].join('-'),
    ]
    const forbiddenPaths = [
      ['model', 'src', ['leg', 'acy.ts'].join('')],
      ['model', 'src', ['mig', 'rate.ts'].join('')],
      ['designer', 'src', 'compiler'],
      ['designer', 'src', 'document'],
      ['designer', 'src', 'history'],
      ['designer', 'src', 'model'],
      ['designer', 'src', 'components', ['ConfigForm', 'Designer.vue'].join('')],
      ['playground', ['designer', '.html'].join('')],
      ['playground', 'src', 'designer'],
      ['workbench', 'src', 'design'],
      ['workbench', 'src', 'project', ['application', 'repository-indexed-db.ts'].join('-')],
      ['workbench', 'src', 'project', ['application', 'repository.ts'].join('-')],
      ['workbench', 'src', 'project', ['applica', 'tion.ts'].join('')],
      ['workbench', 'src', 'project', ['legacy', 'operation-adapter.ts'].join('-')],
      ['workbench', 'src', 'project', ['project-document', 'compatibility.ts'].join('-')],
      ['workbench', 'src', 'project', ['repository', 'memory.ts'].join('-')],
      ['workbench', 'src', 'project', ['storage', 'migration.ts'].join('-')],
      ['workbench', 'src', 'project', ['up', 'grade.ts'].join('')],
      ['workbench', 'src', 'session', ['workspace', 'session.ts'].join('-')],
      ['workbench', 'src', 'workbench', ['config', 'codec.ts'].join('-')],
    ]
    const scannedRoots = [configFormRoot, join(repositoryRoot, 'scripts')]
    const hits = scannedRoots.flatMap(root => collectProductTextFiles(root)).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return forbiddenTokens
        .filter(token => source.includes(token))
        .map(token => `${relative(repositoryRoot, path)}: ${token}`)
    })

    const existingPaths = forbiddenPaths
      .map(parts => join(configFormRoot, ...parts))
      .filter(path => existsSync(path))
      .map(path => relative(configFormRoot, path))

    expect(hits).toEqual([])
    expect(existingPaths).toEqual([])
  })

  it('routes normal Design rendering through Canonical IR and the Vue backend', () => {
    const controller = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    const designSession = readFileSync(new URL('../../session/workbench-design-session.ts', import.meta.url), 'utf8')
    const exportService = readFileSync(new URL('../../session/workbench-export-service.ts', import.meta.url), 'utf8')
    expect(designSession).toContain('createCompileCoordinator')
    expect(designSession).toContain('coordinator.compilePage(pageId)')
    expect(designSession).toContain('coordinator.compileDraftPage(snapshot, pageId, changeSet)')
    expect(designSession).toContain('createProjectDraftSnapshotFromTransaction')
    expect(designSession).toContain('compileCanonicalPageRuntime')
    expect(designSession).not.toContain('compileCanonicalProject')
    expect(exportService).toContain('compileCanonicalProject')
    expect(controller).not.toContain('compileCanonicalProject')
    expect(controller).not.toContain('compileCanonicalPageRuntime')
    expect(controller).not.toContain('createCompileCoordinator')
    expect(controller).not.toContain(['configModel', 'ToDesigner', 'Document'].join(''))
    expect(controller).not.toContain(['compile', 'Designer', 'Document(document'].join(''))
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
    const designSession = readFileSync(new URL('../../session/workbench-design-session.ts', import.meta.url), 'utf8')
    expect(shell).not.toContain('@model-operation')
    expect(designSession).toContain('commandControl: { execute, preview }')
    expect(designSession).toContain('const result = session.execute(command)')
  })

  it('provides Design, Preview, Export, and UI through separate contexts', () => {
    const context = readFileSync(new URL('../workbench-context.ts', import.meta.url), 'utf8')
    const shell = readFileSync(new URL('../WorkbenchShell.vue', import.meta.url), 'utf8')
    for (const name of [
      'useWorkbenchDesignSession',
      'useWorkbenchPreviewSession',
      'useWorkbenchExportService',
      'useWorkbenchUiStore',
    ]) {
      expect(context).toContain(`export function ${name}`)
      expect(shell).toContain(`${name}()`)
    }
    expect(shell).not.toContain('compileCanonicalProject')
    expect(shell).not.toContain('compileCanonicalPageRuntime')
  })

  it('delegates Preview runtime state and lifecycle to PreviewSession', () => {
    const controller = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    const previewSession = readFileSync(new URL('../../session/preview-session.ts', import.meta.url), 'utf8')

    expect(controller).toContain('createWorkbenchPreviewSession')
    expect(controller).toContain('previewSession.accept')
    expect(controller).toContain('previewSession.dispose')
    expect(controller).not.toContain('createPageProjectionCoordinator')
    expect(controller).not.toContain('lastRuntimePreview')
    expect(controller).not.toContain('reconcilePreviewModel')
    expect(controller).not.toContain('projectionCoordinator')
    expect(controller).not.toContain('pageFlowEngine')
    expect(previewSession).toContain('createPageProjectionCoordinator')
    expect(previewSession).toContain('lastReadyPreview')
    expect(previewSession).toContain('handleRuntimeMounted')
    expect(previewSession).toContain('handleRuntimeState')
    expect(previewSession).toContain('const touched = shallowRef')
    expect(previewSession).toContain('const validation = shallowRef')
    expect(previewSession).toContain('const trace = shallowRef')
  })

  it('keeps transient chrome state inside the UI Store', () => {
    const controller = readFileSync(new URL('../workbench-controller.ts', import.meta.url), 'utf8')
    const shell = readFileSync(new URL('../WorkbenchShell.vue', import.meta.url), 'utf8')
    const uiStore = readFileSync(new URL('../workbench-ui-store.ts', import.meta.url), 'utf8')
    const uiRefs = [
      'mobileStudioView',
      'studioLeftView',
      'previewOpen',
      'previewExpanded',
      'previewViewport',
      'templatePickerOpen',
      'pageManagerOpen',
      'exportPreviewMode',
      'flowWorkspaceOpen',
      'theme',
      'localeId',
      'message',
    ]

    uiRefs.forEach((name) => {
      expect(controller).not.toContain(`const ${name} = ref`)
      expect(uiStore).toContain(`const ${name} = ref`)
    })
    expect(shell).toContain('useWorkbenchUiStore()')
    expect(uiStore).not.toContain('ProjectDocument')
    expect(uiStore).not.toContain('RuntimeHostRuntimeStatePayload')
    expect(uiStore).not.toContain('ExportSnapshot')
  })

  it('delegates event-flow execution to the page Flow Engine', () => {
    const previewSession = readFileSync(new URL('../../session/preview-session.ts', import.meta.url), 'utf8')
    const engine = readFileSync(new URL('../../flow/page-flow-engine.ts', import.meta.url), 'utf8')

    expect(previewSession).toContain('createWorkbenchPageFlowEngine')
    expect(previewSession).toContain('flowEngine.dispatch')
    expect(previewSession).not.toContain('new ConfigFormFlowInterpreter')
    expect(previewSession).not.toContain('new PreviewFlowCoordinator')
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
