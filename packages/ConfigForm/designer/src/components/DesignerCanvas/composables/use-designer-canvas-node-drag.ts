import type { DesignerDragController, DesignerDragSession, DesignerRuntimeNodeGeometry } from '../types'
import { onBeforeUnmount, watch } from 'vue'
import { captureDesignerPointer } from '../services'

interface UseDesignerCanvasNodeDragOptions {
  activeSession: () => DesignerDragSession | undefined
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
    window.removeEventListener('keydown', handleNodeDragEscape, true)
  }

  function handleNodeDragEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape')
      return
    event.preventDefault()
    event.stopPropagation()
    options.dragController?.cancel()
    cleanupNodeDrag()
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

  function attachNodeDragListeners(): void {
    window.addEventListener('pointermove', handleNodeDragMove, { passive: false })
    window.addEventListener('pointerup', handleNodeDragEnd)
    window.addEventListener('pointercancel', handleNodeDragCancel)
    window.addEventListener('keydown', handleNodeDragEscape, true)
  }

  function nodeDragPointerOffset(nodeId: string, point: { x: number, y: number }): { x: number, y: number } {
    const sourceRect = options.runtimeNodeGeometryById(nodeId)?.rect
    return sourceRect
      && point.x >= sourceRect.left && point.x <= sourceRect.right
      && point.y >= sourceRect.top && point.y <= sourceRect.bottom
      ? { x: point.x - sourceRect.left, y: point.y - sourceRect.top }
      : { x: 16, y: 16 }
  }

  function beginNodeDrag(event: PointerEvent, nodeId: string): void {
    if (options.readonly() || !options.dragController || event.button !== 0)
      return
    options.closeNodeActionMenu()
    event.preventDefault()
    event.stopPropagation()
    activeDragPointer = event.pointerId
    activeDragPointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
    captureDesignerPointer(activeDragPointerTarget, event.pointerId)
    activeDragPointerTarget?.addEventListener('lostpointercapture', handleNodeLostPointerCapture)
    const point = { x: event.clientX, y: event.clientY }
    options.dragController.beginNode(nodeId, point, nodeDragPointerOffset(nodeId, point))
    attachNodeDragListeners()
  }

  // The iframe runtime arms node drags on its own pointer stream; once the
  // activation distance is crossed it hands over here. The session starts
  // active because the threshold was already met inside the frame, and the
  // drag overlay then covers the iframe so the window listeners take over.
  function beginRuntimeNodeDrag(nodeId: string, point: { x: number, y: number }, pointerId: number): void {
    if (options.readonly() || !options.dragController)
      return
    options.closeNodeActionMenu()
    activeDragPointer = pointerId
    activeDragPointerTarget = undefined
    options.dragController.beginNode(nodeId, point, nodeDragPointerOffset(nodeId, point))
    options.dragController.move(point)
    attachNodeDragListeners()
  }

  // Runtime-forwarded pointer ends double as a safety net for releases that
  // land inside the iframe before the drag overlay mounts.
  function finishRuntimeNodeDrag(point: { x: number, y: number }, pointerId: number): void {
    if (pointerId !== activeDragPointer)
      return
    options.dragController?.finish(point)
    cleanupNodeDrag()
  }

  function cancelRuntimeNodeDrag(pointerId: number): void {
    if (pointerId !== activeDragPointer)
      return
    options.dragController?.cancel()
    cleanupNodeDrag()
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
  })

  onBeforeUnmount(cleanupNodeDrag)

  return {
    beginNodeDrag,
    beginNodeKeyboard,
    beginRuntimeNodeDrag,
    cancelRuntimeNodeDrag,
    finishRuntimeNodeDrag,
    handleActiveDragKeydown,
    handleNodeDragHandleKeydown,
    isNodeKeyboardDragging,
  }
}
