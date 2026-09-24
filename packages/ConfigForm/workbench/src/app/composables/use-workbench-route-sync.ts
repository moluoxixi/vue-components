import type { WorkbenchRouteSyncOptions } from '../types'
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  hasWorkbenchPage,
  isProjectRouteName,
  pageDesignPath,
  projectPagesPath,
  projectsPath,
  readWorkbenchRouteTarget,
  shouldBlockProjectSwitch,
} from '../router'

/**
 * Makes the URL the single owner of "which project and which page are open".
 *
 * Responsibilities:
 * - the route opens the project and page it names once the repository is ready;
 * - an unknown project falls back to the projects list, and a page that no longer
 *   exists falls back to page management;
 * - a page selection made inside the designer rewrites the design URL;
 * - switching projects is refused while the current project has unsaved work.
 */
export function useWorkbenchRouteSync(options: WorkbenchRouteSyncOptions): void {
  const { controller, ui } = options
  const route = useRoute()
  const router = useRouter()
  const hasUnsavedChanges = computed(() => controller.dirty.value || Boolean(controller.configError.value))
  const openProjectId = computed(() => controller.currentProject.value?.id)
  let reconciling = false

  function notify(message: string): void {
    ui.notify(message)
  }

  function blockedMessage(): string {
    return controller.workbenchLocale.value.t(
      'workbench.openBlocked',
      'Save or resolve the current project before opening another project.',
    )
  }

  function missingProjectMessage(): string {
    return controller.workbenchLocale.value.t(
      'workbench.projectUnavailable',
      'This project is unavailable in local storage. It may have been deleted in another session.',
    )
  }

  function missingPageMessage(): string {
    return controller.workbenchLocale.value.t(
      'workbench.pageUnavailable',
      'That page is no longer part of this project. Showing the page list instead.',
    )
  }

  async function replacePath(path: string): Promise<void> {
    if (route.path !== path)
      await router.replace(path)
  }

  async function reconcileFromRoute(): Promise<void> {
    if (reconciling)
      return
    const target = readWorkbenchRouteTarget(route)
    if (!target.projectId)
      return
    reconciling = true
    try {
      if (openProjectId.value !== target.projectId) {
        if (shouldBlockProjectSwitch({
          hasUnsavedChanges: hasUnsavedChanges.value,
          openProjectId: openProjectId.value,
          targetProjectId: target.projectId,
        })) {
          notify(blockedMessage())
          const openId = openProjectId.value
          const openPageId = controller.currentSurfaceId.value
          if (openId)
            await replacePath(openPageId ? pageDesignPath(openId, openPageId) : projectPagesPath(openId))
          return
        }
        await controller.requestOpenProject(target.projectId)
        if (openProjectId.value !== target.projectId) {
          notify(missingProjectMessage())
          await replacePath(projectsPath())
          return
        }
      }
      // Only the designer names a page; page management and page creation keep
      // their own URL while the same project stays open.
      if (route.name !== 'page-design')
        return
      const requested = target.pageId
      const document = controller.currentProject.value
      if (!requested || !document)
        return
      // The session may not have published a just-created page yet, so a page the
      // workspace already selected is authoritative.
      if (controller.currentSurfaceId.value === requested)
        return
      if (!hasWorkbenchPage(document, requested)) {
        notify(missingPageMessage())
        await replacePath(projectPagesPath(document.id))
        return
      }
      await controller.selectSurfaceFromDesigner(requested)
    }
    finally {
      reconciling = false
    }
  }

  /**
   * Guards project switching before the URL commits to another project, so a
   * refused navigation never leaves the workspace and the URL out of sync.
   */
  const stopGuarding = router.beforeEach((to) => {
    const target = readWorkbenchRouteTarget(to)
    if (!shouldBlockProjectSwitch({
      hasUnsavedChanges: hasUnsavedChanges.value,
      openProjectId: openProjectId.value,
      targetProjectId: target.projectId,
    })) {
      return true
    }
    notify(blockedMessage())
    return false
  })

  watch(() => controller.initialized.value, (ready) => {
    if (ready)
      void reconcileFromRoute()
  }, { immediate: true })

  watch(
    () => [route.name, route.params.projectId, route.params.pageId],
    () => {
      if (controller.initialized.value)
        void reconcileFromRoute()
    },
  )

  /**
   * Keeps the design URL canonical: choosing another page inside the designer
   * rewrites the path once the workspace has settled. A URL that names a page the
   * project no longer has stays untouched, so it can return to page management.
   */
  watch(
    () => [route.name, openProjectId.value, controller.currentSurfaceId.value],
    () => {
      if (reconciling)
        return
      if (route.name !== 'page-design')
        return
      const projectId = openProjectId.value
      const pageId = controller.currentSurfaceId.value
      const document = controller.currentProject.value
      if (!projectId || !pageId || !document)
        return
      const routed = readWorkbenchRouteTarget(route).pageId
      if (!routed || routed === pageId || !hasWorkbenchPage(document, routed))
        return
      void replacePath(pageDesignPath(projectId, pageId))
    },
  )

  /**
   * A project can be closed from inside the workspace (delete, or a resolved
   * recovery draft). Project routes then have no workspace and return to the list.
   */
  watch(openProjectId, (projectId) => {
    if (reconciling || !controller.initialized.value)
      return
    if (!projectId && isProjectRouteName(route.name))
      void replacePath(projectsPath())
  })

  onBeforeUnmount(stopGuarding)
}
