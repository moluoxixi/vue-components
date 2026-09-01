<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type {
  PreparedTemplatePreview,
  ProjectTemplateCatalogEntry,
  ProjectTemplateCategory,
  TemplateCompatibilityResult,
  TemplateCreationTarget,
} from '../../project'
import type { WorkbenchTheme } from '../../app/workbench-ui-store'
import type { PreviewRuntimeStateEvent } from '../../session'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Languages,
  Moon,
  Search,
  Sun,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { loadWorkbenchAdapter } from '../../adapters'
import { useWorkbenchController, useWorkbenchUiStore } from '../../app/workbench-context'
import {
  analyzeTemplateCompatibility,
  builtInTemplateCatalogProvider,
  createTemplateCatalogService,
  prepareTemplatePreview,
} from '../../project'
import PreviewRuntimeHostFrame from '../../runtime-host/PreviewRuntimeHostFrame.vue'

const props = defineProps<{
  canClose: boolean
  locale?: DesignerLocaleOptions
  target: TemplateCreationTarget
  theme: WorkbenchTheme
}>()

const emit = defineEmits<{
  close: []
  created: []
  toggleLocale: []
  toggleTheme: []
}>()

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const locale = computed(() => createDesignerLocale(props.locale))
const catalogService = createTemplateCatalogService([builtInTemplateCatalogProvider])
const searchInput = useTemplateRef<{ focus?: () => void }>('searchInput')
const workspace = useTemplateRef<HTMLElement>('workspace')
const templates = shallowRef<ProjectTemplateCatalogEntry[]>([])
const catalogDiagnostics = ref<string[]>([])
const selectedId = ref('')
const query = ref('')
const category = ref<ProjectTemplateCategory | 'all'>('all')
const providerId = ref('all')
const mobilePane = ref<'catalog' | 'details'>('catalog')
const loadingCatalog = ref(true)
const loadingPreview = ref(false)
const submitting = ref(false)
const preview = ref<PreparedTemplatePreview>()
const previewError = ref('')
const compatibility = ref<TemplateCompatibilityResult>()
let previewRequest = 0
let disposed = false

const selectedTemplate = computed(() => templates.value.find(template => template.manifest.id === selectedId.value))
const providerOptions = computed(() => [...new Set(templates.value.map(template => template.providerId))])

function templateName(template: ProjectTemplateCatalogEntry): string {
  return locale.value.t(`template.catalog.${template.manifest.id}.name`, template.manifest.displayName)
}

function templateDescription(template: ProjectTemplateCatalogEntry): string {
  return locale.value.t(`template.catalog.${template.manifest.id}.description`, template.manifest.description)
}

const filteredTemplates = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase()
  return templates.value.filter((template) => {
    if (category.value !== 'all' && template.manifest.category !== category.value)
      return false
    if (providerId.value !== 'all' && template.providerId !== providerId.value)
      return false
    return !normalized || [
      templateName(template),
      templateDescription(template),
      template.providerId,
      ...template.manifest.tags,
    ].join(' ').toLocaleLowerCase().includes(normalized)
  })
})

const creationTitle = computed(() => props.target === 'project'
  ? locale.value.t('template.createProject', 'Create project')
  : locale.value.t('template.createPage', 'Create page'))
const createLabel = computed(() => props.target === 'project'
  ? locale.value.t('template.createProjectAction', 'Create project')
  : locale.value.t('template.createPageAction', 'Create page'))
const createUnavailableReason = computed(() => {
  if (loadingPreview.value)
    return locale.value.t('template.checkingCompatibility', 'Checking Registry compatibility')
  if (!selectedTemplate.value)
    return locale.value.t('template.selectRequired', 'Select a template first')
  if (previewError.value)
    return previewError.value
  if (!compatibility.value)
    return locale.value.t('template.checkingCompatibility', 'Checking Registry compatibility')
  return compatibility.value?.diagnostics[0]?.message
})

function selectTemplate(id: string): void {
  selectedId.value = id
}

function itemSelector(id: string): string {
  return `[data-template-id="${CSS.escape(id)}"]`
}

function focusTemplate(id: string): void {
  void nextTick(() => workspace.value?.querySelector<HTMLElement>(itemSelector(id))?.focus())
}

function moveSelection(event: KeyboardEvent, currentId: string): void {
  const ids = filteredTemplates.value.map(template => template.manifest.id)
  const current = Math.max(0, ids.indexOf(currentId))
  const next = event.key === 'ArrowDown'
    ? Math.min(ids.length - 1, current + 1)
    : event.key === 'ArrowUp'
      ? Math.max(0, current - 1)
      : event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? ids.length - 1
          : undefined
  if (next === undefined || !ids[next]) {
    if (event.key === 'Enter') {
      event.preventDefault()
      mobilePane.value = 'details'
    }
    return
  }
  event.preventDefault()
  selectedId.value = ids[next]
  focusTemplate(ids[next])
}

function showCatalog(): void {
  mobilePane.value = 'catalog'
  if (selectedId.value)
    focusTemplate(selectedId.value)
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape')
    return
  if (submitting.value || controller.busy.value)
    return
  if (mobilePane.value === 'details' && matchMedia('(max-width: 640px)').matches) {
    event.preventDefault()
    showCatalog()
    return
  }
  if (props.canClose) {
    event.preventDefault()
    emit('close')
  }
}

function handleRuntimeState(event: PreviewRuntimeStateEvent): void {
  if (!preview.value || event.revision !== preview.value.revision)
    return
  preview.value = { ...preview.value, runtimeState: structuredClone(event.state) }
}

function handleFieldChange(payload: { field: string, values: Record<string, unknown> }): void {
  if (!preview.value)
    return
  preview.value = {
    ...preview.value,
    runtimeState: { ...preview.value.runtimeState, values: structuredClone(payload.values) },
  }
}

async function prepareSelectedTemplate(): Promise<void> {
  const template = selectedTemplate.value
  const request = ++previewRequest
  preview.value = undefined
  previewError.value = ''
  compatibility.value = undefined
  if (!template)
    return
  loadingPreview.value = true
  try {
    const adapter = await loadWorkbenchAdapter(template.manifest.adapter)
    if (disposed || request !== previewRequest || selectedId.value !== template.manifest.id)
      return
    compatibility.value = analyzeTemplateCompatibility(template, {
      registry: adapter.registrySnapshot,
      target: props.target,
      ...(props.target === 'page' && controller.currentProject.value
        ? { targetLock: structuredClone(controller.currentProject.value.registryLock) }
        : {}),
    })
    const prepared = prepareTemplatePreview(template, adapter)
    if (disposed || request !== previewRequest || selectedId.value !== template.manifest.id)
      return
    preview.value = prepared
  }
  catch (error) {
    if (disposed || request !== previewRequest)
      return
    previewError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    if (!disposed && request === previewRequest)
      loadingPreview.value = false
  }
}

async function createSelected(): Promise<void> {
  const template = selectedTemplate.value
  if (!template || createUnavailableReason.value || submitting.value || controller.busy.value)
    return
  submitting.value = true
  ui.clearMessage()
  try {
    const name = templateName(template)
    const created = props.target === 'project'
      ? await controller.createProjectFromTemplate(template, name)
      : await controller.createPageFromTemplate(template, name)
    if (created)
      emit('created')
  }
  finally {
    submitting.value = false
  }
}

async function loadCatalog(): Promise<void> {
  loadingCatalog.value = true
  catalogDiagnostics.value = []
  try {
    const result = await catalogService.load()
    if (disposed)
      return
    templates.value = result.templates
    catalogDiagnostics.value = result.diagnostics.map(diagnostic => diagnostic.message)
    if (!result.templates.some(template => template.manifest.id === selectedId.value))
      selectedId.value = result.templates[0]?.manifest.id ?? ''
  }
  catch (error) {
    if (!disposed) {
      templates.value = []
      catalogDiagnostics.value = [error instanceof Error ? error.message : String(error)]
    }
  }
  finally {
    if (!disposed)
      loadingCatalog.value = false
  }
}

watch(
  () => [selectedId.value, props.target, controller.currentProject.value?.registryLock.fingerprint],
  () => void prepareSelectedTemplate(),
)

watch(filteredTemplates, (available) => {
  if (available.some(template => template.manifest.id === selectedId.value))
    return
  selectedId.value = available[0]?.manifest.id ?? ''
})

onMounted(async () => {
  document.addEventListener('keydown', handleEscape)
  await loadCatalog()
  if (disposed)
    return
  await nextTick()
  searchInput.value?.focus?.()
})

onBeforeUnmount(() => {
  disposed = true
  previewRequest += 1
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <main
    ref="workspace"
    class="template-creation-workspace"
    :class="`is-mobile-${mobilePane}`"
    :data-theme="theme"
    :aria-label="creationTitle"
  >
    <header class="template-workspace-header">
      <div class="template-workspace-heading">
        <ElButton
          v-if="canClose"
          native-type="button"
          text
          circle
          :disabled="submitting || controller.busy.value"
          :title="locale.t('template.backToDesigner', 'Back to Designer')"
          :aria-label="locale.t('template.backToDesigner', 'Back to Designer')"
          @click="emit('close')"
        >
          <ArrowLeft :size="18" aria-hidden="true" />
        </ElButton>
        <div>
          <span>ConfigForm Workbench</span>
          <h1>{{ creationTitle }}</h1>
        </div>
      </div>
      <div class="template-workspace-actions">
        <ElButton native-type="button" text circle :title="locale.t('locale.switch', 'Switch language')" :aria-label="locale.t('locale.switch', 'Switch language')" @click="emit('toggleLocale')">
          <Languages :size="17" aria-hidden="true" />
        </ElButton>
        <ElButton native-type="button" text circle :title="theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme')" :aria-label="theme === 'dark' ? locale.t('theme.useLight', 'Use light theme') : locale.t('theme.useDark', 'Use dark theme')" @click="emit('toggleTheme')">
          <Sun v-if="theme === 'dark'" :size="17" aria-hidden="true" />
          <Moon v-else :size="17" aria-hidden="true" />
        </ElButton>
      </div>
    </header>

    <div class="template-mobile-panes" role="tablist" :aria-label="locale.t('template.mobileView', 'Template workspace view')">
      <button type="button" role="tab" :aria-selected="mobilePane === 'catalog'" @click="showCatalog">{{ locale.t('template.catalog', 'Catalog') }}</button>
      <button type="button" role="tab" :aria-selected="mobilePane === 'details'" :disabled="!selectedTemplate" @click="mobilePane = 'details'">{{ locale.t('template.details', 'Details') }}</button>
    </div>

    <section class="template-workspace-layout">
      <aside class="template-catalog-pane" :aria-label="locale.t('template.catalog', 'Catalog')">
        <div class="template-catalog-filters">
          <ElInput ref="searchInput" v-model="query" type="search" clearable :placeholder="locale.t('template.search', 'Search templates')" :aria-label="locale.t('template.search', 'Search templates')">
            <template #prefix><Search :size="15" aria-hidden="true" /></template>
          </ElInput>
          <div>
            <ElSelect v-model="category" :aria-label="locale.t('template.category', 'Template category')" append-to="#workbench-overlays">
              <ElOption value="all" :label="locale.t('template.categoryAll', 'All categories')" />
              <ElOption value="blank" :label="locale.t('template.categoryBlank', 'Blank')" />
              <ElOption value="starter" :label="locale.t('template.categoryStarter', 'Starter')" />
            </ElSelect>
            <ElSelect v-model="providerId" :aria-label="locale.t('template.provider', 'Template provider')" append-to="#workbench-overlays">
              <ElOption value="all" :label="locale.t('template.providerAll', 'All providers')" />
              <ElOption v-for="provider in providerOptions" :key="provider" :value="provider" :label="provider" />
            </ElSelect>
          </div>
        </div>

        <p v-if="loadingCatalog" class="template-state" role="status">{{ locale.t('template.loading', 'Loading templates') }}</p>
        <div v-else-if="filteredTemplates.length" class="template-catalog-list" role="listbox" :aria-label="locale.t('template.available', 'Available templates')">
          <button
            v-for="template in filteredTemplates"
            :key="template.manifest.id"
            type="button"
            role="option"
            class="template-catalog-item"
            :class="{ 'is-selected': selectedId === template.manifest.id }"
            :aria-selected="selectedId === template.manifest.id"
            :data-template-id="template.manifest.id"
            :tabindex="selectedId === template.manifest.id ? 0 : -1"
            @click="selectTemplate(template.manifest.id)"
            @dblclick="mobilePane = 'details'"
            @keydown="moveSelection($event, template.manifest.id)"
          >
            <span class="template-catalog-rail" aria-hidden="true" />
            <span class="template-catalog-copy">
              <strong>{{ templateName(template) }}</strong>
              <span>{{ templateDescription(template) }}</span>
              <small>{{ template.manifest.adapter }} · {{ template.providerId }}</small>
            </span>
          </button>
        </div>
        <div v-else class="template-empty-state" role="status">
          <strong>{{ locale.t('template.noResults', 'No templates match these filters') }}</strong>
          <span>{{ locale.t('template.noResultsHint', 'Clear search or choose another category or provider.') }}</span>
          <ElButton native-type="button" @click="query = ''; category = 'all'; providerId = 'all'">{{ locale.t('template.clearFilters', 'Clear filters') }}</ElButton>
        </div>
        <div v-if="catalogDiagnostics.length" class="template-provider-error" role="alert">
          <p v-for="diagnostic in catalogDiagnostics" :key="diagnostic">{{ diagnostic }}</p>
          <ElButton native-type="button" size="small" @click="loadCatalog">{{ locale.t('template.retryCatalog', 'Retry catalog') }}</ElButton>
        </div>
      </aside>

      <section class="template-detail-pane" :aria-label="locale.t('template.details', 'Details')">
        <template v-if="selectedTemplate">
          <header class="template-detail-header">
            <div>
              <button type="button" class="template-mobile-back" @click="showCatalog"><ArrowLeft :size="16" aria-hidden="true" />{{ locale.t('template.catalog', 'Catalog') }}</button>
              <h2>{{ templateName(selectedTemplate) }}</h2>
              <p>{{ templateDescription(selectedTemplate) }}</p>
            </div>
            <dl>
              <div><dt>{{ locale.t('template.adapter', 'Adapter') }}</dt><dd>{{ selectedTemplate.manifest.adapter }}</dd></div>
              <div><dt>{{ locale.t('template.version', 'Version') }}</dt><dd>v{{ selectedTemplate.manifest.version }}</dd></div>
              <div><dt>{{ locale.t('template.provider', 'Provider') }}</dt><dd>{{ selectedTemplate.providerId }}</dd></div>
            </dl>
          </header>

          <div class="template-compatibility" :class="{ 'is-blocked': compatibility && !compatibility.compatible }">
            <p v-if="loadingPreview" role="status">{{ locale.t('template.checkingCompatibility', 'Checking Registry compatibility') }}</p>
            <template v-else-if="compatibility?.compatible">
              <CheckCircle2 :size="16" aria-hidden="true" />
              <p><strong>{{ locale.t('template.compatible', 'Registry compatible') }}</strong><span>{{ locale.t('template.compatibleHint', 'Schema and component contracts passed preflight checks.') }}</span></p>
            </template>
            <template v-else-if="compatibility">
              <AlertTriangle :size="16" aria-hidden="true" />
              <div role="alert">
                <strong>{{ locale.t('template.incompatible', 'Cannot create with this Registry') }}</strong>
                <ul><li v-for="diagnostic in compatibility.diagnostics" :key="`${diagnostic.code}:${diagnostic.path}`">{{ diagnostic.message }}</li></ul>
              </div>
            </template>
          </div>

          <div class="template-runtime-preview">
            <p v-if="loadingPreview" class="template-state" role="status">{{ locale.t('template.preparingPreview', 'Preparing Runtime preview') }}</p>
            <div v-else-if="previewError" class="template-preview-error" role="alert">
              <strong>{{ locale.t('template.previewFailed', 'Preview failed') }}</strong>
              <span>{{ previewError }}</span>
              <ElButton native-type="button" @click="prepareSelectedTemplate">{{ locale.t('template.retryPreview', 'Retry preview') }}</ElButton>
            </div>
            <PreviewRuntimeHostFrame
              v-else-if="preview"
              :adapter="preview.adapter"
              :compilation="preview.compilation"
              :locale="locale.locale"
              :namespace="preview.namespace"
              :reaction-projection="preview.reactionProjection"
              :revision="preview.revision"
              :runtime-session-key="preview.runtimeSessionKey"
              :runtime-state="preview.runtimeState"
              :title="locale.t('template.previewTitle', '{name} Runtime preview', { name: templateName(selectedTemplate) })"
              @error="previewError = $event.message"
              @field-change="handleFieldChange"
              @runtime-state="handleRuntimeState"
            />
          </div>

          <footer class="template-create-footer">
            <p v-if="ui.message.value" role="alert">{{ ui.message.value }}</p>
            <p v-else-if="createUnavailableReason" role="status">{{ createUnavailableReason }}</p>
            <span v-else>{{ locale.t('template.ready', 'Ready to create an independent instance.') }}</span>
            <ElButton native-type="button" type="primary" :loading="submitting" :disabled="Boolean(createUnavailableReason) || controller.busy.value" @click="createSelected">
              {{ createLabel }}
            </ElButton>
          </footer>
        </template>
      </section>
    </section>
  </main>
</template>
