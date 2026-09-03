import type { DesignerMaterialDefinition } from '../../../registry'
import type { DesignerDragController } from '../../DesignerCanvas/types'
import type { DesignerPaletteMaterialBindings } from '../types'
import { computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { createDesignerNodeId } from '../../../graph'

interface UseDesignerPaletteDragOptions {
  dragController: DesignerDragController | undefined
  materialTitle: (material: DesignerMaterialDefinition) => string
  onAddMaterial: (materialKey: string) => void
  readonly: () => boolean | undefined
}

export function useDesignerPaletteDrag(options: UseDesignerPaletteDragOptions) {
  let activePointerId: number | undefined
  let activePointerTarget: HTMLElement | undefined
  let dragActivated = false
  let suppressClick = false
  let keyboardStartFrame: number | undefined
  let keyboardStartToken = 0

  function cancelKeyboardStart(): void {
    keyboardStartToken += 1
    if (keyboardStartFrame !== undefined)
      window.cancelAnimationFrame(keyboardStartFrame)
    keyboardStartFrame = undefined
  }

  function beginMaterialKeyboardDrag(materialKey: string): void {
    const dragController = options.dragController
    if (!dragController)
      return
    cancelKeyboardStart()
    const candidateId = createDesignerNodeId('candidate')
    const token = keyboardStartToken
    let attempts = 0
    const attempt = (): void => {
      keyboardStartFrame = undefined
      if (token !== keyboardStartToken || options.readonly() || dragController.session.value)
        return
      if (dragController.beginMaterialKeyboard(materialKey, candidateId))
        return
      if (attempts >= 30)
        return
      attempts += 1
      keyboardStartFrame = window.requestAnimationFrame(attempt)
    }
    // Canvas registers keyboard targets before paint; this bounded retry covers
    // the first compiled-page hand-off without creating a second candidate.
    void nextTick(attempt)
  }

  const keyboardDragSession = computed(() => {
    const session = options.dragController?.session.value
    return session?.active && session.input === 'keyboard' ? session : undefined
  })

  function handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId)
      return
    dragActivated = options.dragController?.move({ x: event.clientX, y: event.clientY }) ?? false
    if (dragActivated)
      event.preventDefault()
  }

  function cleanupPointerDrag(): void {
    activePointerTarget?.removeEventListener('lostpointercapture', handlePointerLostCapture)
    if (activePointerId !== undefined && activePointerTarget?.hasPointerCapture?.(activePointerId))
      activePointerTarget.releasePointerCapture(activePointerId)
    activePointerId = undefined
    activePointerTarget = undefined
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    window.removeEventListener('pointercancel', handlePointerCancel)
  }

  function handlePointerLostCapture(event: PointerEvent): void {
    if (event.pointerId !== activePointerId)
      return
    options.dragController?.cancel()
    cleanupPointerDrag()
    dragActivated = false
  }

  function handlePointerUp(event: PointerEvent): void {
    if (event.pointerId !== activePointerId)
      return
    const wasActive = dragActivated
    options.dragController?.finish({ x: event.clientX, y: event.clientY })
    cleanupPointerDrag()
    dragActivated = false
    if (!wasActive)
      return
    suppressClick = true
    window.setTimeout(() => {
      suppressClick = false
    }, 0)
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (event.pointerId !== activePointerId)
      return
    options.dragController?.cancel()
    cleanupPointerDrag()
    dragActivated = false
  }

  function prepareMaterialDrag(material: DesignerMaterialDefinition, event: PointerEvent): void {
    if (options.readonly() || event.button !== 0 || !options.dragController)
      return
    if (event.pointerType !== 'touch')
      event.preventDefault()
    options.dragController.cancel()
    activePointerId = event.pointerId
    activePointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
    activePointerTarget?.setPointerCapture?.(event.pointerId)
    activePointerTarget?.addEventListener('lostpointercapture', handlePointerLostCapture)
    dragActivated = false
    options.dragController.beginMaterial(material.key, createDesignerNodeId('candidate'), {
      x: event.clientX,
      y: event.clientY,
    })
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
  }

  function addMaterial(materialKey: string): void {
    if (options.readonly() || suppressClick)
      return
    options.onAddMaterial(materialKey)
  }

  function isMaterialKeyboardDragging(materialKey: string): boolean {
    const source = keyboardDragSession.value?.source
    return source?.type === 'material' && source.materialKey === materialKey
  }

  function handleMaterialKeydown(material: DesignerMaterialDefinition, event: KeyboardEvent): void {
    if (options.readonly())
      return

    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      options.dragController?.cancel()
      addMaterial(material.key)
      return
    }

    const keyboardSession = keyboardDragSession.value
    if (event.key === 'Escape' && keyboardSession) {
      event.preventDefault()
      event.stopPropagation()
      cancelKeyboardStart()
      options.dragController?.cancel()
      return
    }
    if (event.key.startsWith('Arrow') && keyboardSession) {
      event.preventDefault()
      event.stopPropagation()
      options.dragController?.moveKeyboard(event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 'next' : 'previous')
      return
    }
    if (event.key !== ' ' || !options.dragController)
      return

    event.preventDefault()
    event.stopPropagation()
    if (keyboardSession)
      options.dragController.finishKeyboard()
    else
      beginMaterialKeyboardDrag(material.key)
  }

  function getMaterialBindings(material: DesignerMaterialDefinition): DesignerPaletteMaterialBindings {
    return {
      'aria-label': options.materialTitle(material),
      'aria-pressed': isMaterialKeyboardDragging(material.key),
      'class': [
        'mx-config-form-designer__palette-command',
        {
          'is-disabled': options.readonly(),
          'is-keyboard-dragging': isMaterialKeyboardDragging(material.key),
        },
      ],
      'data-designer-draggable': true,
      'data-material-key': material.key,
      'data-material-kind': material.kind,
      'disabled': options.readonly(),
      'onClick': (event: MouseEvent) => {
        event.stopPropagation()
        addMaterial(material.key)
      },
      'onKeydown': (event: KeyboardEvent) => handleMaterialKeydown(material, event),
      'onPointerdown': (event: PointerEvent) => prepareMaterialDrag(material, event),
      'title': options.materialTitle(material),
    }
  }

  onBeforeUnmount(() => {
    cancelKeyboardStart()
    options.dragController?.cancel()
    cleanupPointerDrag()
  })

  watch(options.readonly, (readonly) => {
    if (!readonly)
      return
    options.dragController?.cancel()
    cancelKeyboardStart()
    cleanupPointerDrag()
    dragActivated = false
  })

  return {
    getMaterialBindings,
    isMaterialKeyboardDragging,
  }
}
