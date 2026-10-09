<script setup lang="ts">
import type { TemplateDetails } from '../../../features/templates'
import type { PreparedTemplatePreview, ProjectTemplateCatalogEntry } from '../../../project'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { loadWorkbenchAdapter } from '../../../adapters'
import { builtInTemplateCatalogProvider, copyTemplate, createBlankTemplate, createTemplateCatalogService, createUserTemplateStore, prepareTemplatePreview } from '../../../project'
import { DesignRuntimeHostFrame, SurfacePresentationFrame } from '../../components'
import { useWorkbenchController, useWorkbenchUiStore } from '../../composables'
import { templateDesignPath } from '../../navigation'
import ManagementShell from './ManagementShell.vue'
import TemplateDetailsDialog from './TemplateDetailsDialog.vue'
import { TemplateManager } from './TemplatesView/components'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()
const store = createUserTemplateStore()
const templates = shallowRef<ProjectTemplateCatalogEntry[]>([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const creationOpen = ref(false)
const creationError = ref('')
const deleteTarget = shallowRef<ProjectTemplateCatalogEntry>()
const previewTarget = shallowRef<ProjectTemplateCatalogEntry>()
const preview = shallowRef<PreparedTemplatePreview>()
const previewError = ref('')
let disposed = false
let previewRequest = 0

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await createTemplateCatalogService([store.provider, builtInTemplateCatalogProvider]).load()
    if (disposed)
      return
    templates.value = result.templates
    if (result.diagnostics.length)
      error.value = controller.workbenchLocale.value.t('library.loadPartial', 'Some templates could not be loaded. Retry to refresh the library.')
  }
  catch (reason) {
    if (!disposed)
      error.value = String(reason)
  }
  finally {
    if (!disposed)
      loading.value = false
  }
}

function nameFor(entry: ProjectTemplateCatalogEntry): string {
  return controller.workbenchLocale.value.t(`template.catalog.${entry.manifest.id}.name`, entry.manifest.displayName)
}

async function create(details: TemplateDetails): Promise<void> {
  if (busy.value)
    return
  busy.value = true
  creationError.value = ''
  try {
    const entry = copyTemplate(createBlankTemplate(details.adapter, details.kind), details.name)
    entry.manifest.description = details.description || details.name
    if (entry.surface.kind !== 'page')
      entry.surface.presentation.title = details.name
    await store.put(entry)
    if (disposed)
      return
    creationOpen.value = false
    await router.push(templateDesignPath(entry.manifest.id))
  }
  catch (reason) {
    creationError.value = reason instanceof Error ? reason.message : String(reason)
  }
  finally {
    busy.value = false
  }
}

async function duplicate(entry: ProjectTemplateCatalogEntry): Promise<ProjectTemplateCatalogEntry | undefined> {
  if (busy.value)
    return
  busy.value = true
  try {
    const copy = copyTemplate(entry, controller.workbenchLocale.value.t('library.copyName', '{name} copy', { name: nameFor(entry) }))
    await store.put(copy)
    if (disposed)
      return
    await load()
    return copy
  }
  catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
  finally {
    busy.value = false
  }
}

async function edit(entry: ProjectTemplateCatalogEntry): Promise<void> {
  const target = entry.providerId === 'personal' ? entry : await duplicate(entry)
  if (target && !disposed)
    await router.push(templateDesignPath(target.manifest.id))
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value || busy.value)
    return
  busy.value = true
  try {
    await store.remove(deleteTarget.value.manifest.id)
    deleteTarget.value = undefined
    await load()
  }
  catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
  finally {
    busy.value = false
  }
}

async function showPreview(entry: ProjectTemplateCatalogEntry): Promise<void> {
  const request = ++previewRequest
  previewTarget.value = entry
  preview.value = undefined
  previewError.value = ''
  try {
    const adapter = await loadWorkbenchAdapter(entry.manifest.adapter)
    if (!disposed && request === previewRequest)
      preview.value = prepareTemplatePreview(entry, adapter, 'surface')
  }
  catch (reason) {
    if (!disposed && request === previewRequest)
      previewError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function closePreview(): void {
  previewRequest += 1
  previewTarget.value = undefined
  preview.value = undefined
}

onMounted(load)
onBeforeUnmount(() => {
  disposed = true
  previewRequest += 1
  store.close()
})
</script>

<template>
  <ManagementShell :palette="ui.paletteFamily.value" :theme="ui.resolvedTheme.value">
    <TemplateManager :templates="templates" :locale="controller.localeOptions.value" :loading="loading" :busy="busy" :error="error" @create="creationError = ''; creationOpen = true" @edit="edit" @duplicate="duplicate" @delete="deleteTarget = $event" @preview="showPreview" @retry="load" />
    <TemplateDetailsDialog v-model="creationOpen" with-types :busy="busy" :error="creationError" :locale="controller.localeOptions.value" @confirm="create" />
    <ElDialog :model-value="Boolean(deleteTarget)" :title="controller.workbenchLocale.value.t('library.deleteTitle', 'Delete template?')" width="min(440px, calc(100vw - 24px))" align-center append-to="#workbench-overlays" :close-on-press-escape="!busy" :show-close="!busy" @update:model-value="!busy && (deleteTarget = undefined)">
      <p>{{ controller.workbenchLocale.value.t('library.deleteHint', 'Delete {name}? Pages already created from it will keep their own copies.', { name: deleteTarget ? nameFor(deleteTarget) : '' }) }}</p>
      <template #footer>
        <ElButton :disabled="busy" @click="deleteTarget = undefined">
          {{ controller.workbenchLocale.value.t('action.cancel', 'Cancel') }}
        </ElButton><ElButton type="danger" :loading="busy" @click="confirmDelete">
          {{ controller.workbenchLocale.value.t('action.delete', 'Delete') }}
        </ElButton>
      </template>
    </ElDialog>
    <ElDialog :model-value="Boolean(previewTarget)" class="library-preview-dialog" :title="previewTarget ? nameFor(previewTarget) : ''" width="min(980px, calc(100vw - 24px))" top="5vh" append-to="#workbench-overlays" destroy-on-close @update:model-value="closePreview">
      <p v-if="previewError" role="alert">
        {{ previewError }}
      </p>
      <SurfacePresentationFrame v-else-if="preview && previewTarget" :surface="previewTarget.surface" breakpoint="desktop">
        <DesignRuntimeHostFrame :adapter="preview.adapter" breakpoint="desktop" :camera-scale="1" :locale="controller.workbenchLocale.value.locale" :model-value="preview.values" :namespace="preview.namespace" :resolve-compilation="() => preview?.compilation" :title="controller.workbenchLocale.value.t('template.previewTitle', '{name} Runtime preview', { name: nameFor(previewTarget) })" variant="canvas" @error="previewError = $event.message" />
      </SurfacePresentationFrame>
      <p v-else role="status">
        {{ controller.workbenchLocale.value.t('template.preparingPreview', 'Preparing preview') }}
      </p>
      <template #footer>
        <ElButton @click="closePreview">
          {{ controller.workbenchLocale.value.t('action.close', 'Close') }}
        </ElButton><ElButton v-if="previewTarget" type="primary" :disabled="busy" @click="edit(previewTarget)">
          {{ previewTarget.providerId === 'personal' ? controller.workbenchLocale.value.t('library.edit', 'Edit template') : controller.workbenchLocale.value.t('library.customize', 'Customize') }}
        </ElButton>
      </template>
    </ElDialog>
  </ManagementShell>
</template>
