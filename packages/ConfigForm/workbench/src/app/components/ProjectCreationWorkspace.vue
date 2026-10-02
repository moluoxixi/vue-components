<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { InputInstance } from 'element-plus'
import type { WorkbenchAdapterId } from '../../adapters'
import type { ProjectTemplateCatalogEntry } from '../../project'
import { ArrowLeft, Boxes, FolderKanban, Languages, PanelsTopLeft } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { builtInTemplateCatalogProvider, createTemplateCatalogService } from '../../project'
import { useWorkbenchController, useWorkbenchUiStore } from '../composables'
import WorkbenchAppearancePopover from './WorkbenchAppearancePopover.vue'

const props = defineProps<{
  canClose: boolean
  embedded?: boolean
  locale?: DesignerLocaleOptions
}>()

const emit = defineEmits<{
  close: []
  created: []
  toggleLocale: []
}>()

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const locale = computed(() => createDesignerLocale(props.locale))
const catalogService = createTemplateCatalogService([builtInTemplateCatalogProvider])
const nameInput = useTemplateRef<InputInstance>('nameInput')
const projectName = ref('')
const selectedAdapter = ref<WorkbenchAdapterId>('element-plus')
const templates = shallowRef<ProjectTemplateCatalogEntry[]>([])
const loading = ref(true)
const submitting = ref(false)
let disposed = false

const adapterOptions = [
  { id: 'element-plus', label: 'Element Plus', icon: PanelsTopLeft },
  { id: 'antd-vue', label: 'Ant Design Vue', icon: Boxes },
] as const

const normalizedName = computed(() => projectName.value.trim())
const pending = computed(() => submitting.value || controller.busy.value)
const canCreate = computed(() => Boolean(normalizedName.value) && !loading.value && !pending.value)

function focusName(): void {
  nameInput.value?.focus()
}

async function loadBlankTemplates(): Promise<void> {
  loading.value = true
  try {
    const result = await catalogService.load()
    if (!disposed)
      templates.value = result.templates.filter(template => template.manifest.category === 'blank' && template.surface.kind === 'page')
  }
  catch (error) {
    if (!disposed)
      ui.notify(error)
  }
  finally {
    if (!disposed)
      loading.value = false
  }
}

async function createProject(): Promise<void> {
  if (!canCreate.value)
    return
  const template = templates.value.find(candidate => candidate.manifest.adapter === selectedAdapter.value)
  if (!template) {
    ui.notify(locale.value.t('projectCreate.templateUnavailable', 'The selected adapter is unavailable.'))
    return
  }
  submitting.value = true
  ui.clearMessage()
  try {
    const created = await controller.createProjectFromTemplate(template, normalizedName.value)
    if (created && !disposed)
      emit('created')
  }
  finally {
    if (!disposed)
      submitting.value = false
  }
}

onMounted(() => {
  void loadBlankTemplates()
  if (!props.embedded)
    focusName()
})

onBeforeUnmount(() => {
  disposed = true
})

defineExpose({ focusName })
</script>

<template>
  <component
    :is="props.embedded ? 'section' : 'main'"
    class="project-creation-workspace"
    :class="{ 'project-creation-workspace--embedded': props.embedded }"
    :data-theme="ui.resolvedTheme.value"
    :data-palette="ui.paletteFamily.value"
    :aria-label="locale.t('projectCreate.title', 'Create project')"
  >
    <header v-if="!props.embedded" class="project-creation-header">
      <div class="project-creation-header__heading">
        <ElButton v-if="canClose" native-type="button" text circle :disabled="pending" :title="locale.t('projects.back', 'Back to projects')" :aria-label="locale.t('projects.back', 'Back to projects')" @click="emit('close')">
          <ArrowLeft :size="18" aria-hidden="true" />
        </ElButton>
        <FolderKanban :size="20" aria-hidden="true" />
        <h1>{{ locale.t('projectCreate.title', 'Create project') }}</h1>
      </div>
      <div class="project-creation-header__actions">
        <ElButton native-type="button" text circle :disabled="pending" :title="locale.t('locale.switch', 'Switch language')" :aria-label="locale.t('locale.switch', 'Switch language')" @click="emit('toggleLocale')">
          <Languages :size="17" aria-hidden="true" />
        </ElButton>
        <WorkbenchAppearancePopover
          trigger-class="project-creation-appearance"
          :locale="locale"
          :palette-family="ui.paletteFamily.value"
          :theme-preference="ui.themePreference.value"
          @set-palette-family="ui.setPaletteFamily"
          @set-theme-preference="ui.setThemePreference"
        />
      </div>
    </header>

    <form class="project-creation-form" @submit.prevent="createProject">
      <div class="project-creation-field">
        <label for="project-create-name">{{ locale.t('projects.name', 'Project name') }}</label>
        <ElInput
          id="project-create-name"
          ref="nameInput"
          v-model="projectName"
          maxlength="160"
          :disabled="pending"
          :placeholder="locale.t('projectCreate.namePlaceholder', 'For example: Operations console')"
          :aria-label="locale.t('projects.name', 'Project name')"
        />
      </div>

      <div class="project-creation-field">
        <span id="project-create-adapter-label">{{ locale.t('projectCreate.adapterTitle', 'UI framework') }}</span>
        <ElRadioGroup v-model="selectedAdapter" class="project-creation-adapters" :disabled="pending" aria-labelledby="project-create-adapter-label">
          <ElRadio v-for="option in adapterOptions" :key="option.id" class="project-creation-adapter" border :value="option.id">
            <component :is="option.icon" :size="18" aria-hidden="true" />
            <span>{{ option.label }}</span>
          </ElRadio>
        </ElRadioGroup>
      </div>

      <ElAlert v-if="ui.message.value" :title="ui.message.value" type="error" show-icon closable @close="ui.clearMessage" />

      <footer class="project-creation-footer">
        <ElButton v-if="canClose && props.embedded" native-type="button" :disabled="pending" @click="emit('close')">{{ locale.t('action.cancel', 'Cancel') }}</ElButton>
        <ElButton native-type="submit" type="primary" data-project-create-submit :loading="submitting" :disabled="!canCreate">
          <FolderKanban :size="16" aria-hidden="true" />
          {{ locale.t('projectCreate.action', 'Create project') }}
        </ElButton>
      </footer>
    </form>
  </component>
</template>
