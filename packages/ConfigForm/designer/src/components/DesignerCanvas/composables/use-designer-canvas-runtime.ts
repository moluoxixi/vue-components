import type { ConfigFormRuntimeEditorBridge, ConfigFormRuntimeNodeMetadata } from '@moluoxixi/config-form'
import type { PageGraph } from '@moluoxixi/config-form-model'
import type { Ref } from 'vue'
import type {
  DesignerCanvasProps,
  DesignerRuntimeGeometrySnapshot,
  DesignerRuntimeHostBridge,
  DesignerRuntimeNodeGeometry,
  DesignerRuntimePointerHandlers,
  DesignerRuntimePointerPayload,
  DesignerRuntimeRect,
} from '../types'
import { computed, ref } from 'vue'
import { findDesignNode } from '../../../graph'
import { resolveDesignerDesignPolicy } from '../../../registry'

interface UseDesignerCanvasRuntimeOptions {
  cameraScale: () => number
  candidateId: () => string | undefined
  candidateUsesFallback: () => boolean
  elementVersion: Ref<number>
  focusNode: (nodeId: string) => void | Promise<void>
  graph: () => PageGraph
  hasRuntimeSlot: () => boolean
  interactive: () => boolean
  model: () => Record<string, unknown> | undefined
  observeElement: (element: HTMLElement) => void
  onGeometryChange: () => void
  onSelect: (nodeId: string, mode?: 'range' | 'replace' | 'toggle') => void
  onUpdateField: (field: string, value: unknown) => void
  projectedGraph: () => PageGraph
  publishGeometry: (snapshot: DesignerRuntimeGeometrySnapshot) => void
  registry: () => DesignerCanvasProps['registry']
  selectedId: () => string | undefined
  selectedIds: () => string[] | undefined
  sheetRef: Ref<HTMLElement | undefined>
  unobserveElement: (element: HTMLElement) => void
}

function domRectValue(rect: DOMRect): DesignerRuntimeRect {
  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  }
}

function finiteRect(rect: DesignerRuntimeRect): boolean {
  return [rect.bottom, rect.height, rect.left, rect.right, rect.top, rect.width]
    .every(Number.isFinite)
}

export function useDesignerCanvasRuntime(options: UseDesignerCanvasRuntimeOptions) {
  const nodeElements = new Map<string, HTMLElement>()
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

  function localNodeGeometry(): DesignerRuntimeNodeGeometry[] {
    return [...nodeElements.entries()].map(([nodeId, element], order) => {
      const location = findDesignNode(options.graph(), nodeId)
      return {
        depth: location?.path.length ?? 0,
        nodeId,
        order,
        path: location?.path.join('.') ?? nodeId,
        rect: domRectValue(element.getBoundingClientRect()),
        ...(location?.slot ? { slot: location.slot } : {}),
      }
    })
  }

  function runtimeNodeGeometry(): DesignerRuntimeNodeGeometry[] {
    void options.elementVersion.value
    return options.hasRuntimeSlot()
      ? (externalGeometry.value?.nodes.map(node => ({
          ...node,
          rect: currentExternalRect(node.rect),
        })) ?? [])
      : localNodeGeometry()
  }

  function runtimeNodeGeometryById(nodeId: string): DesignerRuntimeNodeGeometry | undefined {
    return runtimeNodeGeometry().find(node => node.nodeId === nodeId)
  }

  function runtimeLayoutRect(): DesignerRuntimeRect | undefined {
    if (options.hasRuntimeSlot()) {
      const rect = externalGeometry.value?.layoutRect
      return rect ? currentExternalRect(rect) : undefined
    }
    const row = options.sheetRef.value?.querySelector<HTMLElement>('[data-config-form-responsive-layout]')
    return row ? domRectValue(row.getBoundingClientRect()) : undefined
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

  const editorBridge = computed<ConfigFormRuntimeEditorBridge<Record<string, unknown>>>(() => {
    const selection = selectedSet()
    const primary = options.selectedId()
    const dragCandidateId = options.candidateId()
    return {
      registerNode: (metadata, element) => {
        nodeElements.set(metadata.nodeId, element)
        options.observeElement(element)
        options.onGeometryChange()
        return () => {
          if (nodeElements.get(metadata.nodeId) === element)
            nodeElements.delete(metadata.nodeId)
          options.unobserveElement(element)
          options.onGeometryChange()
        }
      },
      getNodeAttrs: (metadata: ConfigFormRuntimeNodeMetadata<Record<string, unknown>>) => {
        const graphNode = findDesignNode(options.projectedGraph(), metadata.nodeId)
        const states = [
          selection.has(metadata.nodeId) ? 'selected' : '',
          primary === metadata.nodeId ? 'primary' : '',
          dragCandidateId === metadata.nodeId ? 'candidate' : '',
          dragCandidateId === metadata.nodeId && options.candidateUsesFallback() ? 'visual-source' : '',
        ].filter(Boolean).join(' ')
        return {
          'data-config-node-state': states || undefined,
          'data-designer-draggable': dragCandidateId === metadata.nodeId ? undefined : '',
          'data-designer-span': graphNode?.placement.span,
          'data-focus-node-id': metadata.nodeId,
          'data-material': graphNode?.node.component,
          'data-node-kind': graphNode?.node.kind,
          'role': 'presentation',
        }
      },
      interceptEvent: ({ metadata }) => {
        const node = findDesignNode(options.projectedGraph(), metadata.nodeId)?.node
        const material = node ? options.registry().getMaterial(node.component) : undefined
        const policy = resolveDesignerDesignPolicy(material?.designPolicy)
        return policy.interaction === 'blocked' || !options.interactive()
      },
    }
  })

  return {
    editorBridge,
    externalGeometry,
    nodeElements,
    pointerHandlers,
    runtimeHostBridge,
    runtimeLayoutRect,
    runtimeNodeGeometry,
    runtimeNodeGeometryById,
    selectedSet,
    surfaceModel,
  }
}
