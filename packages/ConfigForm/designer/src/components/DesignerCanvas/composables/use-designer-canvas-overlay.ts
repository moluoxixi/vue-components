import type { PageGraph, PageNode } from '@moluoxixi/config-form-model'
import type { ComputedRef, CSSProperties, Ref } from 'vue'
import type { DesignerMaterialDefinition } from '../../../registry'
import type { DesignerCanvasDesignPolicySpot, DesignerCanvasOverlayBox, DesignerCanvasProps, DesignerDragSession, DesignerDragVisualSlotScope, DesignerRuntimeGeometrySnapshot, DesignerRuntimeNodeGeometry, DesignerRuntimeRect, DesignerRuntimeSlotScope } from '../types'
import { computed } from 'vue'
import { findDesignNode } from '../../../graph'
import { resolveDesignerDesignPolicy } from '../../../registry'
import { resolveDesignerDragOverlayPosition, resolveDesignerDragVisualHeight } from '../services'

interface UseDesignerCanvasOverlayOptions {
  activeSession: () => DesignerDragSession | undefined
  cameraScale: () => number
  candidateId: () => string | undefined
  candidateNode: () => PageNode | undefined
  elementVersion: Ref<number>
  externalGeometry: Ref<DesignerRuntimeGeometrySnapshot | undefined>
  materialTitle: (material: DesignerMaterialDefinition) => string
  projectedGraph: () => PageGraph
  registry: () => DesignerCanvasProps['registry']
  runtimeNodeGeometryById: (nodeId: string) => DesignerRuntimeNodeGeometry | undefined
  runtimeSlotScope: ComputedRef<DesignerRuntimeSlotScope>
  selectedId: () => string | undefined
  selectedSet: () => Set<string>
  selectionOverlayVisible: () => boolean
  sheetRef: Ref<HTMLElement | undefined>
  controlledAdapterMessage: () => string
}

export function useDesignerCanvasOverlay(options: UseDesignerCanvasOverlayOptions) {
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
    if (!session?.active || session.input !== 'pointer' || !geometry || geometry.rect.width <= 0)
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

  const effectiveDragOverlayStyle = computed(() => hostedDragVisual.value?.style)

  const dragVisualSlotScope = computed<DesignerDragVisualSlotScope | undefined>(() => {
    const metrics = hostedDragVisual.value?.metrics
    return metrics ? { ...options.runtimeSlotScope.value, ...metrics } : undefined
  })

  return {
    collapsedCandidateIndicator,
    designPolicySpots,
    dragVisualSlotScope,
    effectiveDragOverlayStyle,
    nodeLabel,
    overlayBoxes,
  }
}
