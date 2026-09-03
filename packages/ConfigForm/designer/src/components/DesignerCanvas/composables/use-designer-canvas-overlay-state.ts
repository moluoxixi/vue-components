import type { Ref } from 'vue'
import type { DesignerDragSession, DesignerOverlayMode } from '../types'
import { computed, onBeforeUnmount, watch } from 'vue'

interface UseDesignerCanvasOverlayStateOptions {
  activeSession: () => DesignerDragSession | undefined
  publishOverlayMode: (mode: DesignerOverlayMode) => void
  resizingNodeId: Ref<string | undefined>
  selectedSet: () => Set<string>
}

export function useDesignerCanvasOverlayState(options: UseDesignerCanvasOverlayStateOptions) {
  const overlayMode = computed<DesignerOverlayMode>(() => {
    if (options.resizingNodeId.value)
      return 'resizing'
    const session = options.activeSession()
    if (session?.active && session.input === 'pointer')
      return 'pointer-dragging'
    if (session?.active && session.input === 'keyboard')
      return 'keyboard-dragging'
    return options.selectedSet().size > 0 ? 'selected' : 'idle'
  })
  const selectionOverlayVisible = computed(() => (
    overlayMode.value !== 'pointer-dragging' && overlayMode.value !== 'idle'
  ))

  watch(overlayMode, mode => options.publishOverlayMode(mode), { immediate: true })
  onBeforeUnmount(() => options.publishOverlayMode('idle'))

  return {
    overlayMode,
    selectionOverlayVisible,
  }
}
