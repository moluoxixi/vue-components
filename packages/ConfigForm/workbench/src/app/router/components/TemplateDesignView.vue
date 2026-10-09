<script setup lang="ts">
import type { ProjectTemplateCatalogEntry } from '../../../project'
import { ElMessageBox } from 'element-plus'
import { onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { createTemplateCatalogService, createUserTemplateStore } from '../../../project'
import { useWorkbenchController } from '../../composables'
import { templatesPath } from '../../navigation'
import { TemplateEditorWorkspace } from './TemplateDesignView/components'

const controller = useWorkbenchController()
const route = useRoute()
const router = useRouter()
const store = createUserTemplateStore()
const entry = shallowRef<ProjectTemplateCatalogEntry>()
const error = ref('')
const editor = useTemplateRef<{ hasChanges: boolean, saving: boolean }>('editor')
let disposed = false
let request = 0

watch(() => route.params.templateId, async (id) => {
  const current = ++request
  entry.value = undefined
  error.value = ''
  try {
    const result = await createTemplateCatalogService([store.provider]).load()
    if (disposed || current !== request)
      return
    entry.value = result.templates.find(template => template.manifest.id === id)
    if (!entry.value)
      error.value = controller.workbenchLocale.value.t('library.missing', 'This template is unavailable. Return to the library to choose another one.')
  }
  catch (reason) {
    if (!disposed && current === request)
      error.value = reason instanceof Error ? reason.message : String(reason)
  }
}, { immediate: true })

async function saveTemplate(template: ProjectTemplateCatalogEntry): Promise<void> {
  await store.put(template)
}

async function canLeave(): Promise<boolean> {
  if (editor.value?.saving)
    return false
  if (!editor.value?.hasChanges)
    return true
  try {
    await ElMessageBox.confirm(
      controller.workbenchLocale.value.t('library.leaveHint', 'You have unsaved template changes. Leave and discard them?'),
      controller.workbenchLocale.value.t('library.unsaved', 'Unsaved changes'),
      {
        confirmButtonText: controller.workbenchLocale.value.t('library.discard', 'Discard changes'),
        cancelButtonText: controller.workbenchLocale.value.t('library.keepEditing', 'Keep editing'),
        type: 'warning',
        appendTo: '#workbench-overlays',
      },
    )
    return true
  }
  catch {
    return false
  }
}

onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
onBeforeUnmount(() => {
  disposed = true
  request += 1
  store.close()
})
</script>

<template>
  <TemplateEditorWorkspace v-if="entry" ref="editor" :key="entry.manifest.id" :template="entry" :locale="controller.localeOptions.value" :save-template="saveTemplate" @back="router.push(templatesPath())" />
  <main v-else class="template-editor-state">
    <p :role="error ? 'alert' : 'status'">
      {{ error || controller.workbenchLocale.value.t('status.loading', 'Loading') }}
    </p>
    <ElButton @click="router.push(templatesPath())">
      {{ controller.workbenchLocale.value.t('library.back', 'Back to templates') }}
    </ElButton>
  </main>
</template>
