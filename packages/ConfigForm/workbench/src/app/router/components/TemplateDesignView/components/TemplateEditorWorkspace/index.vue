<script setup lang="ts">
import type { DesignerLocaleOptions, DesignSurfaceExpose } from '@moluoxixi/config-form-designer'
import type { ProjectSurface } from '@moluoxixi/config-form-model'
import type { ProjectTemplateCatalogEntry } from '../../../../../../project'
import { ArrowLeft, Check, Save, SlidersHorizontal } from '@lucide/vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { createDesignerLocale, DesignSurface } from '@moluoxixi/config-form-designer'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { SurfacePresentationEditor } from '../../../../../../features/pages'
import { createWorkbenchLocaleOptions } from '../../../../../../locale'
import { prepareTemplatePreview, templateFromSurface } from '../../../../../../project'
import { DesignRuntimeHostFrame, StudioDesignRuntime, StudioDesignToolbar, WorkbenchCommandHint } from '../../../../../components'
import { useWorkbenchUiStore } from '../../../../../composables'
import { evaluateStudioExpression } from '../../../../../services'
import { useTemplateDesigner } from './composables'

const props = defineProps<{
  template: ProjectTemplateCatalogEntry
  locale?: DesignerLocaleOptions
  saveTemplate: (template: ProjectTemplateCatalogEntry) => Promise<void>
}>()
const emit = defineEmits<{ back: [] }>()
const ui = useWorkbenchUiStore()
const { adapter, design, error, snapshot, surface, surfaceId } = useTemplateDesigner(props.template)
const localeOptions = computed(() => createWorkbenchLocaleOptions(ui.localeId.value, adapter.value?.locale, props.locale))
const locale = computed(() => createDesignerLocale(localeOptions.value))
const name = ref(props.template.manifest.displayName)
const description = ref(props.template.manifest.description)
const saving = ref(false)
const saveError = ref('')
const savedHash = ref('')
const savedName = ref(name.value)
const savedDescription = ref(description.value)
const designer = useTemplateRef<DesignSurfaceExpose>('designer')
const hasChanges = computed(() => Boolean(snapshot.value) && (
  snapshot.value?.contentHash !== savedHash.value
  || name.value !== savedName.value
  || description.value !== savedDescription.value
))
const mobileView = ref('canvas')
const presentationOpen = ref(false)
const mobileViews = computed(() => [
  { label: locale.value.t('designer.view.components', 'Components'), value: 'palette' },
  { label: locale.value.t('designer.view.canvas', 'Canvas'), value: 'canvas' },
  { label: locale.value.t('designer.view.inspector', 'Inspector'), value: 'properties' },
])

watch(snapshot, (next) => {
  if (!savedHash.value && next)
    savedHash.value = next.contentHash
})

async function save(): Promise<void> {
  if (!adapter.value || !surface.value || !name.value.trim() || saving.value)
    return
  saving.value = true
  saveError.value = ''
  try {
    const template = templateFromSurface({
      id: props.template.manifest.id,
      name: name.value,
      description: description.value,
      surface: surface.value as ProjectSurface,
      registryLock: adapter.value.componentRegistry.lock,
    })
    prepareTemplatePreview(template, adapter.value, 'surface')
    const contentHash = snapshot.value!.contentHash
    await props.saveTemplate(template)
    name.value = template.manifest.displayName
    description.value = template.manifest.description
    savedHash.value = contentHash
    savedName.value = name.value
    savedDescription.value = description.value
  }
  catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : String(reason)
  }
  finally {
    saving.value = false
  }
}

function updatePresentation(presentation: Extract<ProjectSurface, { kind: 'dialog' | 'drawer' }>['presentation']): void {
  const result = design.commandControl.execute({
    id: `template-presentation-${crypto.randomUUID()}`,
    label: locale.value.t('surface.presentation', 'Overlay appearance'),
    actions: [{ type: 'operation.apply', operations: [{ type: 'surface.presentation', surfaceId: surfaceId.value, presentation }] }],
  })
  if (result.changed)
    presentationOpen.value = false
}

function beforeUnload(event: BeforeUnloadEvent): void {
  if (hasChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

function keyboardSave(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !event.isComposing) {
    event.preventDefault()
    void save()
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('keydown', keyboardSave)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  document.removeEventListener('keydown', keyboardSave)
})
defineExpose({ hasChanges, saving })
</script>

<template>
  <main class="workbench-app template-editor" :data-theme="ui.resolvedTheme.value" :data-palette="ui.paletteFamily.value" :aria-label="locale.t('library.editor', 'Template designer')">
    <header class="template-editor__header">
      <ElButton text circle :disabled="saving" :aria-label="locale.t('library.back', 'Back to templates')" :title="locale.t('library.back', 'Back to templates')" @click="emit('back')">
        <ArrowLeft :size="18" aria-hidden="true" />
      </ElButton>
      <div class="template-editor__identity">
        <span>{{ locale.t('library.editor', 'Template designer') }} · {{ template.manifest.adapter === 'element-plus' ? 'Element Plus' : 'Ant Design Vue' }} · {{ locale.t(`surface.kind.${template.surface.kind}`, template.surface.kind) }}</span>
        <ElInput v-model="name" :disabled="saving" maxlength="100" :aria-label="locale.t('library.name', 'Template name')" />
      </div>
      <div class="template-editor__actions">
        <span class="template-editor__status" role="status"><Check v-if="!hasChanges && snapshot" :size="15" aria-hidden="true" />{{ hasChanges ? locale.t('library.unsaved', 'Unsaved changes') : locale.t('library.savedShort', 'Saved to library') }}</span>
        <ElButton v-if="surface && surface.kind !== 'page'" class="template-editor__presentation" :disabled="saving" :aria-label="locale.t('surface.presentation', 'Overlay appearance')" :title="locale.t('surface.presentation', 'Overlay appearance')" @click="presentationOpen = true">
          <SlidersHorizontal :size="15" aria-hidden="true" /><span class="template-editor__presentation-label">{{ locale.t('surface.presentation', 'Overlay appearance') }}</span>
        </ElButton>
        <ElButton type="primary" :disabled="!snapshot || !name.trim()" :loading="saving" @click="save">
          <Save :size="16" aria-hidden="true" />{{ locale.t('library.save', 'Save template') }}
        </ElButton>
      </div>
    </header>
    <div class="template-editor__description">
      <label>{{ locale.t('library.description', 'Description') }}<ElInput v-model="description" :disabled="saving" maxlength="300" :aria-label="locale.t('library.description', 'Description')" /></label>
    </div>
    <ElAlert v-if="saveError || error" type="error" :title="saveError || error" :closable="false" role="alert" />
    <ElSegmented v-model="mobileView" class="template-editor__mobile" block :options="mobileViews" :aria-label="locale.t('designer.navigation', 'Designer navigation')" @change="designer?.selectWorkspaceView($event)" />
    <section v-if="adapter && surface" class="editor-pane" :aria-label="locale.t('library.editor', 'Template designer')">
      <DesignSurface
        ref="designer"
        class="embedded-designer"
        :graph="surface.graph"
        :surface="surface as ProjectSurface"
        :surface-id="surfaceId"
        :component-registry="adapter.componentRegistry"
        :registry="adapter.designerRegistry"
        :renderer="ConfigFormRenderer"
        :expression-evaluator="evaluateStudioExpression"
        :locale="localeOptions"
        :readonly="saving"
        :command-control="design.commandControl"
        :history-control="design.historyControl.value"
        :command-hint="WorkbenchCommandHint"
        workspace-navigation="external"
        @selection-set-change="design.selectedIds.value = $event"
      >
        <template #toolbar="scope">
          <StudioDesignToolbar :scope="scope" :locale="localeOptions" :show-compare="false" />
        </template>
        <template #runtime="scope">
          <StudioDesignRuntime :surface="surface as ProjectSurface" :scope="scope" :adapter="template.manifest.adapter" :locale="locale.locale" :namespace="adapter.designerRegistry.rendererNamespace" :resolve-compilation="design.getCompilation" :title="locale.t('canvas.runtimeFrame', 'Design runtime')" @error="saveError = $event.message" />
        </template>
        <template #dragVisual="scope">
          <DesignRuntimeHostFrame :adapter="template.manifest.adapter" :breakpoint="scope.breakpoint" :camera-scale="scope.cameraScale" :candidate-id="scope.candidateId" :candidate-uses-fallback="scope.candidateUsesFallback" :canvas-width="scope.canvasWidth" :command="scope.command" :locale="locale.locale" :model-value="scope.model" :namespace="adapter.designerRegistry.rendererNamespace" :resolve-compilation="design.getCompilation" :title="locale.t('canvas.dragVisualFrame', 'Drag preview runtime')" variant="drag-visual" @error="saveError = $event.message" />
        </template>
      </DesignSurface>
    </section>
    <p v-else role="status">
      {{ locale.t('status.loading', 'Loading') }}
    </p>
    <ElDialog v-model="presentationOpen" :title="locale.t('surface.presentation', 'Overlay appearance')" width="min(580px, calc(100vw - 24px))" align-center append-to="#workbench-overlays" destroy-on-close>
      <SurfacePresentationEditor v-if="surface && surface.kind !== 'page'" :surface="surface" :locale="localeOptions" :disabled="saving" @cancel="presentationOpen = false" @save="updatePresentation" />
    </ElDialog>
  </main>
</template>

<style src="./style/index.css" scoped />
