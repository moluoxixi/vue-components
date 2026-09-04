import type { ProjectCommandAction, ProjectDocument } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref } from 'vue'
import type { WorkbenchAdapter } from '../../adapters'
import type { ProjectEditorSessionSnapshot, ProjectPageAction } from '../../project'
import type { WorkbenchUiStore } from '../types'
import {
  duplicateProjectPage,
  nextProjectPageId,
  nextProjectPageRoute,
  preflightPreparedProject,
} from '../../project'

export function createWorkbenchPageCommands(options: {
  busy: Ref<boolean>
  currentProject: ComputedRef<ProjectEditorSessionSnapshot['document'] | undefined>
  executeProjectActions: (label: string, actions: ProjectCommandAction[], mergeKey?: string) => boolean
  selectCurrentPage: (pageId: string) => boolean
  ui: WorkbenchUiStore
}) {
  const {
    busy,
    currentProject,
    executeProjectActions,
    selectCurrentPage,
    ui,
  } = options

  function addPreparedPage(
    page: ProjectDocument['pagesById'][string],
    adapter: WorkbenchAdapter,
    document: ProjectDocument,
  ): boolean {
    const candidate = structuredClone(document) as ProjectDocument
    candidate.pageOrder.push(page.id)
    candidate.pagesById[page.id] = page
    preflightPreparedProject(candidate, adapter.registrySnapshot)
    const changed = executeProjectActions(
      'Add page',
      [{ type: 'operation.apply', operations: [{ type: 'page.add', page }] }],
    )
    if (changed)
      selectCurrentPage(page.id)
    return changed
  }

  async function handlePageAction(action: ProjectPageAction): Promise<void> {
    const document = currentProject.value
    if (!document || busy.value)
      return
    try {
      const operations = (() => {
        switch (action.type) {
          case 'page.rename': return [{ type: 'page.rename' as const, pageId: action.pageId, name: action.name }]
          case 'page.route': return [{ type: 'page.route' as const, pageId: action.pageId, route: action.route }]
          case 'page.home': return [{ type: 'project.home' as const, pageId: action.pageId }]
          case 'page.move': return [{ type: 'page.move' as const, pageId: action.pageId, index: action.index }]
          case 'page.remove': return [{ type: 'page.remove' as const, pageId: action.pageId }]
          case 'page.duplicate': {
            const source = document.pagesById[action.pageId]
            if (!source)
              throw new Error(`Page "${action.pageId}" does not exist.`)
            const name = `${source.name} copy`
            const page = duplicateProjectPage(source, {
              id: nextProjectPageId(document, name),
              name,
              route: nextProjectPageRoute(document, name),
            })
            return [{ type: 'page.add' as const, page, index: document.pageOrder.indexOf(source.id) + 1 }]
          }
        }
      })()
      executeProjectActions('Update pages', [{ type: 'operation.apply', operations }])
    }
    catch (error) {
      ui.notify(error)
    }
  }

  async function selectPageFromDesigner(pageId: string): Promise<void> {
    selectCurrentPage(pageId)
  }

  return {
    addPreparedPage,
    handlePageAction,
    selectPageFromDesigner,
  }
}
