import type { PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { ComputedRef, CSSProperties, Ref } from 'vue'
import type { DesignerMaterialDefinition } from '../../../registry'
import type { DesignerCanvasDesignPolicySpot, DesignerCanvasOverlayBox, DesignerCanvasProps, DesignerDragSession, DesignerDragVisualSlotScope, DesignerRuntimeGeometrySnapshot, DesignerRuntimeNodeGeometry, DesignerRuntimeRect, DesignerRuntimeSlotScope } from '../types'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { findDesignNode } from '../../../graph'
import { resolveDesignerDesignPolicy } from '../../../registry'
import { resolveDesignerDragOverlayPosition, resolveDesignerDragVisualHeight } from '../services'
import { createDesignerDragVisualClone } from '../utils'

interface UseDesignerCanvasOverlayOptions {
  activeSession: () => DesignerDragSession | undefined
  cameraScale: () => number
  candidateId: () => string | undefined
  candidateNode: () => PageNode | undefined
  elementVersion: Ref<number>
  externalGeometry: Ref<DesignerRuntimeGeometrySnapshot | undefined>
  hasRuntimeSlot: () => boolean
  materialTitle: (material: DesignerMaterialDefinition) => string
  nodeElements: Map<string, HTMLElement>
  projectedGraph: () => PageGraph
  registry: () => DesignerCanvasProps['registry']
  runtimeNodeGeometryById: (nodeId: string) => DesignerRuntimeNodeGeometry | undefined
  runtimeSlotScope: ComputedRef<DesignerRuntimeSlotScope>
  selectedId: () => string | undefined
  selectedSet: () => Set<string>
  selectionOverlayVisible: () => boolean
  sheetRef: Ref<HTMLElement | undefined>
  dragOverlayRef: Ref<HTMLElement | undefined>
  controlledAdapterMessage: () => string
}

export function useDesignerCanvasOverlay(options: UseDesignerCanvasOverlayOptions) {
  const dragOverlayStyle = ref<CSSProperties>()
  const dragOverlayHtml = ref('')
  const dragVisualMetrics = ref<{ canvasWidth: number, height: number, width: number }>()
  let dragOverlayFrame: number | undefined

  function nodeLabel(nodeId: string): string {
    const node = findDesignNode(options.projectedGraph(), nodeId)?.node
    if (!node)
      return nodeId
    if (node.kind === 'field')
      return node.label || node.field
    const material = options.registry().getMaterial(node.component)
    return material ? options.materialTitle(material) : node.component
  }

  function relativeSheetRectStyle(rect: DesignerRuntimeRect): CSSProperties {
    const sheet = options.sheetRef.value
    if (!sheet)
      return {}
    const sheetRect = sheet.getBoundingClientRect()
    const scale = options.cameraScale()
    return {
      height: `${rect.height / scale}px`,
      left: `${(rect.left - sheetRect.left) / scale}px`,
      top: `${(rect.top - sheetRect.top) / scale}px`,
      width: `${rect.width / scale}px`,
    }
  }

  const overlayBoxes = computed<DesignerCanvasOverlayBox[]>(() => {
    void options.elementVersion.value
    if (!options.selectionOverlayVisible() || !options.sheetRef.value)
      return []
    return [...options.selectedSet()].flatMap((id) => {
      const geometry = options.runtimeNodeGeometryById(id)
      if (!geometry)
        return []
      return [{
        id,
        primary: id === options.selectedId(),
        style: relativeSheetRectStyle(geometry.rect),
      }]
    })
  })

  const designPolicySpots = computed<DesignerCanvasDesignPolicySpot[]>(() => {
    void options.elementVersion.value
    const id = options.selectedId()
    const sheet = options.sheetRef.value
    if (!options.selectionOverlayVisible() || !id || !sheet)
      return []
    const sheetRect = sheet.getBoundingClientRect()
    const geometry = options.runtimeNodeGeometryById(id)
    const node = findDesignNode(options.projectedGraph(), id)?.node
    const material = node ? options.registry().getMaterial(node.component) : undefined
    const policy = resolveDesignerDesignPolicy(material?.designPolicy)
    if (!geometry || policy.render !== 'adapter')
      return []
    const scale = options.cameraScale()
    return [{
      id,
      message: policy.diagnostic || options.controlledAdapterMessage(),
      style: {
        left: `${(geometry.rect.right - sheetRect.left - 20) / scale}px`,
        top: `${(geometry.rect.top - sheetRect.top + 4) / scale}px`,
      },
    }]
  })

  const collapsedCandidateIndicator = computed<CSSProperties | undefined>(() => {
    void options.elementVersion.value
    const sheet = options.sheetRef.value
    const id = options.candidateId()
    const geometry = id ? options.runtimeNodeGeometryById(id) : undefined
    if (!sheet || !geometry || geometry.rect.width <= 0 || geometry.rect.height > 0)
      return undefined
    const sheetRect = sheet.getBoundingClientRect()
    const height = 36
    const scale = options.cameraScale()
    return {
      height: `${height / scale}px`,
      left: `${(geometry.rect.left - sheetRect.left) / scale}px`,
      top: `${(geometry.rect.top - sheetRect.top - (height - geometry.rect.height) / 2) / scale}px`,
      width: `${geometry.rect.width / scale}px`,
    }
  })

  const hostedDragVisual = computed(() => {
    const session = options.activeSession()
    const id = options.candidateId()
    const geometry = id ? options.runtimeNodeGeometryById(id) : undefined
    if (!options.hasRuntimeSlot() || !session?.active || session.input !== 'pointer' || !geometry || geometry.rect.width <= 0)
      return undefined
    const height = resolveDesignerDragVisualHeight(geometry.rect.height, options.candidateNode()?.kind)
    const position = resolveDesignerDragOverlayPosition(
      session.position,
      session.pointerOffset,
      { width: geometry.rect.width, height },
    )
    return {
      metrics: {
        canvasWidth: options.externalGeometry.value?.viewport.width
          ?? options.sheetRef.value?.clientWidth
          ?? geometry.rect.width,
        height,
        width: geometry.rect.width,
      },
      style: {
        height: `${height}px`,
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${geometry.rect.width}px`,
      } satisfies CSSProperties,
    }
  })

  const effectiveDragOverlayStyle = computed(() => options.hasRuntimeSlot()
    ? hostedDragVisual.value?.style
    : dragOverlayStyle.value)

  const dragVisualSlotScope = computed<DesignerDragVisualSlotScope | undefined>(() => {
    const metrics = options.hasRuntimeSlot()
      ? hostedDragVisual.value?.metrics
      : dragVisualMetrics.value
    return metrics ? { ...options.runtimeSlotScope.value, ...metrics } : undefined
  })

  function clearDragOverlay(): void {
    if (dragOverlayFrame !== undefined)
      window.cancelAnimationFrame(dragOverlayFrame)
    dragOverlayFrame = undefined
    dragOverlayStyle.value = undefined
    dragOverlayHtml.value = ''
    dragVisualMetrics.value = undefined
  }

  function updateDragOverlay(): void {
    dragOverlayFrame = undefined
    const session = options.activeSession()
    const id = options.candidateId()
    const geometry = id ? options.runtimeNodeGeometryById(id) : undefined
    if (!session?.active || session.input !== 'pointer' || !geometry || !options.dragOverlayRef.value || geometry.rect.width <= 0) {
      clearDragOverlay()
      return
    }
    const height = resolveDesignerDragVisualHeight(geometry.rect.height, options.candidateNode()?.kind)
    const position = resolveDesignerDragOverlayPosition(
      session.position,
      session.pointerOffset,
      { width: geometry.rect.width, height },
    )
    if (!options.hasRuntimeSlot()) {
      const source = options.nodeElements.get(id ?? '')
      if (!source) {
        clearDragOverlay()
        return
      }
      dragOverlayHtml.value = createDesignerDragVisualClone(source).outerHTML
    }
    dragVisualMetrics.value = {
      canvasWidth: options.externalGeometry.value?.viewport.width
        ?? options.sheetRef.value?.clientWidth
        ?? geometry.rect.width,
      height,
      width: geometry.rect.width,
    }
    dragOverlayStyle.value = {
      height: `${height}px`,
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${geometry.rect.width}px`,
    }
  }

  function scheduleDragOverlay(): void {
    if (dragOverlayFrame !== undefined)
      return
    void nextTick(() => {
      if (dragOverlayFrame === undefined)
        dragOverlayFrame = window.requestAnimationFrame(updateDragOverlay)
    })
  }

  onBeforeUnmount(clearDragOverlay)

  return {
    clearDragOverlay,
    collapsedCandidateIndicator,
    designPolicySpots,
    dragOverlayHtml,
    dragVisualSlotScope,
    effectiveDragOverlayStyle,
    nodeLabel,
    overlayBoxes,
    scheduleDragOverlay,
  }
}
