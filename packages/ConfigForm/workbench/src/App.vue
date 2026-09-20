<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { TemplateCreationTarget } from './project'
import { nextTick, ref, watch } from 'vue'
import { provideWorkbenchController, TemplateCreationWorkspace, WorkbenchAppearanceDrawer, WorkbenchShell } from './app'
import { ProjectManager } from './features/projects'

const props = defineProps<{
  locale?: DesignerLocaleOptions
}>()

const { controller, ui } = provideWorkbenchController(props)
const view = ref<'projects' | 'create' | 'designer'>('projects')
const returnView = ref<'projects' | 'designer'>('projects')
const creationTarget = ref<TemplateCreationTarget>('project')
const creationMode = ref<'json' | 'template'>('template')
const returnFocusKey = ref<string>()

function openCreation(request: { focusKey: string, target: TemplateCreationTarget }): void {
  returnView.value = view.value === 'designer' ? 'designer' : 'projects'
  creationTarget.value = request.target
  creationMode.value = 'template'
  returnFocusKey.value = request.focusKey
  view.value = 'create'
}

function openProjectCreation(mode: 'json' | 'template'): void {
  returnView.value = 'projects'
  creationTarget.value = 'project'
  creationMode.value = mode
  returnFocusKey.value = 'project-manager-create'
  view.value = 'create'
}

async function focusSelector(selector: string): Promise<void> {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  document.querySelector<HTMLElement>(selector)?.focus()
}

function closeCreation(created = false): void {
  if (!created && returnView.value === 'projects') {
    view.value = 'projects'
    return
  }
  if (!controller.currentProject.value) {
    view.value = 'projects'
    return
  }
  const focusKey = returnFocusKey.value
  if (created)
    ui.closeSurfaceManager()
  view.value = created ? 'designer' : returnView.value
  if (!created && focusKey && ui.pageManagerOpen.value)
    return
  returnFocusKey.value = undefined
  void focusSelector(created || !focusKey
    ? '[data-designer-entry]'
    : `[data-create-trigger="${focusKey}"]`)
}

watch(() => controller.currentProject.value?.id, projectId => {
  if (!projectId && view.value === 'designer')
    view.value = 'projects'
})
</script>

<template>
  <ProjectManager
    v-if="view === 'projects'"
    :controller="controller"
    :ui="ui"
    @create="openProjectCreation"
    @open="view = 'designer'"
  />
  <TemplateCreationWorkspace
    v-else-if="view === 'create'"
    :can-close="true"
    :initial-mode="creationMode"
    :locale="controller.localeOptions.value"
    :target="creationTarget"
    @close="closeCreation()"
    @created="closeCreation(true)"
    @toggle-locale="ui.toggleLocale"
  />
  <WorkbenchShell
    v-else
    :creation-return-focus-key="returnFocusKey"
    @create="openCreation"
    @creation-focus-restored="returnFocusKey = undefined"
    @exit="view = 'projects'"
  />
  <WorkbenchAppearanceDrawer
    :open="ui.appearanceDrawerOpen.value"
    :locale="controller.localeOptions.value"
    :palette-family="ui.paletteFamily.value"
    :theme-preference="ui.themePreference.value"
    @close="ui.closeAppearanceDrawer"
    @set-palette-family="ui.setPaletteFamily"
    @set-theme-preference="ui.setThemePreference"
  />
</template>
