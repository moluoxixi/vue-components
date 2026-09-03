import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { ComputedRef, Ref } from 'vue'
import type { DesignerController } from '../../../composables'
import type { DesignerDropTarget } from '../../../graph'
import type { DesignerNodeAction, DesignSurfaceProps } from '../types'
import { computed, nextTick } from 'vue'
import {
  createFormCommand,
  createMoveCommand,
  createNodePathCommand,
  createResizeCommand,
  createStoredConfigRemovalCommand,
} from '../../../graph'

type WorkspaceMode = 'desktop' | 'medium' | 'narrow'
type WorkspaceView = 'canvas' | 'palette' | 'properties'

interface UseDesignSurfaceCommandsOptions {
  activeBreakpoint: Ref<ConfigFormBreakpoint>
  activeWorkspaceView: Ref<WorkspaceView>
  closeMediumPanel: (view: 'palette' | 'properties') => void
  controller: DesignerController
  deletedNotice: () => string
  historyControl: () => DesignSurfaceProps['historyControl']
  lastAcceptedCommandId: () => string | undefined
  mediumPanel: Ref<'palette' | 'properties' | undefined>
  onNotice: (message: string, action: () => boolean) => void
  pageId: () => string
  readonly: () => boolean
  rootRef: Ref<HTMLElement | undefined>
  selectBreakpoint: (breakpoint: ConfigFormBreakpoint) => void
  workspaceMode: ComputedRef<WorkspaceMode>
}

interface DeletionUndoTarget {
  entryId?: string
  position?: number
  transitionSequence: number
}

export function useDesignSurfaceCommands(options: UseDesignSurfaceCommandsOptions) {
  let historyTransitionSequence = 0

  async function focusNode(nodeId?: string): Promise<void> {
    if (!nodeId)
      return
    await nextTick()
    const target = [...(options.rootRef.value?.querySelectorAll<HTMLElement>('[data-editor-focus-node-id]') ?? [])]
      .find(element => element.dataset.editorFocusNodeId === nodeId)
    target?.focus()
  }

  function dispatch(command: ProjectCommand): boolean {
    const changed = options.controller.dispatch(command)
    void focusNode(options.controller.selectedId.value)
    return changed
  }

  function handleUndo(): boolean {
    const changed = options.historyControl().undo()
    if (changed)
      historyTransitionSequence += 1
    void focusNode(options.controller.selectedId.value)
    return changed
  }

  function handleRedo(): boolean {
    const changed = options.historyControl().redo()
    if (changed)
      historyTransitionSequence += 1
    void focusNode(options.controller.selectedId.value)
    return changed
  }

  function handleMove(nodeId: string, target: DesignerDropTarget): void {
    options.controller.select(nodeId)
    dispatch(createMoveCommand(options.pageId(), nodeId, target))
  }

  function showCanvasOrProperties(): void {
    if (options.workspaceMode.value === 'narrow')
      options.activeWorkspaceView.value = 'canvas'
    else if (options.workspaceMode.value === 'medium')
      options.mediumPanel.value = 'properties'
  }

  function handleAddMaterial(materialKey: string, target: DesignerDropTarget): void {
    if (options.controller.addMaterial(materialKey, target))
      showCanvasOrProperties()
  }

  function addMaterial(materialKey: string, target?: DesignerDropTarget): boolean {
    const changed = options.controller.addMaterial(materialKey, target)
    if (changed)
      showCanvasOrProperties()
    return changed
  }

  function handleCanvasSelect(nodeId?: string, mode: 'range' | 'replace' | 'toggle' = 'replace'): void {
    options.controller.select(nodeId, mode)
    if (nodeId && options.workspaceMode.value === 'medium')
      options.mediumPanel.value = 'properties'
  }

  function handleResize(nodeId: string, span: number): void {
    options.controller.select(nodeId)
    dispatch(createResizeCommand(options.pageId(), nodeId, span))
  }

  function handleUpdatePath(nodeId: string, path: string[], value: unknown): void {
    dispatch(createNodePathCommand(options.controller.graph.value, options.pageId(), [nodeId], path, value))
  }

  function handleUpdatePaths(nodeIds: string[], path: string[], value: unknown): void {
    dispatch(createNodePathCommand(options.controller.graph.value, options.pageId(), nodeIds, path, value))
  }

  function handleRemoveStoredConfig(nodeId: string, path: string[]): void {
    dispatch(createStoredConfigRemovalCommand(options.pageId(), nodeId, path))
  }

  function handleUpdateForm(changes: Record<string, unknown>): void {
    dispatch(createFormCommand(options.controller.graph.value, options.pageId(), changes))
  }

  function deletionUndoTarget(positionBefore?: number): DeletionUndoTarget {
    const history = options.historyControl().history
    const position = positionBefore === undefined
      ? undefined
      : Math.min(positionBefore + 1, history?.limit ?? positionBefore + 1)
    const entryId = options.lastAcceptedCommandId()
    return {
      ...(entryId ? { entryId } : {}),
      ...(position === undefined ? {} : { position }),
      transitionSequence: historyTransitionSequence,
    }
  }

  function announceDeletionUndo(target: DeletionUndoTarget): void {
    void nextTick(() => {
      const history = options.historyControl().history
      const acceptedEntry = history && history.position > 0
        ? history.entries[history.position - 1]
        : undefined
      const acceptedTarget = acceptedEntry
        ? { ...target, entryId: acceptedEntry.id, position: history?.position }
        : target
      options.onNotice(options.deletedNotice(), () => {
        if (acceptedTarget.transitionSequence !== historyTransitionSequence)
          return false
        const currentHistory = options.historyControl().history
        if (currentHistory && acceptedTarget.entryId) {
          const currentEntryId = currentHistory.position > 0
            ? currentHistory.entries[currentHistory.position - 1]?.id
            : undefined
          if (currentEntryId !== acceptedTarget.entryId)
            return false
        }
        else if (acceptedTarget.position !== undefined && currentHistory?.position !== acceptedTarget.position) {
          return false
        }
        return handleUndo()
      })
    })
  }

  function handleAction(action: DesignerNodeAction, nodeId: string): void {
    if (!options.controller.selectedIds.value.includes(nodeId))
      options.controller.select(nodeId)
    const positionBefore = options.historyControl().history?.position
    const changed = options.controller.performNodeAction(action, nodeId)
    if (changed && action === 'remove')
      announceDeletionUndo(deletionUndoTarget(positionBefore))
    void focusNode(options.controller.selectedId.value)
  }

  function handleSelectionAction(action: 'copy' | 'remove'): boolean {
    const nodeId = options.controller.selectedId.value
    if (!nodeId)
      return false
    const positionBefore = options.historyControl().history?.position
    const changed = options.controller.performNodeAction(action, nodeId)
    if (changed && action === 'remove')
      announceDeletionUndo(deletionUndoTarget(positionBefore))
    void focusNode(options.controller.selectedId.value)
    return changed
  }

  function isTextEditingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
      return false
    return target.isContentEditable
      || Boolean(target.closest('[contenteditable="true"]'))
      || Boolean(target.closest('[data-workspace-panel="properties"]'))
      || ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(target.tagName)
  }

  function handleRootKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing || options.readonly() || isTextEditingTarget(event.target))
      return
    if (event.key === 'Escape' && options.workspaceMode.value === 'medium' && options.mediumPanel.value) {
      event.preventDefault()
      options.closeMediumPanel(options.mediumPanel.value)
      return
    }
    const modifier = event.ctrlKey || event.metaKey
    if ((event.key === 'Delete' || event.key === 'Backspace') && !modifier && !event.altKey) {
      event.preventDefault()
      handleSelectionAction('remove')
      return
    }
    if (!modifier)
      return
    if (event.key.toLowerCase() === 'z' && !event.altKey) {
      event.preventDefault()
      event.shiftKey ? handleRedo() : handleUndo()
    }
    else if (event.key.toLowerCase() === 'y'
      && event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      handleRedo()
    }
    else if (event.key.toLowerCase() === 'd' && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      handleSelectionAction('copy')
    }
  }

  const toolbarScope = computed(() => ({
    breakpoint: options.activeBreakpoint.value,
    canUndo: options.historyControl().canUndo,
    canRedo: options.historyControl().canRedo,
    canEditSelection: !options.readonly() && options.controller.selectedIds.value.length > 0,
    readonly: options.readonly(),
    copySelection: () => handleSelectionAction('copy'),
    removeSelection: () => handleSelectionAction('remove'),
    selectBreakpoint: options.selectBreakpoint,
    undo: handleUndo,
    redo: handleRedo,
  }))

  return {
    addMaterial,
    handleAction,
    handleAddMaterial,
    handleCanvasSelect,
    handleMove,
    handleRedo,
    handleRemoveStoredConfig,
    handleResize,
    handleRootKeydown,
    handleUndo,
    handleUpdateForm,
    handleUpdatePath,
    handleUpdatePaths,
    toolbarScope,
  }
}
