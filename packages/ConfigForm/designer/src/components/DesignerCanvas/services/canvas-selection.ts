import type { DesignerRuntimeNodeGeometry } from '../types'
import type { DesignerCanvasEmits } from '../types/emits'

interface DesignerCanvasSelectionOptions {
  beginNodeKeyboard: (nodeId: string) => void
  candidateId: () => string | undefined
  focusNode: (nodeId: string) => void | Promise<void>
  handleActiveDragKeydown: (event: KeyboardEvent) => boolean
  hitNodeElements: (point: { x: number, y: number }, candidateId: string) => DesignerRuntimeNodeGeometry[]
  interactive: () => boolean
  onAction: (...args: DesignerCanvasEmits['action']) => void
  onSelect: (...args: DesignerCanvasEmits['select']) => void
  selectedId: () => string | undefined
}

export function createDesignerCanvasSelection(options: DesignerCanvasSelectionOptions) {
  function nodeIdFromEvent(event: Event): string | undefined {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-config-node-id]')
      : undefined
    const directNodeId = target?.dataset.configNodeId
    if (directNodeId && directNodeId !== options.candidateId())
      return directNodeId
    if (!('clientX' in event) || !('clientY' in event)
      || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
      return undefined
    }
    const nodeId = options.hitNodeElements(
      { x: event.clientX, y: event.clientY },
      options.candidateId() ?? '',
    )[0]?.nodeId
    return nodeId && nodeId !== options.candidateId() ? nodeId : undefined
  }

  function dragHandleNodeIdFromEvent(event: Event): string | undefined {
    return event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-designer-drag-node-id]')?.dataset.designerDragNodeId
      : undefined
  }

  function selectionMode(event: MouseEvent | PointerEvent): DesignerCanvasEmits['select'][1] {
    return event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'replace'
  }

  function isEditorControlEvent(event: Event): boolean {
    return event.target instanceof Element && Boolean(event.target.closest('[data-designer-editor-control]'))
  }

  function handleCanvasPointerDown(event: PointerEvent): void {
    if (isEditorControlEvent(event))
      return
    const nodeId = dragHandleNodeIdFromEvent(event) ?? nodeIdFromEvent(event)
    if (nodeId)
      options.onSelect(nodeId, selectionMode(event))
    else
      options.onSelect('')
    if (!options.interactive()) {
      event.preventDefault()
      if (nodeId)
        void options.focusNode(nodeId)
    }
  }

  function handleCanvasClick(event: MouseEvent): void {
    if (!isEditorControlEvent(event) && !nodeIdFromEvent(event))
      options.onSelect('')
  }

  function handleCanvasSelectStart(event: Event): void {
    if (!options.interactive())
      event.preventDefault()
  }

  function handleCanvasKeydown(event: KeyboardEvent): void {
    if (dragHandleNodeIdFromEvent(event) || isEditorControlEvent(event))
      return
    if (options.handleActiveDragKeydown(event))
      return
    if (options.interactive())
      return
    const nodeId = nodeIdFromEvent(event) ?? options.selectedId()
    if (!nodeId)
      return
    if (event.key === 'Enter') {
      event.preventDefault()
      options.onSelect(nodeId, event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'replace')
    }
    else if (event.key === ' ') {
      event.preventDefault()
      options.beginNodeKeyboard(nodeId)
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault()
      options.onAction('moveBefore', nodeId)
    }
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      options.onAction('moveAfter', nodeId)
    }
    else if (event.key === 'ArrowRight') {
      event.preventDefault()
      options.onAction('indent', nodeId)
    }
    else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      options.onAction('outdent', nodeId)
    }
    else if (event.key === 'Delete') {
      event.preventDefault()
      options.onAction('remove', nodeId)
    }
  }

  return {
    handleCanvasClick,
    handleCanvasKeydown,
    handleCanvasPointerDown,
    handleCanvasSelectStart,
  }
}
