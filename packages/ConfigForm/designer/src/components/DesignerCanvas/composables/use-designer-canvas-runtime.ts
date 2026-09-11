import type { Ref } from 'vue'
import type {
  DesignerRuntimeGeometrySnapshot,
  DesignerRuntimeHostBridge,
  DesignerRuntimeNodeGeometry,
  DesignerRuntimePointerHandlers,
  DesignerRuntimePointerPayload,
  DesignerRuntimeRect,
} from '../types'
import { computed, ref } from 'vue'

interface UseDesignerCanvasRuntimeOptions {
  beginNodeDragFromRuntime: (nodeId: string, point: { x: number, y: number }, pointerId: number) => void
  cameraScale: () => number
  cancelNodeDragFromRuntime: (pointerId: number) => void
  elementVersion: Ref<number>
  finishNodeDragFromRuntime: (point: { x: number, y: number }, pointerId: number) => void
  focusNode: (nodeId: string) => void | Promise<void>
  interactive: () => boolean
  model: () => Record<string, unknown> | undefined
  moveNodeDragFromRuntime: (point: { x: number, y: number }, pointerId: number) => void
  onContextMenu: (payload: DesignerRuntimePointerPayload) => void
  onGeometryChange: () => void
  onInspectNode: (nodeId: string) => void
  onSelect: (nodeId: string, mode?: 'range' | 'replace' | 'toggle') => void
  onUpdateField: (field: string, value: unknown) => void
  publishGeometry: (snapshot: DesignerRuntimeGeometrySnapshot) => void
  selectedId: () => string | undefined
  selectedIds: () => string[] | undefined
  sheetRef: Ref<HTMLElement | undefined>
}

function finiteRect(rect: DesignerRuntimeRect): boolean {
  return [rect.bottom, rect.height, rect.left, rect.right, rect.top, rect.width]
    .every(Number.isFinite)
}

export function useDesignerCanvasRuntime(options: UseDesignerCanvasRuntimeOptions) {
  const externalGeometry = ref<DesignerRuntimeGeometrySnapshot>()
  const externalGeometryAnchor = ref<{ left: number, scale: number, top: number }>()
  const pointerHandlers: DesignerRuntimePointerHandlers = {}

  const surfaceModel = computed<Record<string, unknown>>({
    get: () => options.model() ?? {},
    set: (next) => {
      if (!options.interactive())
        return
      for (const [field, value] of Object.entries(next)) {
        if (!Object.is(options.model()?.[field], value))
          options.onUpdateField(field, value)
      }
    },
  })

  function selectedSet(): Set<string> {
    const selectedIds = options.selectedIds()
    const selectedId = options.selectedId()
    return new Set(selectedIds ?? (selectedId ? [selectedId] : []))
  }

  function currentExternalRect(rect: DesignerRuntimeRect): DesignerRuntimeRect {
    const sheetRect = options.sheetRef.value?.getBoundingClientRect()
    const anchor = externalGeometryAnchor.value
    if (!sheetRect || !anchor)
      return rect
    const scale = options.cameraScale() / anchor.scale
    const left = sheetRect.left + (rect.left - anchor.left) * scale
    const top = sheetRect.top + (rect.top - anchor.top) * scale
    const width = rect.width * scale
    const height = rect.height * scale
    return {
      bottom: top + height,
      height,
      left,
      right: left + width,
      top,
      width,
    }
  }

  function runtimeNodeGeometry(): DesignerRuntimeNodeGeometry[] {
    void options.elementVersion.value
    return externalGeometry.value?.nodes.map(node => ({
      ...node,
      rect: currentExternalRect(node.rect),
    })) ?? []
  }

  function runtimeNodeGeometryById(nodeId: string): DesignerRuntimeNodeGeometry | undefined {
    return runtimeNodeGeometry().find(node => node.nodeId === nodeId)
  }

  function runtimeLayoutRect(): DesignerRuntimeRect | undefined {
    const rect = externalGeometry.value?.layoutRect
    return rect ? currentExternalRect(rect) : undefined
  }

  function updateRuntimeGeometry(snapshot: DesignerRuntimeGeometrySnapshot): void {
    if (!finiteRect(snapshot.surfaceRect)
      || !Number.isFinite(snapshot.viewport.height)
      || !Number.isFinite(snapshot.viewport.width)
      || snapshot.nodes.some(node => !node.nodeId || !finiteRect(node.rect))) {
      return
    }
    externalGeometry.value = snapshot
    options.publishGeometry(snapshot)
    const sheetRect = options.sheetRef.value?.getBoundingClientRect()
    externalGeometryAnchor.value = sheetRect
      ? { left: sheetRect.left, scale: options.cameraScale(), top: sheetRect.top }
      : undefined
    options.onGeometryChange()
  }

  // Pointer downs inside the iframe arm a pending node drag; crossing the
  // activation distance hands the session to the canvas node-drag composable,
  // whose drag overlay then receives the native pointer stream.
  let armedNodeDrag: { nodeId: string, pointerId: number, x: number, y: number } | undefined
  // Double pressing the same node promotes the selection into the inspector.
  let lastNodePress: { nodeId: string, time: number } | undefined
  const hoverNodeId = ref<string>()

  function handleRuntimePointerDown(payload: DesignerRuntimePointerPayload): void {
    if (payload.button !== 0)
      return
    if (payload.nodeId) {
      options.onSelect(
        payload.nodeId,
        payload.shiftKey ? 'range' : (payload.ctrlKey || payload.metaKey) ? 'toggle' : 'replace',
      )
      void options.focusNode(payload.nodeId)
      if (!options.interactive() && !payload.shiftKey && !payload.ctrlKey && !payload.metaKey) {
        armedNodeDrag = {
          nodeId: payload.nodeId,
          pointerId: payload.pointerId,
          x: payload.clientX,
          y: payload.clientY,
        }
        const now = Date.now()
        if (lastNodePress && lastNodePress.nodeId === payload.nodeId && now - lastNodePress.time <= 400) {
          lastNodePress = undefined
          options.onInspectNode(payload.nodeId)
        }
        else {
          lastNodePress = { nodeId: payload.nodeId, time: now }
        }
      }
      return
    }
    lastNodePress = undefined
    options.onSelect('')
  }

  function handleRuntimePointerMove(payload: DesignerRuntimePointerPayload): void {
    const armed = armedNodeDrag
    if (armed && armed.pointerId === payload.pointerId
      && Math.hypot(payload.clientX - armed.x, payload.clientY - armed.y) >= 5) {
      armedNodeDrag = undefined
      options.beginNodeDragFromRuntime(armed.nodeId, { x: payload.clientX, y: payload.clientY }, payload.pointerId)
    }
    // Until the drag overlay mounts above the iframe the parent window never
    // sees pointer moves, so the forwarded stream keeps driving the session;
    // once the overlay takes over the iframe stops forwarding, making the two
    // sources naturally exclusive.
    options.moveNodeDragFromRuntime({ x: payload.clientX, y: payload.clientY }, payload.pointerId)
    hoverNodeId.value = options.interactive() ? undefined : payload.nodeId
    pointerHandlers.move?.(payload)
  }

  function handleRuntimePointerUp(payload: DesignerRuntimePointerPayload): void {
    armedNodeDrag = undefined
    options.finishNodeDragFromRuntime({ x: payload.clientX, y: payload.clientY }, payload.pointerId)
    pointerHandlers.up?.(payload)
  }

  function handleRuntimePointerCancel(payload: DesignerRuntimePointerPayload): void {
    armedNodeDrag = undefined
    options.cancelNodeDragFromRuntime(payload.pointerId)
    pointerHandlers.cancel?.(payload)
  }

  function handleRuntimeContextMenu(payload: DesignerRuntimePointerPayload): void {
    armedNodeDrag = undefined
    if (options.interactive())
      return
    if (payload.nodeId)
      options.onSelect(payload.nodeId, 'replace')
    options.onContextMenu(payload)
  }

  const runtimeHostBridge: DesignerRuntimeHostBridge = {
    contextMenu: handleRuntimeContextMenu,
    pointerCancel: handleRuntimePointerCancel,
    pointerDown: handleRuntimePointerDown,
    pointerMove: handleRuntimePointerMove,
    pointerUp: handleRuntimePointerUp,
    updateGeometry: updateRuntimeGeometry,
  }

  return {
    externalGeometry,
    hoverNodeId,
    pointerHandlers,
    runtimeHostBridge,
    runtimeLayoutRect,
    runtimeNodeGeometry,
    runtimeNodeGeometryById,
    selectedSet,
    surfaceModel,
  }
}
