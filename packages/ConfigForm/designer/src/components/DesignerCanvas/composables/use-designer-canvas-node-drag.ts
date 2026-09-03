import type { DesignerDragController, DesignerDragSession, DesignerRuntimeNodeGeometry } from '../types'
import { onBeforeUnmount, watch } from 'vue'

interface UseDesignerCanvasNodeDragOptions {
  activeSession: () => DesignerDragSession | undefined
  clearDragOverlay: () => void
  closeNodeActionMenu: () => void
  dragController: DesignerDragController | undefined
  readonly: () => boolean
  runtimeNodeGeometryById: (nodeId: string) => DesignerRuntimeNodeGeometry | undefined
  stopCanvasAutoScroll: () => void
}

export function useDesignerCanvasNodeDrag(options: UseDesignerCanvasNodeDragOptions) {
  let activeDragPointer: number | undefined
  let activeDragPointerTarget: HTMLElement | undefined

  function handleNodeDragMove(event: PointerEvent): void {
    if (event.pointerId !== activeDragPointer)
      return
    if (options.dragController?.move({ x: event.clientX, y: event.clientY }))
      event.preventDefault()
  }

  function cleanupNodeDrag(): void {
    activeDragPointerTarget?.removeEventListener('lostpointercapture', handleNodeLostPointerCapture)
    if (activeDragPointer !== undefined && activeDragPointerTarget?.hasPointerCapture?.(activeDragPointer))
      activeDragPointerTarget.releasePointerCapture(activeDragPointer)
    activeDragPointer = undefined
    activeDragPointerTarget = undefined
    options.stopCanvasAutoScroll()
    window.removeEventListener('pointermove', handleNodeDragMove)
    window.removeEventListener('pointerup', handleNodeDragEnd)
    window.removeEventListener('pointercancel', handleNodeDragCancel)
  }

  function handleNodeLostPointerCapture(event: PointerEvent): void {
    if (event.pointerId !== activeDragPointer)
      return
    options.dragController?.cancel()
    cleanupNodeDrag()
  }

  function handleNodeDragEnd(event: PointerEvent): void {
    if (event.pointerId !== activeDragPointer)
      return
    options.dragController?.finish({ x: event.clientX, y: event.clientY })
    cleanupNodeDrag()
  }

  function handleNodeDragCancel(event: PointerEvent): void {
    if (event.pointerId !== activeDragPointer)
      return
    options.dragController?.cancel()
    cleanupNodeDrag()
  }

  function beginNodeDrag(event: PointerEvent, nodeId: string): void {
    if (options.readonly() || !options.dragController || event.button !== 0)
      return
    options.closeNodeActionMenu()
    event.preventDefault()
    event.stopPropagation()
    activeDragPointer = event.pointerId
    activeDragPointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
    activeDragPointerTarget?.setPointerCapture?.(event.pointerId)
    activeDragPointerTarget?.addEventListener('lostpointercapture', handleNodeLostPointerCapture)
    const point = { x: event.clientX, y: event.clientY }
    const sourceRect = options.runtimeNodeGeometryById(nodeId)?.rect
    const pointerOffset = sourceRect
      && point.x >= sourceRect.left && point.x <= sourceRect.right
      && point.y >= sourceRect.top && point.y <= sourceRect.bottom
      ? { x: point.x - sourceRect.left, y: point.y - sourceRect.top }
      : { x: 16, y: 16 }
    options.dragController.beginNode(nodeId, point, pointerOffset)
    window.addEventListener('pointermove', handleNodeDragMove, { passive: false })
    window.addEventListener('pointerup', handleNodeDragEnd)
    window.addEventListener('pointercancel', handleNodeDragCancel)
  }

  function beginNodeKeyboard(nodeId: string): void {
    if (!options.readonly())
      options.dragController?.beginNodeKeyboard(nodeId)
  }

  function handleActiveDragKeydown(event: KeyboardEvent): boolean {
    const session = options.activeSession()
    if (session?.input !== 'keyboard' || !session.active)
      return false
    if (event.key === 'Escape') {
      event.preventDefault()
      options.dragController?.cancel()
    }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      options.dragController?.finishKeyboard()
    }
    else if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      options.dragController?.moveKeyboard(event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 'next' : 'previous')
    }
    return true
  }

  function handleNodeDragHandleKeydown(event: KeyboardEvent, nodeId: string): void {
    const session = options.activeSession()
    const keyboardSession = session?.input === 'keyboard' && session.active
    if (event.key === 'Escape' && keyboardSession) {
      event.preventDefault()
      event.stopPropagation()
      options.dragController?.cancel()
      return
    }
    if (event.key.startsWith('Arrow') && keyboardSession) {
      event.preventDefault()
      event.stopPropagation()
      options.dragController?.moveKeyboard(event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 'next' : 'previous')
      return
    }
    if (event.key !== ' ')
      return
    event.preventDefault()
    event.stopPropagation()
    if (keyboardSession)
      options.dragController?.finishKeyboard()
    else
      beginNodeKeyboard(nodeId)
  }

  function isNodeKeyboardDragging(nodeId: string): boolean {
    const session = options.activeSession()
    return Boolean(session?.active && session.input === 'keyboard' && session.source.type === 'node' && session.source.nodeId === nodeId)
  }

  watch(options.readonly, (readonly) => {
    if (!readonly)
      return
    options.dragController?.cancel()
    cleanupNodeDrag()
    options.clearDragOverlay()
  })

  onBeforeUnmount(cleanupNodeDrag)

  return {
    beginNodeDrag,
    beginNodeKeyboard,
    handleActiveDragKeydown,
    handleNodeDragHandleKeydown,
    isNodeKeyboardDragging,
  }
}
