<script setup lang="ts">
import type { TemplateCreationTarget } from '../../project'
import { nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchController, useWorkbenchUiStore } from '../composables'
import { pageDesignPath, projectPagesPath, projectsPath } from '../router'
import TemplateCreationWorkspace from './TemplateCreationWorkspace/index.vue'

const props = defineProps<{
  mode: 'json' | 'template'
  target: TemplateCreationTarget
}>()

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()

/**
 * Where the designer of the workspace's current page lives, or the page list when
 * no page is selected yet. Undefined without an open project.
 */
function workspacePath(): string | undefined {
  const projectId = controller.currentProject.value?.id
  if (!projectId)
    return undefined
  const pageId = controller.currentSurfaceId.value
  return pageId ? pageDesignPath(projectId, pageId) : projectPagesPath(projectId)
}

/**
 * Cancelling returns to the screen that opened the creation workspace, or to the
 * workspace the creation belongs to when it was opened from a deep link.
 */
function returnPath(): string {
  const origin = ui.creationOrigin.value?.path
  if (origin)
    return origin
  return (props.target === 'surface' ? workspacePath() : undefined) ?? projectsPath()
}

function close(): void {
  void router.push(returnPath())
}

/**
 * A created project opens its home page's designer; a created page was already
 * selected by the Surface command, so its own designer becomes the destination.
 *
 * Focus lands on the designer entry instead of the (now unmounted) creation
 * trigger, which keeps the workspace reachable by keyboard after either target.
 */
async function created(): Promise<void> {
  const path = workspacePath()
  if (!path) {
    close()
    return
  }
  ui.clearCreationOrigin()
  await router.push(path)
  await nextTick()
  document.querySelector<HTMLElement>('[data-designer-entry]')?.focus()
}
</script>

<template>
  <TemplateCreationWorkspace
    :can-close="true"
    :initial-mode="mode"
    :locale="controller.localeOptions.value"
    :target="target"
    @close="close"
    @created="created"
    @toggle-locale="ui.toggleLocale"
  />
</template>
