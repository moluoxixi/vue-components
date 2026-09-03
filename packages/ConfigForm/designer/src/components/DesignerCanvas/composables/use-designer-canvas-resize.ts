import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { PageGraph } from '@moluoxixi/config-form-model'
import type { DesignerRuntimePointerHandlers, DesignerRuntimeRect } from '../types'
import type { DesignerCanvasEmits } from '../types/emits'
import { resolveConfigFormLayout } from '@moluoxixi/config-form'
import { onBeforeUnmount, ref, watch } from 'vue'
import { findDesignNode } from '../../../graph'

interface UseDesignerCanvasResizeOptions {
  breakpoint: () => ConfigFormBreakpoint | undefined
  graph: () => PageGraph
  onResize: (...args: DesignerCanvasEmits['resize']) => void
  readonly: () => boolean
  runtimeLayoutRect: () => DesignerRuntimeRect | undefined
  runtimePointerHandlers: DesignerRuntimePointerHandlers
}

export function useDesignerCanvasResize(options: UseDesignerCanvasResizeOptions) {
  const resizingNodeId = ref<string>()
  let resizeCleanup: (() => void) | undefined

  function canResize(nodeId: string): boolean {
    const graph = options.graph()
    return !options.readonly()
      && !graph.form.inline
      && findDesignNode(graph, nodeId)?.parentId === null
  }

  function beginResize(event: PointerEvent, nodeId: string): void {
    const graph = options.graph()
    const location = findDesignNode(graph, nodeId)
    const layoutRect = options.runtimeLayoutRect()
    if (!location || !layoutRect || !canResize(nodeId))
      return
    event.preventDefault()
    event.stopPropagation()
    resizeCleanup?.()
    resizingNodeId.value = nodeId
    const layout = resolveConfigFormLayout(
      graph.form.columns,
      graph.form.fieldSpan,
      graph.form.responsive,
      options.breakpoint() ?? 'desktop',
    )
    const startSpan = typeof location.placement.span === 'number' ? location.placement.span : layout.fieldSpan
    const startX = event.clientX
    const width = layoutRect.width || 1
    const pointerId = event.pointerId
    const pointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
    pointerTarget?.setPointerCapture?.(pointerId)
    let nextSpan = startSpan
    const move = (moveEvent: Pick<PointerEvent, 'clientX' | 'pointerId'>): void => {
      if (moveEvent.pointerId !== pointerId)
        return
      const delta = Math.round((moveEvent.clientX - startX) / width * layout.columns)
      nextSpan = Math.min(layout.columns, Math.max(1, startSpan + delta))
    }
    const finish = (finishEvent: Pick<PointerEvent, 'pointerId'>): void => {
      if (finishEvent.pointerId !== pointerId)
        return
      resizeCleanup?.()
      if (nextSpan !== startSpan)
        options.onResize(nodeId, nextSpan)
    }
    const cancel = (): void => resizeCleanup?.()
    const lostCapture = (lostEvent: PointerEvent): void => {
      if (lostEvent.pointerId === pointerId)
        resizeCleanup?.()
    }
    pointerTarget?.addEventListener('lostpointercapture', lostCapture)
    options.runtimePointerHandlers.move = move
    options.runtimePointerHandlers.up = finish
    options.runtimePointerHandlers.cancel = cancel
    resizeCleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      pointerTarget?.removeEventListener('lostpointercapture', lostCapture)
      if (pointerTarget?.hasPointerCapture?.(pointerId))
        pointerTarget.releasePointerCapture(pointerId)
      options.runtimePointerHandlers.move = undefined
      options.runtimePointerHandlers.up = undefined
      options.runtimePointerHandlers.cancel = undefined
      resizeCleanup = undefined
      resizingNodeId.value = undefined
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
  }

  watch(options.readonly, (readonly) => {
    if (readonly)
      resizeCleanup?.()
  })
  onBeforeUnmount(() => resizeCleanup?.())

  return {
    beginResize,
    canResize,
    resizingNodeId,
  }
}
