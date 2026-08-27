<script setup lang="ts">
import type {
  DesignerDocument,
  DesignerNode,
  DesignerRegistry,
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
  Code2,
  Download,
  FileCode2,
  Maximize2,
  Minimize2,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Tablet,
} from '@lucide/vue'
import {
  compileDesignerDocument,
  ConfigFormDesigner,
  parseDesignerDocument,
} from '@moluoxixi/config-form-designer'
import { createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import {
  BUILT_IN_WORKSPACE_TEMPLATES,
  cloneWorkspaceProject,
  createBuiltInWorkspaceProject,
  downloadProjectArchive,
  normalizeProjectPath,
  openDefaultWorkspaceProjectRepository,
  upgradeWorkspaceConfigModule,
  WORKSPACE_CONFIG_MODULE_PATH,
} from './project'
import { formatDesignerConfig, parseDesignerConfig } from './workbench/config-codec'

const WorkspaceCodeEditor = defineAsyncComponent(() => import('./components/WorkspaceCodeEditor.vue'))
const WorkspaceSourcePreview = defineAsyncComponent(() => import('./components/WorkspaceSourcePreview.vue'))

type Provider = 'config' | 'designer' | 'source'
type MobileSurface = 'edit' | 'preview'
type PreviewViewport = 'desktop' | 'tablet' | 'mobile'
type SourcePreviewPhase = 'error' | 'loading' | 'ready'

interface SourcePreviewRun {
  id: number
  project: WorkspaceProject
}

interface SourcePreviewStatus {
  message?: string
  phase: SourcePreviewPhase
}

const SOURCE_PATH = normalizeProjectPath('src/App.vue')
const CONFIG_PATH = WORKSPACE_CONFIG_MODULE_PATH
const providers = [
  { icon: Code2, id: 'source' as const, label: 'Source' },
  { icon: Braces, id: 'config' as const, label: 'Config' },
  { icon: Blocks, id: 'designer' as const, label: 'Designer' },
]
const previewViewports = [
  { icon: Monitor, id: 'desktop' as const, label: 'Desktop preview' },
  { icon: Tablet, id: 'tablet' as const, label: 'Tablet preview' },
  { icon: Smartphone, id: 'mobile' as const, label: 'Mobile preview' },
]
const registries: Record<WorkspaceProject['manifest']['adapter'], DesignerRegistry> = {
  'antd-vue': createAntdVueDesignerRegistry(),
  'element-plus': createElementPlusDesignerRegistry(),
}

const repository = shallowRef<WorkspaceProjectRepository>()
const projects = ref<WorkspaceProjectSummary[]>([])
const currentProject = shallowRef<WorkspaceProject>()
const designerDocument = shallowRef<DesignerDocument>()
const configDraft = ref('')
const configError = ref('')
const sourceError = ref('')
const activeProvider = ref<Provider>('source')
const mobileSurface = ref<MobileSurface>('edit')
const previewOpen = ref(true)
const previewExpanded = ref(false)
const previewViewport = ref<PreviewViewport>('desktop')
const previewModel = ref<Record<string, unknown>>({})
const rendererPreviewVersion = ref(0)
const dirty = ref(false)
const templatePickerOpen = ref(false)
const busy = ref(false)
const message = ref('')
const sourcePreviewRuns = shallowRef<SourcePreviewRun[]>([])
const activeSourcePreviewRunId = ref<number>()
const pendingSourcePreviewRunId = ref<number>()
const sourcePreviewScheduled = ref(false)
const sourcePreviewError = ref('')
const newPageButtonRef = useTemplateRef<HTMLButtonElement>('newPageButton')
const templateDialogRef = useTemplateRef<HTMLElement>('templateDialog')
const providerTabsRef = useTemplateRef<HTMLElement>('providerTabs')
const mobileSurfaceTabsRef = useTemplateRef<HTMLElement>('mobileSurfaceTabs')
let sourcePreviewTimer: number | undefined
let sourcePreviewSequence = 0
let openProjectRequestId = 0
let disposed = false

const registry = computed(() => currentProject.value
  ? registries[currentProject.value.manifest.adapter]
  : registries['element-plus'])
const sourceCode = computed(() => readTextFile(currentProject.value, SOURCE_PATH))
const compiledPreview = computed(() => designerDocument.value
  ? compileDesignerDocument(designerDocument.value, registry.value)
  : undefined)
const sourcePreviewUpdating = computed(() => sourcePreviewScheduled.value || pendingSourcePreviewRunId.value !== undefined)
const previewState = computed(() => {
  if (activeProvider.value === 'source') {
    if (sourceError.value || sourcePreviewError.value)
      return { label: 'Last valid', tone: 'error' as const }
    if (sourcePreviewUpdating.value)
      return { label: 'Updating', tone: 'busy' as const }
    return { label: dirty.value ? 'Live draft' : 'Live', tone: 'live' as const }
  }
  if (configError.value)
    return { label: 'Last valid', tone: 'error' as const }
  if (!compiledPreview.value?.success)
    return { label: 'Blocked', tone: 'error' as const }
  return { label: dirty.value ? 'Live draft' : 'Live', tone: 'live' as const }
})
const hasUnsavedChanges = computed(() => dirty.value || !!configError.value || !!sourceError.value || !!sourcePreviewError.value)
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

function readDesignerDocument(project: WorkspaceProject): DesignerDocument {
  const source = readTextFile(project, project.manifest.designerArtifact)
  const input = JSON.parse(source) as unknown
  const parsed = parseDesignerDocument(input)
  if (!parsed.success)
    throw new Error(parsed.diagnostics[0]?.message ?? 'Designer document is invalid.')
  return parsed.data
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

function refreshSourcePreview(project = currentProject.value): void {
  if (!project)
    return
  const run: SourcePreviewRun = {
    id: ++sourcePreviewSequence,
    project: cloneWorkspaceProject(project),
  }
  const activeRun = sourcePreviewRuns.value.find(item => item.id === activeSourcePreviewRunId.value)
  sourcePreviewRuns.value = activeRun ? [activeRun, run] : [run]
  pendingSourcePreviewRunId.value = run.id
  sourcePreviewScheduled.value = false
  sourcePreviewError.value = ''
}

function scheduleSourcePreview(): void {
  window.clearTimeout(sourcePreviewTimer)
  const projectId = currentProject.value?.id
  sourcePreviewScheduled.value = true
  sourcePreviewTimer = window.setTimeout(() => {
    if (currentProject.value?.id !== projectId)
      return
    refreshSourcePreview()
  }, 350)
}

function handleSourcePreviewStatus(runId: number, status: SourcePreviewStatus): void {
  if (runId !== pendingSourcePreviewRunId.value)
    return
  if (status.phase === 'loading')
    return
  pendingSourcePreviewRunId.value = undefined
  if (status.phase === 'ready') {
    activeSourcePreviewRunId.value = runId
    sourcePreviewRuns.value = sourcePreviewRuns.value.filter(run => run.id === runId)
    sourcePreviewError.value = ''
    return
  }
  sourcePreviewError.value = status.message ?? 'The page could not be compiled.'
  if (activeSourcePreviewRunId.value !== undefined) {
    sourcePreviewRuns.value = sourcePreviewRuns.value.filter(
      run => run.id === activeSourcePreviewRunId.value,
    )
  }
}

function synchronizeDocument(
  document: DesignerDocument,
  configSource = formatDesignerConfig(document),
  previewValues = createPreviewModel(document),
): void {
  const project = currentProject.value
  if (!project)
    return
  const documentSource = `${JSON.stringify(document, null, 2)}\n`
  if (
    readTextFile(project, project.manifest.designerArtifact) === documentSource
    && readTextFile(project, CONFIG_PATH) === configSource
  ) {
    return
  }
  let next = writeTextFile(
    project,
    project.manifest.designerArtifact,
    documentSource,
    'json',
  )
  next = writeTextFile(next, CONFIG_PATH, configSource, 'typescript')
  currentProject.value = next
  designerDocument.value = structuredClone(document)
  configDraft.value = configSource
  previewModel.value = mergePreviewModel(document, previewValues)
  rendererPreviewVersion.value += 1
  scheduleSourcePreview()
  dirty.value = true
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
  window.clearTimeout(sourcePreviewTimer)
  sourcePreviewScheduled.value = false
  sourcePreviewRuns.value = []
  activeSourcePreviewRunId.value = undefined
  pendingSourcePreviewRunId.value = undefined
  sourcePreviewError.value = ''
  const upgraded = upgradeWorkspaceConfigModule(storedProject)
  const artifactDocument = readDesignerDocument(upgraded.project)
  const existingConfig = readTextFile(upgraded.project, CONFIG_PATH)
  const parsedConfig = existingConfig
    ? parseDesignerConfig(existingConfig, upgraded.project.manifest.adapter)
    : undefined
  const activeDocument = parsedConfig?.success ? parsedConfig.document : artifactDocument
  configDraft.value = parsedConfig?.success ? existingConfig : formatDesignerConfig(activeDocument)
  currentProject.value = existingConfig === configDraft.value
    ? upgraded.project
    : writeTextFile(upgraded.project, CONFIG_PATH, configDraft.value, 'typescript')
  designerDocument.value = activeDocument
  rendererPreviewVersion.value += 1
  configError.value = ''
  sourceError.value = ''
  dirty.value = upgraded.migrated || existingConfig !== configDraft.value
  previewModel.value = parsedConfig?.success
    ? structuredClone(parsedConfig.initialValues)
    : createPreviewModel(activeDocument)
  refreshSourcePreview()
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

function updateSource(value: string): void {
  if (!currentProject.value || readTextFile(currentProject.value, SOURCE_PATH) === value)
    return
  currentProject.value = writeTextFile(currentProject.value, SOURCE_PATH, value, 'vue')
  dirty.value = true
  const parsed = parseSfc(value, { filename: SOURCE_PATH })
  if (parsed.errors.length > 0) {
    window.clearTimeout(sourcePreviewTimer)
    sourcePreviewScheduled.value = false
    const error = parsed.errors[0]
    sourceError.value = error instanceof Error ? error.message : String(error)
    return
  }
  sourceError.value = ''
  scheduleSourcePreview()
}

function retrySourcePreview(): void {
  window.clearTimeout(sourcePreviewTimer)
  refreshSourcePreview()
}

function updateConfig(value: string): void {
  const project = currentProject.value
  if (!project || configDraft.value === value)
    return
  configDraft.value = value
  const parsed = parseDesignerConfig(value, project.manifest.adapter)
  if (!parsed.success) {
    configError.value = parsed.message
    dirty.value = true
    return
  }
  configError.value = ''
  synchronizeDocument(parsed.document, value, parsed.initialValues)
}

function updateDesigner(document: DesignerDocument): void {
  try {
    configError.value = ''
    synchronizeDocument(document)
  }
  catch (error) {
    configError.value = error instanceof Error ? error.message : String(error)
    dirty.value = true
  }
}

async function saveProject(): Promise<void> {
  const project = currentProject.value
  if (!project || !repository.value || configError.value || sourceError.value || sourcePreviewError.value || busy.value)
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
  if (!currentProject.value || hasUnsavedChanges.value)
    return
  try {
    const filename = await downloadProjectArchive(currentProject.value)
    message.value = `Downloaded ${filename}`
  }
  catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  }
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

function selectProvider(provider: Provider): void {
  activeProvider.value = provider
  mobileSurface.value = 'edit'
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

function handleProviderTabKeydown(event: KeyboardEvent, provider: Provider): void {
  const nextProvider = resolveKeyboardTab(event, provider, providers.map(item => item.id))
  if (!nextProvider)
    return
  selectProvider(nextProvider)
  void nextTick(() => providerTabsRef.value
    ?.querySelector<HTMLButtonElement>(`[data-provider-tab="${nextProvider}"]`)
    ?.focus())
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

function handleTemplateDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeTemplatePicker()
    return
  }
  if (event.key !== 'Tab' || !templateDialogRef.value)
    return
  const focusable = [...templateDialogRef.value.querySelectorAll<HTMLElement>('button:not([disabled])')]
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
  window.clearTimeout(sourcePreviewTimer)
  repository.value?.close()
})
</script>

<template>
  <main class="workbench-app">
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

      <nav v-if="currentProject" ref="providerTabs" class="provider-tabs" aria-label="Page provider" role="tablist">
        <button
          v-for="provider in providers"
          :key="provider.id"
          type="button"
          role="tab"
          :aria-selected="activeProvider === provider.id"
          aria-controls="page-editor-panel"
          :data-provider-tab="provider.id"
          :tabindex="activeProvider === provider.id ? 0 : -1"
          @click="selectProvider(provider.id)"
          @keydown="handleProviderTabKeydown($event, provider.id)"
        >
          <component :is="provider.icon" :size="15" aria-hidden="true" />
          {{ provider.label }}
        </button>
      </nav>

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
          :disabled="!dirty || !!configError || !!sourceError || !!sourcePreviewError || busy"
          @click="saveProject"
        >
          <Save :size="17" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Download ZIP"
          aria-label="Download ZIP"
          :disabled="!currentProject || hasUnsavedChanges"
          @click="exportProject"
        >
          <Download :size="17" aria-hidden="true" />
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
        :aria-label="`${activeProvider} editor`"
        :inert="previewExpanded ? true : undefined"
      >
        <header class="pane-header">
          <div class="editor-file-meta">
            <FileCode2 :size="14" aria-hidden="true" />
            <span v-if="activeProvider === 'source'">src/App.vue</span>
            <span v-else-if="activeProvider === 'config'">src/form.config.ts</span>
            <span v-else>Visual designer</span>
            <small>{{ activeProvider === 'source' ? 'VUE' : activeProvider === 'config' ? 'TS' : 'VISUAL' }}</small>
          </div>
          <span v-if="activeProvider === 'source' && sourceError" class="pane-error">{{ sourceError }}</span>
          <span v-else-if="activeProvider === 'config' && configError" class="pane-error">{{ configError }}</span>
        </header>

        <div class="provider-surface">
          <WorkspaceCodeEditor
            v-if="activeProvider !== 'designer'"
            :filename="activeProvider === 'source' ? 'src/App.vue' : 'src/form.config.ts'"
            :language="activeProvider === 'source' ? 'vue' : 'typescript'"
            :module-names="currentProject ? Object.keys(currentProject.manifest.dependencies) : undefined"
            :model-value="activeProvider === 'source' ? sourceCode : configDraft"
            :readonly="busy"
            @save="saveProject"
            @update:model-value="activeProvider === 'source' ? updateSource($event) : updateConfig($event)"
          />
          <ConfigFormDesigner
            v-else-if="designerDocument"
            :key="currentProject.manifest.adapter"
            class="embedded-designer"
            :document="designerDocument"
            :readonly="busy"
            :registry="registry"
            @update:document="updateDesigner"
          />
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
              v-if="activeProvider === 'source'"
              type="button"
              title="Refresh preview"
              aria-label="Refresh preview"
              :disabled="sourcePreviewUpdating || !!sourceError"
              @click="retrySourcePreview"
            >
              <RefreshCw :size="15" :class="{ 'is-spinning': sourcePreviewUpdating }" aria-hidden="true" />
            </button>
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
        <div class="preview-canvas" :class="{ 'is-source': activeProvider === 'source' }">
          <div class="preview-stage" :data-viewport="previewViewport">
            <template v-if="activeProvider === 'source'">
              <WorkspaceSourcePreview
                v-for="run in sourcePreviewRuns"
                :key="run.id"
                class="source-preview-run"
                :class="{
                  'is-active': run.id === activeSourcePreviewRunId || activeSourcePreviewRunId === undefined,
                }"
                :project="run.project"
                @retry="retrySourcePreview"
                @status="handleSourcePreviewStatus(run.id, $event)"
              />
              <div
                v-if="(sourceError || sourcePreviewError) && activeSourcePreviewRunId !== undefined"
                class="source-preview-stale-notice"
                role="alert"
              >
                <div>
                  <strong>Showing the last valid page</strong>
                  <span>{{ sourceError || sourcePreviewError }}</span>
                </div>
                <button type="button" :disabled="Boolean(sourceError)" @click="retrySourcePreview">
                  <RefreshCw :size="14" aria-hidden="true" />
                  Retry
                </button>
              </div>
            </template>
            <ConfigFormRenderer
              v-else-if="compiledPreview?.success"
              :key="`${currentProject.id}-${rendererPreviewVersion}`"
              v-model="previewModel"
              class="page-preview-form"
              :namespace="registry.rendererNamespace"
              v-bind="compiledPreview.renderer"
            />
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

    <p v-if="message" class="workbench-message" aria-live="polite">
      {{ message }}
    </p>
  </main>
</template>
