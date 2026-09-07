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
  cameraScale: () => number
  elementVersion: Ref<number>
  focusNode: (nodeId: string) => void | Promise<void>
  interactive: () => boolean
  model: () => Record<string, unknown> | undefined
  onGeometryChange: () => void
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

  function handleRuntimePointerDown(payload: DesignerRuntimePointerPayload): void {
    if (payload.button !== 0)
      return
    if (payload.nodeId) {
      options.onSelect(
        payload.nodeId,
        payload.shiftKey ? 'range' : (payload.ctrlKey || payload.metaKey) ? 'toggle' : 'replace',
      )
      void options.focusNode(payload.nodeId)
      return
    }
    options.onSelect('')
  }

  const runtimeHostBridge: DesignerRuntimeHostBridge = {
    pointerCancel: payload => pointerHandlers.cancel?.(payload),
    pointerDown: handleRuntimePointerDown,
    pointerMove: payload => pointerHandlers.move?.(payload),
    pointerUp: payload => pointerHandlers.up?.(payload),
    updateGeometry: updateRuntimeGeometry,
  }

  return {
    externalGeometry,
    pointerHandlers,
    runtimeHostBridge,
    runtimeLayoutRect,
    runtimeNodeGeometry,
    runtimeNodeGeometryById,
    selectedSet,
    surfaceModel,
  }
}
