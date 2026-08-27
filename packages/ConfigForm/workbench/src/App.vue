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
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import {
  compileDesignerDocument,
  ConfigFormDesigner,
  parseDesignerDocument,
} from '@moluoxixi/config-form-designer'
import { createAntdVueDesignerRegistry } from '@moluoxixi/config-form-designer-antd-vue'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { parse as parseSfc } from '@vue/compiler-sfc'
import {
  Blocks,
  Braces,
  Code2,
  Download,
  FileCode2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
} from '@lucide/vue'
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

const SOURCE_PATH = normalizeProjectPath('src/App.vue')
const CONFIG_PATH = WORKSPACE_CONFIG_MODULE_PATH
const providers = [
  { icon: Code2, id: 'source' as const, label: 'Source' },
  { icon: Braces, id: 'config' as const, label: 'Config' },
  { icon: Blocks, id: 'designer' as const, label: 'Designer' },
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
const previewModel = ref<Record<string, unknown>>({})
const dirty = ref(false)
const templatePickerOpen = ref(false)
const busy = ref(false)
const message = ref('')
const sourcePreviewVersion = ref(0)
const sourcePreviewProject = shallowRef<WorkspaceProject>()
const newPageButtonRef = useTemplateRef<HTMLButtonElement>('newPageButton')
const templateDialogRef = useTemplateRef<HTMLElement>('templateDialog')
let sourcePreviewTimer: number | undefined

const registry = computed(() => currentProject.value
  ? registries[currentProject.value.manifest.adapter]
  : registries['element-plus'])
const sourceCode = computed(() => readTextFile(currentProject.value, SOURCE_PATH))
const compiledPreview = computed(() => designerDocument.value
  ? compileDesignerDocument(designerDocument.value, registry.value)
  : undefined)
const hasUnsavedChanges = computed(() => dirty.value || !!configError.value || !!sourceError.value)
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

function refreshSourcePreview(): void {
  if (!currentProject.value)
    return
  sourcePreviewProject.value = cloneWorkspaceProject(currentProject.value)
  sourcePreviewVersion.value += 1
}

function scheduleSourcePreview(): void {
  window.clearTimeout(sourcePreviewTimer)
  sourcePreviewTimer = window.setTimeout(refreshSourcePreview, 500)
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
  previewModel.value = structuredClone(previewValues)
  scheduleSourcePreview()
  dirty.value = true
}

async function refreshProjects(): Promise<void> {
  projects.value = await repository.value?.list() ?? []
}

async function openProject(id: string): Promise<void> {
  const storedProject = await repository.value?.get(id)
  if (!storedProject)
    return
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
  if (!repository.value)
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
    const error = parsed.errors[0]
    sourceError.value = error instanceof Error ? error.message : String(error)
    return
  }
  sourceError.value = ''
  scheduleSourcePreview()
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
  if (!project || !repository.value || configError.value || sourceError.value)
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
  repository.value = await openDefaultWorkspaceProjectRepository()
  await refreshProjects()
  const first = projects.value[0]
  if (first)
    await openProject(first.id)
  else
    templatePickerOpen.value = true
})

onBeforeUnmount(() => {
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

      <nav v-if="currentProject" class="provider-tabs" aria-label="Page provider" role="tablist">
        <button
          v-for="provider in providers"
          :key="provider.id"
          type="button"
          role="tab"
          :aria-pressed="activeProvider === provider.id"
          :aria-selected="activeProvider === provider.id"
          aria-controls="page-editor-panel"
          @click="activeProvider = provider.id; mobileSurface = 'edit'"
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
          :disabled="!dirty || !!configError || !!sourceError || busy"
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

    <div v-if="currentProject" class="mobile-surface-tabs" role="tablist" aria-label="Workspace surface">
      <button id="mobile-edit-tab" type="button" role="tab" aria-controls="workspace-panel" :aria-selected="mobileSurface === 'edit'" @click="showMobileSurface('edit')">Edit</button>
      <button id="mobile-preview-tab" type="button" role="tab" aria-controls="workspace-panel" :aria-selected="mobileSurface === 'preview'" @click="showMobileSurface('preview')">Preview</button>
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
      <section id="page-editor-panel" class="editor-pane" :aria-label="`${activeProvider} editor`">
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
          <div>
            <strong>Preview</strong>
            <span v-if="activeProvider === 'source' && sourceError">Source draft invalid</span>
            <span v-else-if="configError">Config draft invalid</span>
            <span v-else-if="dirty">Unsaved changes</span>
          </div>
          <button
            type="button"
            :title="previewExpanded ? 'Restore preview' : 'Expand preview'"
            :aria-label="previewExpanded ? 'Restore preview' : 'Expand preview'"
            @click="previewExpanded = !previewExpanded"
          >
            <Minimize2 v-if="previewExpanded" :size="16" aria-hidden="true" />
            <Maximize2 v-else :size="16" aria-hidden="true" />
          </button>
        </header>
        <div class="preview-canvas" :class="{ 'is-source': activeProvider === 'source' }">
          <WorkspaceSourcePreview
            v-if="activeProvider === 'source' && sourcePreviewProject"
            :key="`${sourcePreviewProject.id}-${sourcePreviewVersion}`"
            :project="sourcePreviewProject"
          />
          <ConfigFormRenderer
            v-else-if="compiledPreview?.success"
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
      </aside>
    </section>

    <section v-else class="empty-workbench" aria-labelledby="new-page-title">
      <h1 id="new-page-title">New page</h1>
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
          <h2 id="template-dialog-title">New page</h2>
          <button type="button" @click="closeTemplatePicker">Close</button>
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

    <p v-if="message" class="workbench-message" aria-live="polite">{{ message }}</p>
  </main>
</template>
