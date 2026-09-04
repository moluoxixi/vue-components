<script setup lang="ts">
import type {
  PreparedTemplatePreview,
  ProjectTemplateCatalogEntry,
  ProjectTemplateCategory,
  TemplateEligibilityResult,
} from '../../../project'
import type { PreviewRuntimeStateEvent } from '../../../session'
import type { TemplateCreationWorkspaceEmits, TemplateCreationWorkspaceProps } from '../../../features/templates'
import type { TemplateEligibilityCacheEntry, TemplateEligibilityDisplayStatus } from './types'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  File,
  LayoutGrid,
  Languages,
  LibraryBig,
  MoreHorizontal,
  PanelLeftOpen,
  Settings2,
  Sparkles,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { loadWorkbenchAdapter } from '../../../adapters'
import { useWorkbenchController, useWorkbenchUiStore } from '../../composables'
import {
  analyzeTemplateEligibility,
  builtInTemplateCatalogProvider,
  createTemplateCatalogService,
  prepareTemplatePreview,
} from '../../../project'
import WorkbenchAppearancePopover from '../WorkbenchAppearancePopover.vue'
import PreviewRuntimeHostFrame from '../PreviewRuntimeHostFrame/index.vue'
import { JsonImportPane, TemplateCatalogPanel } from './components'
import { useTemplateViewport } from './composables'

const props = defineProps<TemplateCreationWorkspaceProps>()
const emit = defineEmits<TemplateCreationWorkspaceEmits>()

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const locale = computed(() => createDesignerLocale(props.locale))
const catalogService = createTemplateCatalogService([builtInTemplateCatalogProvider])
const catalogDrawerTrigger = useTemplateRef<{ $el?: HTMLButtonElement }>('catalogDrawerTrigger')
const drawerCatalog = useTemplateRef<{ focusSearch: () => void }>('drawerCatalog')
const inlineCatalog = useTemplateRef<{ focusSearch: () => void, focusTemplate: (id: string) => void }>('inlineCatalog')
const mobileActionsTrigger = useTemplateRef<{ $el?: HTMLButtonElement }>('mobileActionsTrigger')
const { isDesktop, isMedium, isMobile } = useTemplateViewport()
const templates = shallowRef<ProjectTemplateCatalogEntry[]>([])
const catalogDiagnostics = ref<string[]>([])
const catalogFatalError = ref('')
const catalogDrawerOpen = ref(false)
const selectedId = ref('')
const query = ref('')
const category = ref<ProjectTemplateCategory | 'all'>('all')
const providerId = ref('all')
const mobilePane = ref<'catalog' | 'details'>('catalog')
const creationMode = ref<'json' | 'template'>('template')
const loadingCatalog = ref(true)
const loadingPreview = ref(false)
const submitting = ref(false)
const preview = ref<PreparedTemplatePreview>()
const previewError = ref('')
const eligibility = ref<TemplateEligibilityResult>()
const eligibilityCache = shallowRef<Record<string, TemplateEligibilityCacheEntry>>({})
let previewRequest = 0
let disposed = false

const selectedTemplate = computed(() => templates.value.find(template => template.manifest.id === selectedId.value))
const providerOptions = computed(() => [...new Set(templates.value.map(template => template.providerId))])
const mobilePaneOptions = computed(() => [
  { label: locale.value.t('template.catalog', 'Catalog'), value: 'catalog' },
  { label: locale.value.t('template.details', 'Details'), value: 'details', disabled: !selectedTemplate.value },
])
const registryContextFingerprint = computed(() => props.target === 'page'
  ? controller.currentProject.value?.registryLock.fingerprint ?? 'missing-project-registry'
  : 'new-project')
const eligibilityStatuses = computed<Readonly<Record<string, TemplateEligibilityDisplayStatus>>>(() => (
  Object.fromEntries(templates.value.map(template => [
    template.manifest.id,
    eligibilityCache.value[eligibilityCacheKey(template.manifest.id)]?.status ?? 'pending',
  ]))
))

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
    return locale.value.t('template.checkingEligibility', 'Checking Registry requirements')
  if (!selectedTemplate.value)
    return locale.value.t('template.selectRequired', 'Select a template first')
  if (previewError.value)
    return previewError.value
  if (!eligibility.value)
    return locale.value.t('template.checkingEligibility', 'Checking Registry requirements')
  return eligibility.value?.diagnostics[0]?.message
})

function selectTemplate(id: string): void {
  selectedId.value = id
}

function activateTemplate(id = selectedId.value): void {
  if (!id)
    return
  selectedId.value = id
  if (isMobile.value)
    mobilePane.value = 'details'
  else if (isMedium.value)
    closeCatalogDrawer()
}

function eligibilityCacheKey(templateId: string): string {
  return `${templateId}:${props.target}:${registryContextFingerprint.value}`
}

function setEligibilityStatus(
  cacheKey: string,
  request: number,
  status: TemplateEligibilityCacheEntry['status'],
): void {
  eligibilityCache.value = {
    ...eligibilityCache.value,
    [cacheKey]: { request, status },
  }
}

function clearCheckingEligibility(cacheKey: string, request: number): void {
  if (eligibilityCache.value[cacheKey]?.request !== request
    || eligibilityCache.value[cacheKey]?.status !== 'checking') {
    return
  }
  const next = { ...eligibilityCache.value }
  delete next[cacheKey]
  eligibilityCache.value = next
}

function clearFilters(): void {
  query.value = ''
  category.value = 'all'
  providerId.value = 'all'
}

function closeCatalogDrawer(): void {
  catalogDrawerOpen.value = false
}

function restoreCatalogDrawerFocus(): void {
  if (isMedium.value)
    void nextTick(() => catalogDrawerTrigger.value?.$el?.focus())
}

function openCatalogDrawer(): void {
  ui.closeAppearanceDrawer()
  catalogDrawerOpen.value = true
}

function showCatalog(): void {
  if (isMedium.value) {
    openCatalogDrawer()
    return
  }
  mobilePane.value = 'catalog'
  if (selectedId.value)
    void nextTick(() => inlineCatalog.value?.focusTemplate(selectedId.value))
  else
    void nextTick(() => inlineCatalog.value?.focusSearch())
}

function handleCatalogDrawerOpened(): void {
  drawerCatalog.value?.focusSearch()
}

function chooseMobileAction(action: 'openAppearance' | 'toggleLocale'): void {
  void nextTick(() => {
    mobileActionsTrigger.value?.$el?.focus()
    if (action === 'openAppearance') {
      catalogDrawerOpen.value = false
      ui.openAppearanceDrawer()
    }
    else {
      emit('toggleLocale')
    }
  })
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape')
    return
  if (submitting.value || controller.busy.value)
    return
  if (catalogDrawerOpen.value) {
    event.preventDefault()
    closeCatalogDrawer()
    return
  }
  if (mobilePane.value === 'details' && isMobile.value) {
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
  const cacheKey = template ? eligibilityCacheKey(template.manifest.id) : ''
  preview.value = undefined
  previewError.value = ''
  eligibility.value = undefined
  if (!template)
    return
  setEligibilityStatus(cacheKey, request, 'checking')
  loadingPreview.value = true
  try {
    const adapter = await loadWorkbenchAdapter(template.manifest.adapter)
    if (disposed || request !== previewRequest || selectedId.value !== template.manifest.id) {
      clearCheckingEligibility(cacheKey, request)
      return
    }
    eligibility.value = analyzeTemplateEligibility(template, {
      registry: adapter.registrySnapshot,
      target: props.target,
      ...(props.target === 'page' && controller.currentProject.value
        ? { targetLock: structuredClone(controller.currentProject.value.registryLock) }
        : {}),
    })
    setEligibilityStatus(
      cacheKey,
      request,
      eligibility.value.eligible ? 'eligible' : 'ineligible',
    )
    const prepared = prepareTemplatePreview(template, adapter)
    if (disposed || request !== previewRequest || selectedId.value !== template.manifest.id)
      return
    preview.value = prepared
  }
  catch (error) {
    if (disposed || request !== previewRequest)
      return
    clearCheckingEligibility(cacheKey, request)
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
  catalogFatalError.value = ''
  try {
    const result = await catalogService.load()
    if (disposed)
      return
    templates.value = result.templates
    eligibilityCache.value = {}
    catalogDiagnostics.value = result.diagnostics.map(diagnostic => diagnostic.message)
    if (!result.templates.some(template => template.manifest.id === selectedId.value))
      selectedId.value = result.templates[0]?.manifest.id ?? ''
  }
  catch (error) {
    if (!disposed) {
      templates.value = []
      eligibilityCache.value = {}
      catalogFatalError.value = error instanceof Error ? error.message : String(error)
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

watch(mobilePane, (pane) => {
  if (pane === 'catalog' && isMobile.value)
    void nextTick(() => inlineCatalog.value?.focusSearch())
})

watch(creationMode, (mode) => {
  if (mode !== 'template')
    catalogDrawerOpen.value = false
})

watch(ui.appearanceDrawerOpen, (open) => {
  if (open)
    catalogDrawerOpen.value = false
})

watch(isMedium, (medium) => {
  if (!medium)
    catalogDrawerOpen.value = false
})

onMounted(async () => {
  document.addEventListener('keydown', handleEscape)
  await loadCatalog()
  if (disposed)
    return
  await nextTick()
  if (isDesktop.value || isMobile.value)
    inlineCatalog.value?.focusSearch()
})

onBeforeUnmount(() => {
  disposed = true
  previewRequest += 1
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <main
    class="template-creation-workspace"
    :class="[`is-mobile-${mobilePane}`, { 'is-json-mode': creationMode === 'json' }]"
    :data-theme="ui.resolvedTheme.value"
    :data-palette="ui.paletteFamily.value"
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
      <ElSegmented
        v-model="creationMode"
        class="creation-mode-switch"
        :aria-label="locale.t('import.creationMode', 'Creation source')"
        :options="[
          { label: locale.t('template.catalog', 'Templates'), value: 'template' },
          { label: locale.t('import.title', 'JSON import'), value: 'json' },
        ]"
      />
      <div class="template-workspace-actions">
        <ElButton class="template-desktop-action" native-type="button" text circle :title="locale.t('locale.switch', 'Switch language')" :aria-label="locale.t('locale.switch', 'Switch language')" @click="emit('toggleLocale')">
          <Languages :size="17" aria-hidden="true" />
        </ElButton>
        <WorkbenchAppearancePopover
          trigger-class="template-appearance-trigger template-desktop-action"
          :locale="locale"
          :palette-family="ui.paletteFamily.value"
          :theme-preference="ui.themePreference.value"
          @set-palette-family="ui.setPaletteFamily"
          @set-theme-preference="ui.setThemePreference"
        />
        <ElDropdown
          class="template-mobile-action-menu"
          trigger="click"
          placement="bottom-end"
          :show-timeout="0"
          :hide-timeout="0"
          append-to="#workbench-overlays"
          @command="chooseMobileAction"
        >
          <ElButton ref="mobileActionsTrigger" native-type="button" text circle :title="locale.t('workbench.moreActions', 'More actions')" :aria-label="locale.t('workbench.moreActions', 'More actions')">
            <MoreHorizontal :size="18" aria-hidden="true" />
          </ElButton>
          <template #dropdown>
            <ElDropdownMenu class="template-mobile-action-popover" data-template-mobile-action-menu>
              <ElDropdownItem command="toggleLocale"><Languages :size="15" aria-hidden="true" /><span>{{ locale.t('locale.switch', 'Switch language') }}</span></ElDropdownItem>
              <ElDropdownItem command="openAppearance"><Settings2 :size="15" aria-hidden="true" /><span>{{ locale.t('appearance.open', 'Open appearance settings') }}</span></ElDropdownItem>
            </ElDropdownMenu>
          </template>
        </ElDropdown>
      </div>
    </header>

    <ElSegmented
      v-if="creationMode === 'template' && isMobile"
      v-model="mobilePane"
      class="template-mobile-panes"
      block
      :aria-label="locale.t('template.mobileView', 'Template workspace view')"
      :options="mobilePaneOptions"
    />

    <section v-if="creationMode === 'template'" class="template-workspace-layout">
      <nav class="template-category-rail" :aria-label="locale.t('template.categoryRail', 'Template categories')">
        <ElButton
          native-type="button"
          text
          :class="{ 'is-active': category === 'all' }"
          :aria-pressed="category === 'all'"
          @click="category = 'all'"
        >
          <LayoutGrid :size="17" aria-hidden="true" />
          <span>{{ locale.t('template.categoryAllShort', 'All') }}</span>
        </ElButton>
        <ElButton
          native-type="button"
          text
          :class="{ 'is-active': category === 'blank' }"
          :aria-pressed="category === 'blank'"
          @click="category = 'blank'"
        >
          <File :size="17" aria-hidden="true" />
          <span>{{ locale.t('template.categoryBlank', 'Blank') }}</span>
        </ElButton>
        <ElButton
          native-type="button"
          text
          :class="{ 'is-active': category === 'starter' }"
          :aria-pressed="category === 'starter'"
          @click="category = 'starter'"
        >
          <Sparkles :size="17" aria-hidden="true" />
          <span>{{ locale.t('template.categoryStarter', 'Starter') }}</span>
        </ElButton>
        <ElButton
          ref="catalogDrawerTrigger"
          data-template-catalog-open
          class="template-category-browse"
          native-type="button"
          text
          :title="locale.t('template.browse', 'Browse templates')"
          :aria-label="locale.t('template.browse', 'Browse templates')"
          @click="openCatalogDrawer"
        >
          <PanelLeftOpen :size="17" aria-hidden="true" />
          <span>{{ locale.t('template.browseShort', 'Browse') }}</span>
        </ElButton>
      </nav>

      <aside class="template-catalog-pane" :aria-label="locale.t('template.catalog', 'Catalog')">
        <TemplateCatalogPanel
          ref="inlineCatalog"
          :catalog-diagnostics="catalogDiagnostics"
          :category="category"
          :eligibility-statuses="eligibilityStatuses"
          :fatal-error="catalogFatalError"
          :filtered-templates="filteredTemplates"
          :loading="loadingCatalog"
          :locale="locale"
          :provider-id="providerId"
          :provider-options="providerOptions"
          :query="query"
          :selected-id="selectedId"
          :templates="templates"
          @clear-filters="clearFilters"
          @retry="loadCatalog"
          @select="selectTemplate"
          @show-details="activateTemplate()"
          @update:category="category = $event"
          @update:provider-id="providerId = $event"
          @update:query="query = $event"
        />
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
              <div><dt>{{ locale.t('template.provider', 'Provider') }}</dt><dd>{{ selectedTemplate.providerId }}</dd></div>
            </dl>
          </header>

          <div class="template-eligibility" :class="{ 'is-blocked': eligibility && !eligibility.eligible }">
            <p v-if="loadingPreview" role="status">{{ locale.t('template.checkingEligibility', 'Checking Registry requirements') }}</p>
            <template v-else-if="eligibility?.eligible">
              <CheckCircle2 :size="16" aria-hidden="true" />
              <p><strong>{{ locale.t('template.eligible', 'Registry requirements met') }}</strong><span>{{ locale.t('template.eligibleHint', 'Schema and component contracts passed validation.') }}</span></p>
            </template>
            <template v-else-if="eligibility">
              <AlertTriangle :size="16" aria-hidden="true" />
              <div role="alert">
                <strong>{{ locale.t('template.ineligible', 'Cannot create with this Registry') }}</strong>
                <ul><li v-for="diagnostic in eligibility.diagnostics" :key="`${diagnostic.code}:${diagnostic.path}`">{{ diagnostic.message }}</li></ul>
                <ElButton native-type="button" text size="small" @click="showCatalog">
                  <PanelLeftOpen :size="14" aria-hidden="true" />
                  {{ locale.t('template.browse', 'Browse templates') }}
                </ElButton>
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
        <div v-else class="template-no-selection" role="status">
          <LibraryBig :size="22" aria-hidden="true" />
          <strong>{{ locale.t('template.noSelection', 'No template selected') }}</strong>
          <span>{{ locale.t('template.noSelectionHint', 'Browse the catalog and choose a template to inspect its Registry requirements and Runtime preview.') }}</span>
          <ElButton native-type="button" @click="showCatalog">
            <PanelLeftOpen :size="16" aria-hidden="true" />
            {{ locale.t('template.browse', 'Browse templates') }}
          </ElButton>
        </div>
      </section>
    </section>

    <ElDrawer
      v-model="catalogDrawerOpen"
      class="template-catalog-drawer"
      modal-class="template-catalog-drawer-overlay"
      direction="ltr"
      size="min(88vw, 340px)"
      append-to="#workbench-overlays"
      destroy-on-close
      :lock-scroll="true"
      :trap-focus="true"
      :close-on-click-modal="true"
      :close-on-press-escape="true"
      :show-close="true"
      :title="locale.t('template.catalog', 'Catalog')"
      :aria-label="locale.t('template.catalog', 'Catalog')"
      @closed="restoreCatalogDrawerFocus"
      @keydown.esc.capture.stop.prevent="closeCatalogDrawer"
      @opened="handleCatalogDrawerOpened"
    >
      <TemplateCatalogPanel
        ref="drawerCatalog"
        :catalog-diagnostics="catalogDiagnostics"
        :category="category"
        :eligibility-statuses="eligibilityStatuses"
        :fatal-error="catalogFatalError"
        :filtered-templates="filteredTemplates"
        :loading="loadingCatalog"
        :locale="locale"
        :provider-id="providerId"
        :provider-options="providerOptions"
        :query="query"
        :selected-id="selectedId"
        :templates="templates"
        @clear-filters="clearFilters"
        @retry="loadCatalog"
        @select="selectTemplate"
        @show-details="activateTemplate()"
        @update:category="category = $event"
        @update:provider-id="providerId = $event"
        @update:query="query = $event"
      />
    </ElDrawer>
    <JsonImportPane v-if="creationMode === 'json'" :locale="props.locale" :target="target" @created="emit('created')" />
  </main>
</template>
