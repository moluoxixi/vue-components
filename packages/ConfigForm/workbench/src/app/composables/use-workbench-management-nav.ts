import type { ComputedRef } from 'vue'
import type { WorkbenchManagementTarget } from '../types'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectPagesPath, projectsPath } from '../router'
import { useWorkbenchController, useWorkbenchUiStore } from './context'

/**
 * Navigation between the two management consoles.
 *
 * Page management needs a project, so its command picks the open project, or the
 * most recently updated one when nothing is open yet, and reports when the
 * workspace has no project at all instead of failing silently.
 */
export function useWorkbenchManagementNav(): {
  active: ComputedRef<WorkbenchManagementTarget | undefined>
  select: (target: WorkbenchManagementTarget) => Promise<void>
} {
  const route = useRoute()
  const router = useRouter()
  const controller = useWorkbenchController()
  const ui = useWorkbenchUiStore()

  const active = computed<WorkbenchManagementTarget | undefined>(() => {
    switch (route.name) {
      case 'projects': return 'projects'
      case 'project-pages': return 'pages'
      default: return undefined
    }
  })

  async function select(target: WorkbenchManagementTarget): Promise<void> {
    if (target === 'projects') {
      if (route.name !== 'projects')
        await router.push(projectsPath())
      return
    }

    const projectId = controller.currentProject.value?.id ?? controller.projects.value[0]?.id
    if (!projectId) {
      if (route.name !== 'projects')
        await router.push(projectsPath())
      ui.notify(controller.workbenchLocale.value.t(
        'nav.noProject',
        'Create or open a project before managing its pages.',
      ))
      return
    }

    const alreadyOpen = controller.currentProject.value?.id === projectId
      && route.name === 'project-pages'
      && route.params.projectId === projectId
    if (alreadyOpen)
      return
    if (controller.currentProject.value?.id !== projectId)
      await controller.requestOpenProject(projectId)
    if (controller.currentProject.value?.id !== projectId)
      return
    await router.push(projectPagesPath(projectId))
  }

  return { active, select }
}
