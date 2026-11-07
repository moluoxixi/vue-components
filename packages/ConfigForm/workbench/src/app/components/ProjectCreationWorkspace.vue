<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { InputInstance } from 'element-plus'
import type { WorkbenchAdapterId } from '../../adapters'
import { ArrowLeft, Boxes, FolderKanban, Languages, PanelsTopLeft } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import ControlHint from '../../components/ControlHint.vue'
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
const nameInput = useTemplateRef<InputInstance>('nameInput')
const projectName = ref('')
const selectedAdapter = ref<WorkbenchAdapterId>('element-plus')
const submitting = ref(false)
let disposed = false

const adapterOptions = [
  { id: 'element-plus', label: 'Element Plus', icon: PanelsTopLeft },
  { id: 'antd-vue', label: 'Ant Design Vue', icon: Boxes },
] as const

const normalizedName = computed(() => projectName.value.trim())
const pending = computed(() => submitting.value || controller.busy.value)
const canCreate = computed(() => Boolean(normalizedName.value) && !pending.value)
const pendingReason = computed(() => pending.value ? locale.value.t('action.busyUnavailable', 'Wait for the current operation to finish') : undefined)

function focusName(): void {
  nameInput.value?.focus()
}

async function createProject(): Promise<void> {
  if (!canCreate.value)
    return
  submitting.value = true
  ui.clearMessage()
  try {
    const created = await controller.createProject(normalizedName.value, selectedAdapter.value)
    if (created && !disposed)
      emit('created')
  }
  finally {
    if (!disposed)
      submitting.value = false
  }
}

onMounted(() => {
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
        <ControlHint v-if="canClose" :reason="pendingReason">
          <ElButton
            native-type="button"
            text
            circle
            :disabled="pending"
            :title="locale.t('projects.back', 'Back to projects')"
            :aria-label="locale.t('projects.back', 'Back to projects')"
            @click="emit('close')"
          >
            <ArrowLeft :size="18" aria-hidden="true" />
          </ElButton>
        </ControlHint>
        <FolderKanban :size="20" aria-hidden="true" />
        <h1>{{ locale.t('projectCreate.title', 'Create project') }}</h1>
      </div>
      <div class="project-creation-header__actions">
        <ControlHint :reason="pendingReason">
          <ElButton
            native-type="button"
            text
            circle
            :disabled="pending"
            :title="locale.t('locale.switch', 'Switch language')"
            :aria-label="locale.t('locale.switch', 'Switch language')"
            @click="emit('toggleLocale')"
          >
            <Languages :size="17" aria-hidden="true" />
          </ElButton>
        </ControlHint>
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
        <ControlHint :reason="pendingReason">
          <ElInput
            id="project-create-name"
            ref="nameInput"
            v-model="projectName"
            maxlength="160"
            :disabled="pending"
            :placeholder="locale.t('projectCreate.namePlaceholder', 'For example: Operations console')"
            :aria-label="locale.t('projects.name', 'Project name')"
          />
        </ControlHint>
      </div>

      <div class="project-creation-field">
        <span id="project-create-adapter-label">{{ locale.t('projectCreate.adapterTitle', 'UI framework') }}</span>
        <ControlHint :reason="pendingReason">
          <ElRadioGroup
            v-model="selectedAdapter"
            class="project-creation-adapters"
            :disabled="pending"
            aria-labelledby="project-create-adapter-label"
          >
            <ElRadio v-for="option in adapterOptions" :key="option.id" class="project-creation-adapter" border :value="option.id">
              <component :is="option.icon" :size="18" aria-hidden="true" />
              <span>{{ option.label }}</span>
            </ElRadio>
          </ElRadioGroup>
        </ControlHint>
      </div>

      <ElAlert v-if="ui.message.value" :title="ui.message.value" type="error" show-icon closable @close="ui.clearMessage" />

      <footer class="project-creation-footer">
        <ControlHint v-if="canClose && props.embedded" :reason="pendingReason">
          <ElButton native-type="button" :disabled="pending" @click="emit('close')">{{ locale.t('action.cancel', 'Cancel') }}</ElButton>
        </ControlHint>
        <ControlHint
          :reason="
            pendingReason ||
            (!normalizedName ? locale.t('projectCreate.nameRequired', 'Enter a project name to create the project.') : undefined)
          "
        >
          <ElButton native-type="submit" type="primary" data-project-create-submit :loading="submitting" :disabled="!canCreate">
            <FolderKanban :size="16" aria-hidden="true" />
            {{ locale.t('projectCreate.action', 'Create project') }}
          </ElButton>
        </ControlHint>
      </footer>
    </form>
  </component>
</template>
