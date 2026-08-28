<script setup lang="ts">
import type {
  ConfigModelHistory,
  DesignerDocument,
  DesignerCommand,
  DesignerCompileSuccess,
  DesignerNode,
  DesignerRegistry,
  DesignerSelectionMode,
  ConfigFormDesignerExpose,
  LowCodeNode,
  LowCodePageModel,
  ModelOperation,
} from '@moluoxixi/config-form-designer'
import type {
  ProjectPath,
  WorkspaceProject,
  WorkspaceProjectRepository,
  WorkspaceProjectSummary,
} from './project'
import {
  Blocks,
  Braces,
  ChevronDown as MoveDown,
  ChevronDown,
  ChevronUp,
  Code2,
  Clipboard,
  Copy,
  Download,
  Files,
  Layers3,
  IndentDecrease,
  IndentIncrease,
  Maximize2,
  Minimize2,
  Moon,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Sun,
  Undo2,
  X,
} from '@lucide/vue'
import {
  applyConfigModelOperation,
  applyModelOperation,
  compileDesignerDocument,
  configModelToDesignerDocument,
  ConfigFormDesigner,
  createConfigModelHistory,
  createLowCodeComponentRegistry,
  DesignerPalette,
  designerCommandToModelOperation,
  designerDocumentToConfigModel,
  parseDesignerDocument,
  redoConfigModelHistory,
  undoConfigModelHistory,
} from '@moluoxixi/config-form-designer'
import { createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import PreviewRuntimeBoundary from './components/PreviewRuntimeBoundary.vue'
import {
  BUILT_IN_WORKSPACE_TEMPLATES,
  cloneWorkspaceProject,
  createBuiltInWorkspaceProject,
  downloadProjectArchive,
  formatWorkspaceAppComponent,
  normalizeProjectPath,
  openDefaultWorkspaceProjectRepository,
  upgradeWorkspaceConfigModule,
  WORKSPACE_CONFIG_MODULE_PATH,
} from './project'
import { formatLowCodePageConfig } from './workbench/config-codec'

const WorkspaceCodeEditor = defineAsyncComponent(() => import('./components/WorkspaceCodeEditor.vue'))

type MobileSurface = 'edit' | 'preview'
type PreviewViewport = 'desktop' | 'tablet' | 'mobile'
type DesignerLeftView = 'components' | 'layers' | 'pages'
type WorkbenchTheme = 'dark' | 'light'

const SOURCE_PATH = normalizeProjectPath('src/App.vue')
const CONFIG_PATH = WORKSPACE_CONFIG_MODULE_PATH
const previewViewports = [
  { icon: Monitor, id: 'desktop' as const, label: 'Desktop preview' },
  { icon: Tablet, id: 'tablet' as const, label: 'Tablet preview' },
  { icon: Smartphone, id: 'mobile' as const, label: 'Mobile preview' },
]
const designerLeftViews = [
  { icon: Blocks, id: 'components' as const, label: 'Components' },
  { icon: Layers3, id: 'layers' as const, label: 'Layers' },
  { icon: Files, id: 'pages' as const, label: 'Pages' },
]
const sourcePaths = ['src/App.vue', 'src/form.config.ts'] as const
const registries: Record<WorkspaceProject['manifest']['adapter'], DesignerRegistry> = {
  'antd-vue': createAntdVueDesignerRegistry(),
  'element-plus': createElementPlusDesignerRegistry(),
}
const lowCodeRegistries = {
  'antd-vue': createLowCodeComponentRegistry(registries['antd-vue']),
  'element-plus': createLowCodeComponentRegistry(registries['element-plus']),
}

const repository = shallowRef<WorkspaceProjectRepository>()
const projects = ref<WorkspaceProjectSummary[]>([])
const currentProject = shallowRef<WorkspaceProject>()
const configHistory = shallowRef<ConfigModelHistory>()
const configError = ref('')
const mobileSurface = ref<MobileSurface>('edit')
const previewOpen = ref(false)
const previewExpanded = ref(false)
const previewViewport = ref<PreviewViewport>('desktop')
const previewModel = ref<Record<string, unknown>>({})
const fallbackPreviewModel = ref<Record<string, unknown>>({})
const rendererPreviewVersion = ref(0)
const dirty = ref(false)
const templatePickerOpen = ref(false)
const exportMenuOpen = ref(false)
const exportPreviewMode = ref<'source' | 'config'>()
const configViewMode = ref<'json' | 'tree'>('json')
const exportPreviewReturnFocus = ref<HTMLElement>()
const activeDesignerLeftView = ref<DesignerLeftView>('components')
const selectedDesignerIds = ref<string[]>([])
const sourceViewPath = ref<'src/App.vue' | 'src/form.config.ts'>('src/App.vue')
const theme = ref<WorkbenchTheme>('dark')
const busy = ref(false)
const message = ref('')
const newPageButtonRef = useTemplateRef<HTMLButtonElement>('newPageButton')
const exportButtonRef = useTemplateRef<HTMLButtonElement>('exportButton')
const templateDialogRef = useTemplateRef<HTMLElement>('templateDialog')
const exportDialogRef = useTemplateRef<HTMLElement>('exportDialog')
const designerRef = useTemplateRef<ConfigFormDesignerExpose>('designer')
const designerLeftTabsRef = useTemplateRef<HTMLElement>('designerLeftTabs')
const mobileSurfaceTabsRef = useTemplateRef<HTMLElement>('mobileSurfaceTabs')
let openProjectRequestId = 0
let disposed = false

const lowCodeRegistry = computed(() => currentProject.value
  ? lowCodeRegistries[currentProject.value.manifest.adapter]
  : lowCodeRegistries['element-plus'])
const registry = computed(() => lowCodeRegistry.value.designer)
const configModel = computed(() => configHistory.value?.present)
const modelRevision = computed(() => configHistory.value?.revision ?? 0)
const designerDocument = computed(() => configModel.value
  ? configModelToDesignerDocument(configModel.value)
  : undefined)
interface DesignerLayerEntry { id: string, label: string, component: string, depth: number }
const designerLayers = computed<DesignerLayerEntry[]>(() => {
  const entries: DesignerLayerEntry[] = []
  const visit = (nodes: DesignerNode[], depth: number): void => {
    nodes.forEach((node) => {
      entries.push({
        id: node.id,
        label: node.kind === 'field'
          ? node.label ?? node.field
          : registry.value.getMaterial(node.material)?.title ?? node.material,
        component: node.material,
        depth,
      })
      if (node.kind === 'container')
        Object.values(node.slots).forEach(children => visit(children, depth + 1))
    })
  }
  visit(designerDocument.value?.nodes ?? [], 0)
  return entries
})
const generatedSourceFiles = computed(() => ({
  'src/App.vue': currentProject.value
    ? formatWorkspaceAppComponent(currentProject.value.manifest.adapter)
    : '',
  'src/form.config.ts': configModel.value ? formatLowCodePageConfig(configModel.value, lowCodeRegistry.value) : '',
}))
const sourceCode = computed(() => generatedSourceFiles.value[sourceViewPath.value])
const sourceLanguage = computed(() => sourceViewPath.value.endsWith('.vue') ? 'vue' : 'typescript')
const generatedConfigJson = computed(() => configModel.value
  ? `${JSON.stringify(configModel.value, null, 2)}\n`
  : '')
interface ConfigTreeEntry { path: string, value: string, depth: number, branch: boolean }
const generatedConfigTree = computed<ConfigTreeEntry[]>(() => {
  const root = configModel.value
  if (!root)
    return []
  const entries: ConfigTreeEntry[] = []
  const visit = (value: unknown, path: string, depth: number): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth))
      return
    }
    if (typeof value === 'object' && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        const childPath = path ? `${path}.${key}` : key
        const branch = typeof child === 'object' && child !== null
        entries.push({ path: childPath, value: branch ? (Array.isArray(child) ? `[${child.length}]` : '{…}') : JSON.stringify(child), depth, branch })
        if (branch)
          visit(child, childPath, depth + 1)
      }
    }
  }
  visit(root, '', 0)
  return entries
})
const compiledPreview = computed(() => designerDocument.value
  ? compileDesignerDocument(designerDocument.value, registry.value)
  : undefined)
const lastValidPreview = shallowRef<{
  projectId: string
  revision: number
  result: DesignerCompileSuccess
}>()
const lastRuntimePreview = shallowRef<{
  projectId: string
  result: DesignerCompileSuccess
}>()
watch(compiledPreview, (result) => {
  const projectId = currentProject.value?.id
  if (result?.success && projectId) {
    lastValidPreview.value = {
      projectId,
      revision: modelRevision.value,
      result,
    }
  }
}, { immediate: true })
const activePreview = computed(() => {
  if (compiledPreview.value?.success)
    return compiledPreview.value
  const lastValid = lastValidPreview.value
  if (lastValid && lastValid.projectId === currentProject.value?.id)
    return lastValid.result
  return undefined
})
const previewState = computed(() => {
  if (configError.value || !compiledPreview.value?.success) {
    if (activePreview.value)
      return { label: `Last valid r${lastValidPreview.value?.revision ?? modelRevision.value}`, tone: 'error' as const }
    return { label: 'Blocked', tone: 'error' as const }
  }
  return { label: dirty.value ? 'Live draft' : 'Live', tone: 'live' as const }
})
const runtimeFallbackPreview = computed(() => {
  const fallback = lastRuntimePreview.value
  if (!fallback || fallback.projectId !== currentProject.value?.id)
    return undefined
  return fallback.result
})
const designerHistoryControl = computed(() => ({
  canUndo: (configHistory.value?.past.length ?? 0) > 0,
  canRedo: (configHistory.value?.future.length ?? 0) > 0,
  undo: undoDesign,
  redo: redoDesign,
}))
const hasUnsavedChanges = computed(() => dirty.value || !!configError.value)
const statusLabel = computed(() => {
  if (!repository.value)
    return 'Loading'
  if (hasUnsavedChanges.value)
    return 'Unsaved'
  return repository.value.persistence === 'durable' ? 'Saved locally' : 'Temporary session'
})

function readTextFile(project: WorkspaceProject | undefined, path: ProjectPath): string {
  const file = project?.files[path]
  return file?.kind === 'text' ? file.content : ''
}

function writeTextFile(project: WorkspaceProject, path: ProjectPath, content: string, language: string): WorkspaceProject {
  const next = cloneWorkspaceProject(project)
  next.files[path] = { content, kind: 'text', language }
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLowCodeNode(value: unknown): value is LowCodeNode {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.component !== 'string'
    || !['field', 'container'].includes(String(value.kind))
    || !isRecord(value.props)
    || !isRecord(value.events)
    || !isRecord(value.bindings)
    || !Array.isArray(value.children)
    || !isRecord(value.slots)) {
    return false
  }
  return value.children.every(isLowCodeNode)
    && Object.values(value.slots).every(nodes => Array.isArray(nodes) && nodes.every(isLowCodeNode))
}

function isLowCodePageModel(value: unknown): value is LowCodePageModel {
  return isRecord(value)
    && value.version === 1
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && isRecord(value.props)
    && isRecord(value.form)
    && Array.isArray(value.nodes)
    && value.nodes.every(isLowCodeNode)
}

function readPageModel(project: WorkspaceProject): { model: LowCodePageModel, migrated: boolean } {
  const source = readTextFile(project, project.manifest.designerArtifact)
  const input = JSON.parse(source) as unknown
  if (isLowCodePageModel(input)) {
    let model: LowCodePageModel = { ...structuredClone(input), nodes: [] }
    const modelRegistry = lowCodeRegistries[project.manifest.adapter]
    for (const node of input.nodes) {
      const inserted = applyModelOperation(model, {
        type: 'insert',
        node,
        target: { parentId: null },
      }, modelRegistry)
      if (!inserted.success)
        throw new Error(inserted.diagnostics[0]?.message ?? 'Config Model is invalid.')
      model = inserted.model
    }
    return { model, migrated: false }
  }
  const parsed = parseDesignerDocument(input)
  if (!parsed.success)
    throw new Error(parsed.diagnostics[0]?.message ?? 'Designer document is invalid.')
  return {
    model: designerDocumentToConfigModel(parsed.data, { id: project.id, name: project.name }),
    migrated: true,
  }
}

function createPreviewModel(document: DesignerDocument): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  const visit = (nodes: DesignerNode[]): void => {
    nodes.forEach((node) => {
      if (node.kind === 'field' && node.defaultValue !== undefined)
        values[node.field] = structuredClone(node.defaultValue)
      if (node.kind === 'container')
        Object.values(node.slots).forEach(visit)
    })
  }
  visit(document.nodes)
  return values
}

function mergePreviewModel(
  document: DesignerDocument,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const fields = new Set<string>()
  const visit = (nodes: DesignerNode[]): void => {
    nodes.forEach((node) => {
      if (node.kind === 'field')
        fields.add(node.field)
      else
        Object.values(node.slots).forEach(visit)
    })
  }
  visit(document.nodes)

  const next: Record<string, unknown> = {}
  fields.forEach((field) => {
    if (Object.hasOwn(previewModel.value, field))
      next[field] = structuredClone(previewModel.value[field])
    else if (Object.hasOwn(defaults, field))
      next[field] = structuredClone(defaults[field])
  })
  return next
}

function materializeModel(model: LowCodePageModel): void {
  const project = currentProject.value
  if (!project)
    return
  const document = configModelToDesignerDocument(model)
  const appSource = formatWorkspaceAppComponent(project.manifest.adapter)
  const configSource = formatLowCodePageConfig(model, lowCodeRegistry.value)
  const documentSource = `${JSON.stringify(model, null, 2)}\n`
  const filesChanged = readTextFile(project, project.manifest.designerArtifact) !== documentSource
    || readTextFile(project, SOURCE_PATH) !== appSource
    || readTextFile(project, CONFIG_PATH) !== configSource
  if (filesChanged) {
    let next = writeTextFile(
      project,
      project.manifest.designerArtifact,
      documentSource,
      'json',
    )
    next = writeTextFile(next, SOURCE_PATH, appSource, 'vue')
    next = writeTextFile(next, CONFIG_PATH, configSource, 'typescript')
    currentProject.value = next
  }
  previewModel.value = mergePreviewModel(document, createPreviewModel(document))
  rendererPreviewVersion.value += 1
  dirty.value = true
}

function commitModelHistory(result: ReturnType<typeof applyConfigModelOperation>): boolean {
  if (!result.changed) {
    configError.value = result.diagnostics[0]?.message ?? ''
    return false
  }
  configError.value = ''
  configHistory.value = result.history
  materializeModel(result.history.present)
  return true
}

function updateDesigner(command: DesignerCommand, document: DesignerDocument): boolean {
  const history = configHistory.value
  if (!history)
    return false
  try {
    const operation = designerCommandToModelOperation(command, document, history.present.props)
    return commitModelHistory(applyConfigModelOperation(history, operation, lowCodeRegistry.value))
  }
  catch (error) {
    configError.value = error instanceof Error ? error.message : String(error)
    dirty.value = true
    return false
  }
}

const designerCommandControl = { apply: updateDesigner }

function updateModelOperation(operation: ModelOperation): void {
  const history = configHistory.value
  if (history)
    commitModelHistory(applyConfigModelOperation(history, operation, lowCodeRegistry.value))
}

function handlePreviewRuntimeReady(revision: string): void {
  const projectId = currentProject.value?.id
  const expectedRevision = projectId ? `${projectId}-${rendererPreviewVersion.value}` : ''
  if (!projectId || revision !== expectedRevision || !activePreview.value)
    return
  lastRuntimePreview.value = { projectId, result: activePreview.value }
  fallbackPreviewModel.value = structuredClone(previewModel.value)
}

function undoDesign(): boolean {
  const history = configHistory.value
  return history ? commitModelHistory(undoConfigModelHistory(history, lowCodeRegistry.value)) : false
}

function redoDesign(): boolean {
  const history = configHistory.value
  return history ? commitModelHistory(redoConfigModelHistory(history, lowCodeRegistry.value)) : false
}

async function refreshProjects(): Promise<void> {
  const activeRepository = repository.value
  if (!activeRepository)
    return
  const nextProjects = await activeRepository.list()
  if (!disposed && repository.value === activeRepository)
    projects.value = nextProjects
}

async function openProject(id: string): Promise<void> {
  const requestId = ++openProjectRequestId
  const activeRepository = repository.value
  const storedProject = await activeRepository?.get(id)
  if (
    !storedProject
    || disposed
    || requestId !== openProjectRequestId
    || activeRepository !== repository.value
  ) {
    return
  }
  const upgraded = upgradeWorkspaceConfigModule(storedProject)
  const pageModel = readPageModel(upgraded.project)
  const artifactDocument = configModelToDesignerDocument(pageModel.model)
  const existingApp = readTextFile(upgraded.project, SOURCE_PATH)
  const existingConfig = readTextFile(upgraded.project, CONFIG_PATH)
  const generatedApp = formatWorkspaceAppComponent(upgraded.project.manifest.adapter)
  const generatedConfig = formatLowCodePageConfig(
    pageModel.model,
    lowCodeRegistries[upgraded.project.manifest.adapter],
  )
  lastValidPreview.value = undefined
  lastRuntimePreview.value = undefined
  let activeProject = existingApp === generatedApp && existingConfig === generatedConfig
    ? upgraded.project
    : writeTextFile(
        writeTextFile(upgraded.project, SOURCE_PATH, generatedApp, 'vue'),
        CONFIG_PATH,
        generatedConfig,
        'typescript',
      )
  if (pageModel.migrated) {
    activeProject = writeTextFile(
      activeProject,
      activeProject.manifest.designerArtifact,
      `${JSON.stringify(pageModel.model, null, 2)}\n`,
      'json',
    )
  }
  currentProject.value = activeProject
  configHistory.value = createConfigModelHistory(pageModel.model, { revision: upgraded.project.revision })
  rendererPreviewVersion.value += 1
  configError.value = ''
  dirty.value = upgraded.migrated
    || pageModel.migrated
    || existingApp !== generatedApp
    || existingConfig !== generatedConfig
  previewModel.value = createPreviewModel(artifactDocument)
  selectedDesignerIds.value = []
  templatePickerOpen.value = false
}

async function requestOpenProject(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement
  if (currentProject.value?.id === select.value)
    return
  if (hasUnsavedChanges.value) {
    message.value = 'Save or resolve the current draft before switching pages.'
    select.value = currentProject.value?.id ?? ''
    return
  }
  await openProject(select.value)
}

async function createProject(templateId: string): Promise<void> {
  if (!repository.value || busy.value)
    return
  busy.value = true
  message.value = ''
  try {
    const template = BUILT_IN_WORKSPACE_TEMPLATES.get(templateId)!
    const now = new Date().toISOString()
    const project = createBuiltInWorkspaceProject(templateId, {
      createdAt: now,
      id: `${templateId}-${Date.now().toString(36)}`,
      name: `${template.title} page`,
    })
    await repository.value.create(project)
    await refreshProjects()
    await openProject(project.id)
    templatePickerOpen.value = false
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    busy.value = false
  }
}

async function saveProject(): Promise<void> {
  const project = currentProject.value
  if (!project || !repository.value || configError.value || busy.value)
    return
  busy.value = true
  message.value = ''
  try {
    const committed = await repository.value.commit(project.id, project.revision, project)
    if (currentProject.value === project) {
      currentProject.value = committed
      dirty.value = false
    }
    else if (currentProject.value?.id === project.id) {
      currentProject.value = {
        ...currentProject.value,
        revision: committed.revision,
        updatedAt: committed.updatedAt,
      }
      dirty.value = true
    }
    await refreshProjects()
    message.value = dirty.value
      ? `Saved revision ${committed.revision}; newer edits remain unsaved`
      : `Saved revision ${committed.revision}`
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    busy.value = false
  }
}

async function exportProject(): Promise<void> {
  if (!currentProject.value)
    return
  try {
    const filename = await downloadProjectArchive(currentProject.value)
    message.value = `Downloaded ${filename}`
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  }
}

function openExportPreview(mode: 'source' | 'config'): void {
  exportMenuOpen.value = false
  exportPreviewMode.value = mode
  if (mode === 'config')
    configViewMode.value = 'json'
  else
    sourceViewPath.value = 'src/App.vue'
  exportPreviewReturnFocus.value = exportButtonRef.value
    ?? (document.activeElement instanceof HTMLElement ? document.activeElement : undefined)
  void nextTick(() => exportDialogRef.value?.querySelector<HTMLButtonElement>('button')?.focus())
}

function closeExportPreview(): void {
  exportPreviewMode.value = undefined
  void nextTick(() => exportPreviewReturnFocus.value?.focus())
}

function exportPreviewText(): string {
  return exportPreviewMode.value === 'source' ? sourceCode.value : generatedConfigJson.value
}

async function copyExportPreview(): Promise<void> {
  try {
    if (!navigator.clipboard)
      throw new Error('Clipboard API is unavailable.')
    await navigator.clipboard.writeText(exportPreviewText())
    message.value = 'Copied export to clipboard'
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : 'Unable to copy export.'
  }
}

function downloadExportPreview(): void {
  const mode = exportPreviewMode.value
  if (!mode)
    return
  const url = URL.createObjectURL(new Blob([exportPreviewText()], { type: mode === 'source' ? 'text/plain' : 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = mode === 'source' ? sourceViewPath.value.split('/').at(-1)! : 'page.config.json'
  anchor.click()
  URL.revokeObjectURL(url)
  message.value = `Downloaded ${mode === 'source' ? 'source' : 'config'} export`
}

function togglePreview(): void {
  previewOpen.value = !previewOpen.value
  if (!previewOpen.value)
    previewExpanded.value = false
  if (!previewOpen.value && mobileSurface.value === 'preview')
    mobileSurface.value = 'edit'
}

function showMobileSurface(surface: MobileSurface): void {
  mobileSurface.value = surface
  previewExpanded.value = false
  if (surface === 'preview')
    previewOpen.value = true
}

function selectDesignerLayer(nodeId: string, event: MouseEvent): void {
  const mode: DesignerSelectionMode = event.shiftKey
    ? 'range'
    : event.ctrlKey || event.metaKey ? 'toggle' : 'replace'
  designerRef.value?.select(nodeId, mode)
}

function moveDesignerLayer(
  action: 'moveBefore' | 'moveAfter' | 'indent' | 'outdent',
  nodeId: string,
): void {
  designerRef.value?.performNodeAction(action, nodeId)
}

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

async function selectPageFromDesigner(pageId: string): Promise<void> {
  if (pageId === currentProject.value?.id)
    return
  if (hasUnsavedChanges.value) {
    message.value = 'Save or resolve the current draft before switching pages.'
    return
  }
  await openProject(pageId)
}

function resolveKeyboardTab<T extends string>(
  event: KeyboardEvent,
  current: T,
  ids: readonly T[],
): T | undefined {
  const index = ids.indexOf(current)
  let nextIndex = index
  if (event.key === 'ArrowRight')
    nextIndex = (index + 1) % ids.length
  else if (event.key === 'ArrowLeft')
    nextIndex = (index - 1 + ids.length) % ids.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = ids.length - 1
  else
    return undefined
  event.preventDefault()
  return ids[nextIndex]
}

function handleMobileSurfaceTabKeydown(event: KeyboardEvent, surface: MobileSurface): void {
  const nextSurface = resolveKeyboardTab(event, surface, ['edit', 'preview'])
  if (!nextSurface)
    return
  showMobileSurface(nextSurface)
  void nextTick(() => mobileSurfaceTabsRef.value
    ?.querySelector<HTMLButtonElement>(`[data-mobile-surface-tab="${nextSurface}"]`)
    ?.focus())
}

function handleDesignerLeftTabKeydown(event: KeyboardEvent, view: DesignerLeftView): void {
  const nextView = resolveKeyboardTab(event, view, designerLeftViews.map(item => item.id))
  if (!nextView)
    return
  activeDesignerLeftView.value = nextView
  void nextTick(() => designerLeftTabsRef.value
    ?.querySelector<HTMLButtonElement>(`[data-designer-left-tab="${nextView}"]`)
    ?.focus())
}

function openTemplatePicker(): void {
  if (hasUnsavedChanges.value) {
    message.value = 'Save or resolve the current draft before creating another page.'
    return
  }
  templatePickerOpen.value = true
  void nextTick(() => templateDialogRef.value?.querySelector<HTMLButtonElement>('.template-list button')?.focus())
}

function closeTemplatePicker(): void {
  templatePickerOpen.value = false
  void nextTick(() => newPageButtonRef.value?.focus())
}

function handleDialogKeydown(event: KeyboardEvent, dialog: HTMLElement | null, close: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialog)
    return
  const focusable = [...dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )]
  if (focusable.length === 0)
    return
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleTemplateDialogKeydown(event: KeyboardEvent): void {
  handleDialogKeydown(event, templateDialogRef.value, closeTemplatePicker)
}

function handleExportDialogKeydown(event: KeyboardEvent): void {
  handleDialogKeydown(event, exportDialogRef.value, closeExportPreview)
}

onMounted(async () => {
  const openedRepository = await openDefaultWorkspaceProjectRepository()
  if (disposed) {
    openedRepository.close()
    return
  }
  repository.value = openedRepository
  await refreshProjects()
  if (disposed || repository.value !== openedRepository)
    return
  const first = projects.value[0]
  if (first)
    await openProject(first.id)
  else
    templatePickerOpen.value = true
})

onBeforeUnmount(() => {
  disposed = true
  openProjectRequestId += 1
  repository.value?.close()
})
</script>

<template>
  <main class="workbench-app" :data-theme="theme">
    <header class="workbench-topbar">
      <div class="brand-lockup">
        <span>ConfigForm</span>
        <strong>Workbench</strong>
      </div>

      <select
        v-if="currentProject"
        class="project-select"
        :value="currentProject.id"
        aria-label="Current page"
        @change="requestOpenProject"
      >
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>

      <div class="topbar-actions">
        <span v-if="currentProject" class="revision-state" :class="{ 'is-dirty': dirty }">
          r{{ currentProject.revision }} · {{ statusLabel }}
        </span>
        <button ref="newPageButton" type="button" title="New page" aria-label="New page" @click="openTemplatePicker">
          <Plus :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Save"
          aria-label="Save"
          :disabled="!dirty || !!configError || busy"
          @click="saveProject"
        >
          <Save :size="17" aria-hidden="true" />
        </button>
        <div v-if="currentProject" class="export-menu">
          <button
            ref="exportButton"
            type="button"
            title="Export"
            aria-label="Export"
            :aria-expanded="exportMenuOpen"
            aria-haspopup="menu"
            @click="exportMenuOpen = !exportMenuOpen"
          >
            <Download :size="16" aria-hidden="true" />
            <ChevronDown :size="13" aria-hidden="true" />
          </button>
          <div v-if="exportMenuOpen" class="export-menu-popover" role="menu">
            <button type="button" role="menuitem" @click="openExportPreview('source')">
              <Code2 :size="15" aria-hidden="true" />
              <span>导出源码</span>
            </button>
            <button type="button" role="menuitem" @click="openExportPreview('config')">
              <Braces :size="15" aria-hidden="true" />
              <span>导出配置</span>
            </button>
          </div>
        </div>
        <button type="button" :title="theme === 'dark' ? 'Use light theme' : 'Use dark theme'" :aria-label="theme === 'dark' ? 'Use light theme' : 'Use dark theme'" @click="toggleTheme">
          <Sun v-if="theme === 'dark'" :size="17" aria-hidden="true" />
          <Moon v-else :size="17" aria-hidden="true" />
        </button>
        <button
          v-if="currentProject"
          type="button"
          :title="previewOpen ? 'Hide preview' : 'Show preview'"
          :aria-label="previewOpen ? 'Hide preview' : 'Show preview'"
          @click="togglePreview"
        >
          <PanelRightClose v-if="previewOpen" :size="17" aria-hidden="true" />
          <PanelRightOpen v-else :size="17" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div v-if="currentProject" ref="mobileSurfaceTabs" class="mobile-surface-tabs" role="tablist" aria-label="Workspace surface">
      <button id="mobile-edit-tab" type="button" role="tab" aria-controls="workspace-panel" :aria-selected="mobileSurface === 'edit'" data-mobile-surface-tab="edit" :tabindex="mobileSurface === 'edit' ? 0 : -1" @click="showMobileSurface('edit')" @keydown="handleMobileSurfaceTabKeydown($event, 'edit')">
        Edit
      </button>
      <button id="mobile-preview-tab" type="button" role="tab" aria-controls="workspace-panel" :aria-selected="mobileSurface === 'preview'" data-mobile-surface-tab="preview" :tabindex="mobileSurface === 'preview' ? 0 : -1" @click="showMobileSurface('preview')" @keydown="handleMobileSurfaceTabKeydown($event, 'preview')">
        Preview
      </button>
    </div>

    <section
      v-if="currentProject"
      id="workspace-panel"
      class="workbench-layout"
      role="tabpanel"
      :aria-labelledby="mobileSurface === 'edit' ? 'mobile-edit-tab' : 'mobile-preview-tab'"
      :class="{
        'is-preview-collapsed': !previewOpen,
        'is-preview-expanded': previewExpanded,
        'show-mobile-preview': mobileSurface === 'preview',
      }"
    >
      <section
        id="page-editor-panel"
        class="editor-pane"
        :aria-hidden="previewExpanded ? 'true' : undefined"
        aria-label="Design editor"
        :inert="previewExpanded ? true : undefined"
      >
        <header class="pane-header design-pane-header">
          <div class="editor-file-meta">
            <Blocks :size="14" aria-hidden="true" />
            <span>Design canvas</span>
            <small>DESIGN</small>
          </div>
        </header>

        <div class="provider-surface">
          <ConfigFormDesigner
            v-if="designerDocument"
            ref="designer"
            :key="currentProject.manifest.adapter"
            class="embedded-designer"
            :document="designerDocument"
            :model="configModel"
            :model-registry="lowCodeRegistry"
            :command-control="designerCommandControl"
            :history-control="designerHistoryControl"
            :readonly="busy"
            :registry="registry"
            @selection-set-change="selectedDesignerIds = $event"
            @model-operation="updateModelOperation"
          >
            <template #toolbar="{ breakpoint, canUndo, canRedo, canEditSelection, copySelection, removeSelection, selectBreakpoint, undo, redo }">
              <div class="mx-config-form-designer__toolbar-actions" role="toolbar" aria-label="Designer commands">
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canUndo" title="Undo" aria-label="Undo" @click="undo">
                  <Undo2 :size="17" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canRedo" title="Redo" aria-label="Redo" @click="redo">
                  <Redo2 :size="17" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <button type="button" class="mx-config-form-designer__icon-button" :disabled="!canEditSelection" title="Copy selection" aria-label="Copy selection" @click="copySelection">
                  <Copy :size="16" aria-hidden="true" />
                </button>
                <button type="button" class="mx-config-form-designer__icon-button is-danger" :disabled="!canEditSelection" title="Delete selection" aria-label="Delete selection" @click="removeSelection">
                  <Trash2 :size="16" aria-hidden="true" />
                </button>
                <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
                <div class="mx-config-form-designer__segmented" role="group" aria-label="Canvas viewport">
                  <button type="button" :class="{ 'is-active': breakpoint === 'desktop' }" :aria-pressed="breakpoint === 'desktop'" title="Desktop" aria-label="Desktop" @click="selectBreakpoint('desktop')">
                    <Monitor :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'tablet' }" :aria-pressed="breakpoint === 'tablet'" title="Tablet" aria-label="Tablet" @click="selectBreakpoint('tablet')">
                    <Tablet :size="15" aria-hidden="true" />
                  </button>
                  <button type="button" :class="{ 'is-active': breakpoint === 'mobile' }" :aria-pressed="breakpoint === 'mobile'" title="Mobile" aria-label="Mobile" @click="selectBreakpoint('mobile')">
                    <Smartphone :size="15" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </template>

            <template #palette="{ materials, addMaterial, readonly }">
              <div class="designer-left-panel">
                <nav ref="designerLeftTabs" class="designer-left-tabs" role="tablist" aria-label="Designer navigation">
                  <button
                    v-for="view in designerLeftViews"
                    :key="view.id"
                    type="button"
                    role="tab"
                    :aria-selected="activeDesignerLeftView === view.id"
                    :data-designer-left-tab="view.id"
                    :tabindex="activeDesignerLeftView === view.id ? 0 : -1"
                    :title="view.label"
                    @click="activeDesignerLeftView = view.id"
                    @keydown="handleDesignerLeftTabKeydown($event, view.id)"
                  >
                    <component :is="view.icon" :size="14" aria-hidden="true" />
                    <span>{{ view.label }}</span>
                  </button>
                </nav>

                <DesignerPalette
                  v-if="activeDesignerLeftView === 'components'"
                  :materials="materials"
                  :registry="registry"
                  :readonly="readonly"
                  @add-material="addMaterial"
                />

                <div v-else-if="activeDesignerLeftView === 'layers'" class="designer-layers" role="tree" aria-label="Page layers">
                  <div
                    v-for="layer in designerLayers"
                    :key="layer.id"
                    role="treeitem"
                    :aria-selected="selectedDesignerIds.includes(layer.id)"
                    :class="{ 'is-selected': selectedDesignerIds.includes(layer.id) }"
                  >
                    <button type="button" class="designer-layer-select" :style="{ paddingLeft: `${10 + layer.depth * 16}px` }" @click="selectDesignerLayer(layer.id, $event)">
                      <Layers3 :size="13" aria-hidden="true" />
                      <span>{{ layer.label }}</span>
                      <small>{{ layer.component }}</small>
                    </button>
                    <div class="designer-layer-actions" role="toolbar" :aria-label="`Arrange ${layer.label}`">
                      <button type="button" title="Move up" aria-label="Move up" @click="moveDesignerLayer('moveBefore', layer.id)"><ChevronUp :size="12" aria-hidden="true" /></button>
                      <button type="button" title="Move down" aria-label="Move down" @click="moveDesignerLayer('moveAfter', layer.id)"><MoveDown :size="12" aria-hidden="true" /></button>
                      <button type="button" title="Indent" aria-label="Indent" @click="moveDesignerLayer('indent', layer.id)"><IndentIncrease :size="12" aria-hidden="true" /></button>
                      <button type="button" title="Outdent" aria-label="Outdent" @click="moveDesignerLayer('outdent', layer.id)"><IndentDecrease :size="12" aria-hidden="true" /></button>
                    </div>
                  </div>
                  <p v-if="designerLayers.length === 0">No layers yet</p>
                </div>

                <nav v-else class="designer-pages" aria-label="Workspace pages">
                  <button
                    v-for="page in projects"
                    :key="page.id"
                    type="button"
                    :aria-current="page.id === currentProject.id ? 'page' : undefined"
                    :class="{ 'is-current': page.id === currentProject.id }"
                    @click="selectPageFromDesigner(page.id)"
                  >
                    <Files :size="14" aria-hidden="true" />
                    <span>{{ page.name }}</span>
                    <small>r{{ page.revision }}</small>
                  </button>
                </nav>
              </div>
            </template>
          </ConfigFormDesigner>
        </div>
      </section>

      <aside v-if="previewOpen" class="preview-pane" aria-label="Page preview">
        <header class="pane-header">
          <div class="preview-heading">
            <strong>Preview</strong>
            <span class="preview-live-state" :data-tone="previewState.tone" role="status" aria-live="polite">
              <span aria-hidden="true" />
              {{ previewState.label }}
            </span>
          </div>
          <div class="preview-toolbar">
            <div class="preview-viewport-switch" role="group" aria-label="Preview viewport">
              <button
                v-for="viewport in previewViewports"
                :key="viewport.id"
                type="button"
                :aria-label="viewport.label"
                :aria-pressed="previewViewport === viewport.id"
                :title="viewport.label"
                @click="previewViewport = viewport.id"
              >
                <component :is="viewport.icon" :size="15" aria-hidden="true" />
              </button>
            </div>
            <button
              class="preview-expand-button"
              type="button"
              :title="previewExpanded ? 'Restore preview' : 'Expand preview'"
              :aria-label="previewExpanded ? 'Restore preview' : 'Expand preview'"
              @click="previewExpanded = !previewExpanded"
            >
              <Minimize2 v-if="previewExpanded" :size="16" aria-hidden="true" />
              <Maximize2 v-else :size="16" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div class="preview-canvas">
          <div class="preview-stage" :data-viewport="previewViewport">
            <div
              v-if="activePreview && (configError || !compiledPreview?.success)"
              class="preview-diagnostics"
              role="status"
            >
              <strong>Showing last valid preview</strong>
              <p v-if="configError">{{ configError }}</p>
              <p v-for="diagnostic in compiledPreview?.success === false ? compiledPreview.diagnostics : []" :key="`${diagnostic.code}-${diagnostic.path.join('.')}`">
                {{ diagnostic.message }}
              </p>
            </div>
            <PreviewRuntimeBoundary
              v-if="activePreview"
              :revision="`${currentProject.id}-${rendererPreviewVersion}`"
              @ready="handlePreviewRuntimeReady"
            >
              <ConfigFormRenderer
                :key="`${currentProject.id}-${rendererPreviewVersion}`"
                v-model="previewModel"
                class="page-preview-form"
                :namespace="registry.rendererNamespace"
                v-bind="activePreview.renderer"
              />
              <template #fallback>
                <ConfigFormRenderer
                  v-if="runtimeFallbackPreview"
                  v-model="fallbackPreviewModel"
                  class="page-preview-form"
                  :namespace="registry.rendererNamespace"
                  v-bind="runtimeFallbackPreview.renderer"
                />
              </template>
            </PreviewRuntimeBoundary>
            <div v-else class="preview-errors">
              <strong>Preview unavailable</strong>
              <p v-for="diagnostic in compiledPreview?.diagnostics ?? []" :key="`${diagnostic.code}-${diagnostic.path.join('.')}`">
                {{ diagnostic.message }}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </section>

    <section v-else class="empty-workbench" aria-labelledby="new-page-title">
      <h1 id="new-page-title">
        New page
      </h1>
      <div class="template-list">
        <button
          v-for="template in BUILT_IN_WORKSPACE_TEMPLATES.values()"
          :key="template.id"
          type="button"
          :disabled="busy"
          @click="createProject(template.id)"
        >
          <strong>{{ template.title }}</strong>
          <span>{{ template.adapter }}</span>
        </button>
      </div>
    </section>

    <div v-if="templatePickerOpen && currentProject" class="template-overlay" @click.self="closeTemplatePicker">
      <section ref="templateDialog" role="dialog" aria-modal="true" aria-labelledby="template-dialog-title" @keydown="handleTemplateDialogKeydown">
        <header>
          <h2 id="template-dialog-title">
            New page
          </h2>
          <button type="button" @click="closeTemplatePicker">
            Close
          </button>
        </header>
        <div class="template-list">
          <button
            v-for="template in BUILT_IN_WORKSPACE_TEMPLATES.values()"
            :key="template.id"
            type="button"
            :disabled="busy"
            @click="createProject(template.id)"
          >
            <strong>{{ template.title }}</strong>
            <span>{{ template.adapter }}</span>
          </button>
        </div>
      </section>
    </div>

    <div v-if="exportPreviewMode" class="export-preview-overlay" @click.self="closeExportPreview">
      <section ref="exportDialog" class="export-preview-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${exportPreviewMode}-export-title`" @keydown="handleExportDialogKeydown">
        <header>
          <div>
            <span class="dialog-eyebrow">Read only export</span>
            <h2 :id="`${exportPreviewMode}-export-title`">{{ exportPreviewMode === 'source' ? 'Generated Vue source' : 'Config model' }}</h2>
          </div>
          <button type="button" title="Close" aria-label="Close" @click="closeExportPreview">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <div class="export-preview-body">
          <div v-if="exportPreviewMode === 'source'" class="source-export-view">
            <nav class="source-file-tabs" role="tablist" aria-label="Generated source files">
              <button v-for="path in sourcePaths" :key="path" type="button" role="tab" :aria-selected="sourceViewPath === path" @click="sourceViewPath = path">{{ path }}</button>
            </nav>
            <WorkspaceCodeEditor
              :filename="sourceViewPath"
              :language="sourceLanguage"
              :model-value="sourceCode"
              :readonly="true"
              :theme="theme"
            />
          </div>
          <template v-else>
            <nav class="config-view-tabs" role="tablist" aria-label="Config view">
              <button type="button" role="tab" :aria-selected="configViewMode === 'json'" @click="configViewMode = 'json'">JSON</button>
              <button type="button" role="tab" :aria-selected="configViewMode === 'tree'" @click="configViewMode = 'tree'">Tree</button>
            </nav>
            <pre v-if="configViewMode === 'json'" class="config-json-view" tabindex="0">{{ generatedConfigJson }}</pre>
            <div v-else class="config-tree-view" role="tree" tabindex="0">
              <div
                v-for="entry in generatedConfigTree"
                :key="entry.path"
                role="treeitem"
                :style="{ paddingLeft: `${12 + entry.depth * 18}px` }"
              >
                <span class="config-tree-key">{{ entry.path.split('.').at(-1) }}</span>
                <span class="config-tree-value" :class="{ 'is-branch': entry.branch }">{{ entry.value }}</span>
              </div>
            </div>
          </template>
        </div>
        <footer>
          <span>Model revision {{ modelRevision }} · Generated from Design Model</span>
          <div>
            <button v-if="exportPreviewMode === 'source'" type="button" class="dialog-action secondary" @click="exportProject">
              <Download :size="15" aria-hidden="true" /> Project ZIP
            </button>
            <button type="button" class="dialog-action secondary" @click="copyExportPreview">
              <Clipboard :size="15" aria-hidden="true" /> Copy
            </button>
            <button type="button" class="dialog-action" @click="downloadExportPreview">
              <Download :size="15" aria-hidden="true" /> Download
            </button>
          </div>
        </footer>
      </section>
    </div>

    <p v-if="message" class="workbench-message" aria-live="polite">
      {{ message }}
    </p>
  </main>
</template>
