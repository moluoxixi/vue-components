<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { TemplateCreationTarget } from './project'
import { nextTick, ref, watch } from 'vue'
import TemplateCreationWorkspace from './features/templates/TemplateCreationWorkspace.vue'
import WorkbenchShell from './app/WorkbenchShell.vue'
import { provideWorkbenchController } from './app/workbench-context'

const props = defineProps<{
  locale?: DesignerLocaleOptions
}>()

const { controller, ui } = provideWorkbenchController(props)
const view = ref<'create' | 'designer'>('designer')
const creationTarget = ref<TemplateCreationTarget>('project')
const returnFocusKey = ref<string>()

function openCreation(request: { focusKey: string, target: TemplateCreationTarget }): void {
  creationTarget.value = request.target
  returnFocusKey.value = request.focusKey
  view.value = 'create'
}

async function focusSelector(selector: string): Promise<void> {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  document.querySelector<HTMLElement>(selector)?.focus()
}

function closeCreation(created = false): void {
  if (!controller.currentProject.value)
    return
  const focusKey = returnFocusKey.value
  if (created)
    ui.closePageManager()
  view.value = 'designer'
  if (!created && focusKey && ui.pageManagerOpen.value)
    return
  returnFocusKey.value = undefined
  void focusSelector(created || !focusKey
    ? '[data-designer-entry]'
    : `[data-create-trigger="${focusKey}"]`)
}

watch(
  () => [controller.initialized.value, controller.currentProject.value?.id] as const,
  ([initialized, projectId]) => {
    if (!initialized || projectId || view.value === 'create')
      return
    creationTarget.value = 'project'
    returnFocusKey.value = undefined
    view.value = 'create'
  },
  { immediate: true },
)
</script>

<template>
  <TemplateCreationWorkspace
    v-if="view === 'create'"
    :can-close="Boolean(controller.currentProject.value)"
    :locale="controller.localeOptions.value"
    :target="creationTarget"
    :theme="ui.theme.value"
    @close="closeCreation()"
    @created="closeCreation(true)"
    @toggle-locale="ui.toggleLocale"
    @toggle-theme="ui.toggleTheme"
  />
  <WorkbenchShell
    v-else
    :creation-return-focus-key="returnFocusKey"
    @create="openCreation"
    @creation-focus-restored="returnFocusKey = undefined"
  />
</template>
