<script setup lang="ts">
import type { ConfigFormBreakpoint, ConfigFormRuntimeEditorBridge, ConfigFormRuntimeNodeMetadata } from '@moluoxixi/config-form'
import type { PageGraph, PageNode, ProjectCommand } from '@moluoxixi/config-form-model'
import type { ComputedRef, CSSProperties } from 'vue'
import type { DesignerSelectionMode } from '../../composables'
import type { DesignerDropTarget } from '../../graph'
import type { DesignerMaterialSlotDefinition } from '../../registry'
import type { DesignerNodeAction } from '../DesignSurface/types'
import type {
  DesignerCanvasCamera,
  DesignerCanvasEmits,
  DesignerCanvasProps,
  DesignerCanvasSlots,
  DesignerDragSource,
  DesignerDragVisualSlotScope,
  DesignerOverlayMode,
  DesignerPointerPosition,
  DesignerRuntimeGeometrySnapshot,
  DesignerRuntimeHostBridge,
  DesignerRuntimeNodeGeometry,
  DesignerRuntimePointerPayload,
  DesignerRuntimeRect,
  DesignerRuntimeSlotScope,
} from './types'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownLeft,
  CornerDownRight,
  GripVertical,
  MoreHorizontal,
  Scan,
  TriangleAlert,
  Trash2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import { ConfigFormRenderer, resolveConfigFormLayout } from '@moluoxixi/config-form'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue'
import { createInsertCommand, createMoveCommand, findDesignNode } from '../../graph'
import { useDesignerLocale } from '../../locale'
import { resolveDesignerDesignPolicy } from '../../registry'
import {
  createDesignerMaterialCandidate,
  resolveDesignerAutoScrollDelta,
  resolveDesignerCollapsedDropTarget,
  resolveDesignerDragOverlayPosition,
  resolveDesignerDragVisualHeight,
  resolveStickyDesignerDropTarget,
} from './services'
import { createDesignerDragVisualClone } from './utils'
import { DESIGNER_SESSION_KEY } from './services'

const CANVAS_FRAME_WIDTHS: Record<ConfigFormBreakpoint, number> = {
  desktop: 900,
  tablet: 720,
  mobile: 390,
}
const CANVAS_MIN_SCALE = 0.25
const CANVAS_MAX_SCALE = 2
const CANVAS_MIN_SHEET_HEIGHT = 560
const CANVAS_SCALE_STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2] as const

const slots = defineSlots<DesignerCanvasSlots>()
const props = defineProps<DesignerCanvasProps>()
const emit = defineEmits<DesignerCanvasEmits>()

const locale = useDesignerLocale()
const designSession = inject(DESIGNER_SESSION_KEY, undefined)
const dragController = designSession?.drag
const canvasRef = ref<HTMLElement>()
const cameraViewportRef = ref<HTMLElement>()
const sheetRef = ref<HTMLElement>()
const dragOverlayRef = ref<HTMLElement>()
const nodeActionMenuId = useId()
const emptyCanvasDescriptionId = useId()
const nodeActionMenuNodeId = ref<string>()
const nodeElements = new Map<string, HTMLElement>()
const externalGeometry = ref<DesignerRuntimeGeometrySnapshot>()
const externalGeometryAnchor = ref<{ left: number, scale: number, top: number }>()
const elementVersion = ref(0)
const dragOverlayStyle = ref<CSSProperties>()
const dragOverlayHtml = ref('')
const dragVisualMetrics = ref<{ canvasWidth: number, height: number, width: number }>()
const camera = reactive<DesignerCanvasCamera>({
  mode: 'fit',
  pan: { x: 0, y: 0 },
  scale: 1,
})
const sheetHeight = ref(CANVAS_MIN_SHEET_HEIGHT)
const cameraHovered = ref(false)
const cameraPanning = ref(false)
const spacePressed = ref(false)
let resizeObserver: ResizeObserver | undefined
let unregisterDropResolver: (() => void) | undefined
let unregisterKeyboardTargets: (() => void) | undefined
let activeDragPointer: number | undefined
let activeDragPointerTarget: HTMLElement | undefined
let autoScrollFrame: number | undefined
let autoScrollPoint: DesignerPointerPosition | undefined
let dragOverlayFrame: number | undefined
let cameraMeasureFrame: number | undefined
let cameraPanCleanup: (() => void) | undefined
let resizeCleanup: (() => void) | undefined
let runtimePointerMove: ((payload: DesignerRuntimePointerPayload) => void) | undefined
let runtimePointerUp: ((payload: DesignerRuntimePointerPayload) => void) | undefined
let runtimePointerCancel: ((payload: DesignerRuntimePointerPayload) => void) | undefined

const activeSession = computed(() => dragController?.session.value)
const candidateActive = computed(() => Boolean(activeSession.value?.active))
const candidateInput = computed(() => activeSession.value?.active ? activeSession.value.input : undefined)
const resizingNodeId = ref<string>()
const overlayMode = computed<DesignerOverlayMode>(() => {
  if (resizingNodeId.value)
    return 'resizing'
  if (candidateActive.value && candidateInput.value === 'pointer')
    return 'pointer-dragging'
  if (candidateActive.value && candidateInput.value === 'keyboard')
    return 'keyboard-dragging'
  return selectedSet().size > 0 ? 'selected' : 'idle'
})
const selectionOverlayVisible = computed(() => overlayMode.value !== 'pointer-dragging' && overlayMode.value !== 'idle')
const dragSource = computed(() => activeSession.value?.source)
const candidateSource = computed(() => candidateActive.value ? dragSource.value : undefined)
const candidateTarget = computed(() => activeSession.value?.active ? activeSession.value.target : undefined)
const candidateId = computed(() => candidateSource.value?.candidateId)
const intrinsicFrameWidth = computed(() => CANVAS_FRAME_WIDTHS[props.breakpoint ?? 'desktop'])
const cameraPercent = computed(() => Math.round(camera.scale * 100))
const cameraSizerStyle = computed<CSSProperties>(() => ({
  height: `${Math.max(1, sheetHeight.value * camera.scale)}px`,
  width: `${intrinsicFrameWidth.value * camera.scale}px`,
}))
const cameraSheetStyle = computed(() => ({
  '--mx-designer-camera-inverse-scale': String(1 / camera.scale),
  'transform': `scale(${camera.scale})`,
  'width': `${intrinsicFrameWidth.value}px`,
}) satisfies CSSProperties)

function clampCameraScale(scale: number): number {
  return Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, scale))
}

function canvasFitScale(): number {
  const viewport = cameraViewportRef.value
  if (!viewport)
    return 1
  const styles = getComputedStyle(viewport)
  const horizontalPadding = (Number.parseFloat(styles.paddingLeft) || 0)
    + (Number.parseFloat(styles.paddingRight) || 0)
  const availableWidth = Math.max(1, viewport.clientWidth - horizontalPadding)
  return clampCameraScale(Math.min(1, availableWidth / intrinsicFrameWidth.value))
}

function measureCanvasCamera(): void {
  cameraMeasureFrame = undefined
  const sheet = sheetRef.value
  if (sheet)
    sheetHeight.value = Math.max(CANVAS_MIN_SHEET_HEIGHT, sheet.offsetHeight)
  if (camera.mode === 'fit') {
    camera.scale = canvasFitScale()
    void nextTick(() => {
      const viewport = cameraViewportRef.value
      if (!viewport)
        return
      viewport.scrollLeft = 0
      camera.pan.x = 0
    })
  }
}

function scheduleCanvasCameraMeasure(): void {
  if (cameraMeasureFrame !== undefined)
    return
  cameraMeasureFrame = window.requestAnimationFrame(measureCanvasCamera)
}

function updateCameraPan(): void {
  const viewport = cameraViewportRef.value
  if (!viewport)
    return
  camera.pan.x = viewport.scrollLeft
  camera.pan.y = viewport.scrollTop
  elementVersion.value += 1
}

function setCameraScale(scale: number): void {
  const viewport = cameraViewportRef.value
  const sheet = sheetRef.value
  const nextScale = clampCameraScale(scale)
  if (!viewport || !sheet) {
    camera.mode = 'manual'
    camera.scale = nextScale
    return
  }

  const viewportRect = viewport.getBoundingClientRect()
  const sheetRect = sheet.getBoundingClientRect()
  const anchor = {
    x: (viewportRect.left + viewport.clientWidth / 2 - sheetRect.left) / camera.scale,
    y: (viewportRect.top + viewport.clientHeight / 2 - sheetRect.top) / camera.scale,
  }
  camera.mode = 'manual'
  camera.scale = nextScale
  void nextTick(() => {
    const nextSheetRect = sheet.getBoundingClientRect()
    viewport.scrollBy({
      left: nextSheetRect.left + anchor.x * nextScale - (viewportRect.left + viewport.clientWidth / 2),
      top: nextSheetRect.top + anchor.y * nextScale - (viewportRect.top + viewport.clientHeight / 2),
    })
    updateCameraPan()
  })
}

function zoomCamera(direction: 'in' | 'out'): void {
  const epsilon = 0.001
  const next = direction === 'in'
    ? CANVAS_SCALE_STEPS.find(scale => scale > camera.scale + epsilon)
    : [...CANVAS_SCALE_STEPS].reverse().find(scale => scale < camera.scale - epsilon)
  if (next !== undefined)
    setCameraScale(next)
}

function fitCamera(): void {
  camera.mode = 'fit'
  measureCanvasCamera()
}

function resetCamera(): void {
  setCameraScale(1)
}

function editableKeyboardTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function cameraShortcutActive(target: EventTarget | null): boolean {
  const canvas = canvasRef.value
  return Boolean(cameraHovered.value
    || (target instanceof Node && canvas?.contains(target)))
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (!cameraShortcutActive(event.target) || editableKeyboardTarget(event.target))
    return
  if (event.code === 'Space') {
    const target = event.target instanceof Element ? event.target : undefined
    if (target?.closest('[data-designer-editor-control], [data-editor-focus-node-id]'))
      return
    event.preventDefault()
    spacePressed.value = true
    return
  }
  if (event.shiftKey && event.code === 'Digit1') {
    event.preventDefault()
    fitCamera()
  }
  else if (event.code === 'Digit0' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    resetCamera()
  }
  else if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomCamera('in')
  }
  else if (event.key === '-') {
    event.preventDefault()
    zoomCamera('out')
  }
}

function handleDocumentKeyup(event: KeyboardEvent): void {
  if (event.code === 'Space')
    spacePressed.value = false
}

function cancelCameraPan(): void {
  cameraPanCleanup?.()
}

function handleWindowBlur(): void {
  spacePressed.value = false
  cancelCameraPan()
}

function beginCameraPan(event: PointerEvent): void {
  if (event.button !== 0 || !cameraViewportRef.value)
    return
  event.preventDefault()
  event.stopPropagation()
  cameraPanCleanup?.()
  const viewport = cameraViewportRef.value
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  const pointerId = event.pointerId
  const start = {
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
    x: event.clientX,
    y: event.clientY,
  }
  cameraPanning.value = true
  target?.setPointerCapture?.(pointerId)
  const move = (moveEvent: PointerEvent): void => {
    if (moveEvent.pointerId !== pointerId)
      return
    viewport.scrollLeft = start.scrollLeft - (moveEvent.clientX - start.x)
    viewport.scrollTop = start.scrollTop - (moveEvent.clientY - start.y)
    updateCameraPan()
  }
  const finish = (finishEvent: PointerEvent): void => {
    if (finishEvent.pointerId === pointerId)
      cameraPanCleanup?.()
  }
  cameraPanCleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    if (target?.hasPointerCapture?.(pointerId))
      target.releasePointerCapture(pointerId)
    cameraPanCleanup = undefined
    cameraPanning.value = false
    updateCameraPan()
  }
  window.addEventListener('pointermove', move, { passive: false })
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}

function candidateForDragSource(source: DesignerDragSource | undefined) {
  if (!source)
    return undefined
  if (source.type === 'node')
    return undefined

  return createDesignerMaterialCandidate(props.registry, source.materialKey, source.candidateId)
}

function nodeForDragSource(source: DesignerDragSource | undefined): PageNode | undefined {
  if (!source)
    return undefined
  return source.type === 'node'
    ? findDesignNode(props.graph, source.nodeId)?.node
    : candidateForDragSource(source)?.node
}

const candidateNode = computed<PageNode | undefined>(() => nodeForDragSource(dragSource.value))

const candidateFallbackTarget = computed<DesignerDropTarget | undefined>(() => {
  const source = candidateSource.value
  if (!candidateActive.value || candidateInput.value !== 'pointer' || source?.type !== 'material' || candidateTarget.value)
    return undefined
  return keyboardDropTargets(source)[0]
})

const candidateProjectionTarget = computed(() => candidateTarget.value ?? candidateFallbackTarget.value)
const candidateUsesFallback = computed(() => !!candidateFallbackTarget.value && !candidateTarget.value)

function candidateCommandForSource(source: DesignerDragSource | undefined, target: DesignerDropTarget): ProjectCommand | undefined {
  if (!source)
    return undefined
  if (source.type === 'node')
    return createMoveCommand(props.pageId, source.nodeId, target, { id: `candidate-move-${source.candidateId}` })
  const candidate = candidateForDragSource(source)
  return candidate
    ? createInsertCommand(props.pageId, candidate.subgraph, target, { id: `candidate-insert-${source.candidateId}` })
    : undefined
}

function candidateCommand(target: DesignerDropTarget): ProjectCommand | undefined {
  return candidateCommandForSource(candidateSource.value, target)
}

const activeCandidateCommand = computed(() => {
  const target = candidateProjectionTarget.value
  return candidateActive.value && target ? candidateCommand(target) : undefined
})

watch(activeCandidateCommand, command => designSession?.publishCandidate(command), { immediate: true })

const activeCandidatePreview = computed(() => {
  const command = activeCandidateCommand.value
  return command ? props.candidatePreview(command) : undefined
})

const projectedGraph = computed(() => activeCandidatePreview.value?.graph ?? props.graph)
const showEmptyCanvas = computed(() => projectedGraph.value.root.length === 0 && !candidateActive.value)

const renderer = computed(() => {
  return activeCandidatePreview.value?.renderer ?? props.runtimeRenderer
})

const surfaceModel: ComputedRef<Record<string, unknown>> = computed({
  get: () => props.model ?? {},
  set: (next) => {
    if (!props.interactive)
      return
    for (const [field, value] of Object.entries(next)) {
      if (!Object.is(props.model?.[field], value))
        emit('updateField', field, value)
    }
  },
})

function selectedSet(): Set<string> {
  return new Set(props.selectedIds ?? (props.selectedId ? [props.selectedId] : []))
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

function localNodeGeometry(): DesignerRuntimeNodeGeometry[] {
  return [...nodeElements.entries()].map(([nodeId, element], order) => {
    const location = findDesignNode(props.graph, nodeId)
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
  elementVersion.value
  return slots.runtime
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
  if (slots.runtime) {
    const rect = externalGeometry.value?.layoutRect
    return rect ? currentExternalRect(rect) : undefined
  }
  const row = sheetRef.value?.querySelector<HTMLElement>('[data-config-form-responsive-layout]')
  return row ? domRectValue(row.getBoundingClientRect()) : undefined
}

function currentExternalRect(rect: DesignerRuntimeRect): DesignerRuntimeRect {
  const sheetRect = sheetRef.value?.getBoundingClientRect()
  const anchor = externalGeometryAnchor.value
  if (!sheetRect || !anchor)
    return rect
  const scale = camera.scale / anchor.scale
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

function finiteRect(rect: DesignerRuntimeRect): boolean {
  return [rect.bottom, rect.height, rect.left, rect.right, rect.top, rect.width]
    .every(Number.isFinite)
}

function updateRuntimeGeometry(snapshot: DesignerRuntimeGeometrySnapshot): void {
  if (!finiteRect(snapshot.surfaceRect)
    || !Number.isFinite(snapshot.viewport.height)
    || !Number.isFinite(snapshot.viewport.width)
    || snapshot.nodes.some(node => !node.nodeId || !finiteRect(node.rect))) {
    return
  }
  externalGeometry.value = snapshot
  designSession?.publishGeometry(snapshot)
  const sheetRect = sheetRef.value?.getBoundingClientRect()
  externalGeometryAnchor.value = sheetRect
    ? { left: sheetRect.left, scale: camera.scale, top: sheetRect.top }
    : undefined
  elementVersion.value += 1
}

function handleRuntimePointerDown(payload: DesignerRuntimePointerPayload): void {
  if (payload.button !== 0)
    return
  if (payload.nodeId)
    emit('select', payload.nodeId, payload.shiftKey ? 'range' : (payload.ctrlKey || payload.metaKey) ? 'toggle' : 'replace')
  else
    emit('select', '')
  if (payload.nodeId)
    void focusEditorNode(payload.nodeId)
}

const runtimeHostBridge: DesignerRuntimeHostBridge = {
  pointerCancel: payload => runtimePointerCancel?.(payload),
  pointerDown: handleRuntimePointerDown,
  pointerMove: payload => runtimePointerMove?.(payload),
  pointerUp: payload => runtimePointerUp?.(payload),
  updateGeometry: updateRuntimeGeometry,
}

const runtimeSlotScope = computed<DesignerRuntimeSlotScope>(() => ({
  breakpoint: props.breakpoint ?? 'desktop',
  bridge: runtimeHostBridge,
  cameraScale: camera.scale,
  candidateId: candidateId.value,
  candidateUsesFallback: candidateUsesFallback.value,
  command: activeCandidateCommand.value,
  graph: projectedGraph.value,
  interactive: Boolean(props.interactive),
  model: surfaceModel.value,
  reactionProps: props.reactionProps ?? {},
  reactionStates: props.reactionStates ?? {},
  renderer: renderer.value,
}))

const hostedDragVisual = computed(() => {
  const session = activeSession.value
  const id = candidateId.value
  const geometry = id ? runtimeNodeGeometryById(id) : undefined
  if (!slots.runtime || !session?.active || session.input !== 'pointer' || !geometry || geometry.rect.width <= 0)
    return undefined
  const height = resolveDesignerDragVisualHeight(geometry.rect.height, candidateNode.value?.kind)
  const position = resolveDesignerDragOverlayPosition(
    session.position,
    session.pointerOffset,
    { width: geometry.rect.width, height },
  )
  return {
    metrics: {
      canvasWidth: externalGeometry.value?.viewport.width ?? sheetRef.value?.clientWidth ?? geometry.rect.width,
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

const effectiveDragOverlayStyle = computed(() => slots.runtime
  ? hostedDragVisual.value?.style
  : dragOverlayStyle.value)

const dragVisualSlotScope = computed<DesignerDragVisualSlotScope | undefined>(() => {
  const metrics = slots.runtime
    ? hostedDragVisual.value?.metrics
    : dragVisualMetrics.value
  if (!metrics)
    return undefined
  return {
    ...runtimeSlotScope.value,
    ...metrics,
  }
})

function nodeLabel(nodeId: string): string {
  const node = findDesignNode(props.graph, nodeId)?.node
  if (!node)
    return nodeId
  if (node.kind === 'field')
    return node.label || node.field
  const material = props.registry.getMaterial(node.component)
  return material ? locale.materialTitle(material) : node.component
}

const editorBridge = computed<ConfigFormRuntimeEditorBridge<Record<string, unknown>>>(() => {
  const selection = selectedSet()
  const primary = props.selectedId
  const dragCandidateId = candidateId.value
  return {
    registerNode: (metadata, element) => {
      nodeElements.set(metadata.nodeId, element)
      resizeObserver?.observe(element)
      elementVersion.value += 1
      return () => {
        if (nodeElements.get(metadata.nodeId) === element)
          nodeElements.delete(metadata.nodeId)
        resizeObserver?.unobserve(element)
        elementVersion.value += 1
      }
    },
    getNodeAttrs: (metadata: ConfigFormRuntimeNodeMetadata<Record<string, unknown>>) => {
      const graphNode = findDesignNode(projectedGraph.value, metadata.nodeId)
      const states = [
        selection.has(metadata.nodeId) ? 'selected' : '',
        primary === metadata.nodeId ? 'primary' : '',
        dragCandidateId === metadata.nodeId ? 'candidate' : '',
        dragCandidateId === metadata.nodeId && candidateUsesFallback.value ? 'visual-source' : '',
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
      const node = findDesignNode(projectedGraph.value, metadata.nodeId)?.node
      const material = node ? props.registry.getMaterial(node.component) : undefined
      const policy = resolveDesignerDesignPolicy(material?.designPolicy)
      return policy.interaction === 'blocked' || !props.interactive
    },
  }
})

interface OverlayBox {
  id: string
  primary: boolean
  style: CSSProperties
}

function relativeSheetRectStyle(rect: DesignerRuntimeRect): CSSProperties {
  const sheet = sheetRef.value
  if (!sheet)
    return {}
  const sheetRect = sheet.getBoundingClientRect()
  return {
    height: `${rect.height / camera.scale}px`,
    left: `${(rect.left - sheetRect.left) / camera.scale}px`,
    top: `${(rect.top - sheetRect.top) / camera.scale}px`,
    width: `${rect.width / camera.scale}px`,
  }
}

const overlayBoxes = computed<OverlayBox[]>(() => {
  elementVersion.value
  if (!selectionOverlayVisible.value)
    return []
  const sheet = sheetRef.value
  if (!sheet)
    return []
  return [...selectedSet()].flatMap((id) => {
    const geometry = runtimeNodeGeometryById(id)
    if (!geometry)
      return []
    const rect = geometry.rect
    return [{
      id,
      primary: id === props.selectedId,
      style: relativeSheetRectStyle(rect),
    }]
  })
})

interface DesignPolicySpot {
  id: string
  message: string
  style: CSSProperties
}

const designPolicySpots = computed<DesignPolicySpot[]>(() => {
  elementVersion.value
  if (!selectionOverlayVisible.value || !props.selectedId)
    return []
  const sheet = sheetRef.value
  if (!sheet)
    return []
  const sheetRect = sheet.getBoundingClientRect()
  const id = props.selectedId
  const geometry = runtimeNodeGeometryById(id)
  const node = findDesignNode(projectedGraph.value, id)?.node
  const material = node ? props.registry.getMaterial(node.component) : undefined
  const policy = resolveDesignerDesignPolicy(material?.designPolicy)
  if (!geometry || policy.render !== 'adapter')
    return []
  const rect = geometry.rect
  return [{
    id,
    message: policy.diagnostic
      || locale.t('node.controlledAdapter', 'Controlled design adapter active'),
    style: {
      left: `${(rect.right - sheetRect.left - 20) / camera.scale}px`,
      top: `${(rect.top - sheetRect.top + 4) / camera.scale}px`,
    },
  }]
})

const collapsedCandidateIndicator = computed<CSSProperties | undefined>(() => {
  elementVersion.value
  const sheet = sheetRef.value
  const id = candidateId.value
  const geometry = id ? runtimeNodeGeometryById(id) : undefined
  if (!sheet || !geometry)
    return undefined
  const rect = geometry.rect
  // A collapsed indicator is only meaningful for a zero-height drop target.
  // Normal controls (including compact inputs) already have a real Runtime
  // box and must not receive a second, invented 36px frame.
  if (rect.width <= 0 || rect.height > 0)
    return undefined
  const sheetRect = sheet.getBoundingClientRect()
  const height = 36
  return {
    height: `${height / camera.scale}px`,
    left: `${(rect.left - sheetRect.left) / camera.scale}px`,
    top: `${(rect.top - sheetRect.top - (height - rect.height) / 2) / camera.scale}px`,
    width: `${rect.width / camera.scale}px`,
  }
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
  const session = activeSession.value
  const id = candidateId.value
  const geometry = id ? runtimeNodeGeometryById(id) : undefined
  const host = dragOverlayRef.value
  if (!session?.active || session.input !== 'pointer' || !geometry || !host) {
    clearDragOverlay()
    return
  }

  const rect = geometry.rect
  if (rect.width <= 0) {
    clearDragOverlay()
    return
  }
  const height = resolveDesignerDragVisualHeight(rect.height, candidateNode.value?.kind)
  const position = resolveDesignerDragOverlayPosition(
    session.position,
    session.pointerOffset,
    { width: rect.width, height },
  )
  if (!slots.runtime) {
    const source = nodeElements.get(id ?? '')
    if (!source) {
      clearDragOverlay()
      return
    }
    dragOverlayHtml.value = createDesignerDragVisualClone(source).outerHTML
  }
  dragVisualMetrics.value = {
    canvasWidth: externalGeometry.value?.viewport.width ?? sheetRef.value?.clientWidth ?? rect.width,
    height,
    width: rect.width,
  }
  dragOverlayStyle.value = {
    height: `${height}px`,
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${rect.width}px`,
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

function acceptedSlot(parent: PageNode, node: PageNode): DesignerMaterialSlotDefinition | undefined {
  if (parent.kind !== 'layout')
    return undefined
  const material = props.registry.getMaterial(parent.component)
  if (!material || material.kind !== 'layout')
    return undefined
  return material.slots.find(slot => (
    (!slot.accepts || slot.accepts.includes(node.kind))
    && (!slot.materials || slot.materials.includes(node.component))
    && (slot.max === undefined || (parent.slots[slot.name]?.length ?? 0) < slot.max)
  ))
}

function hitNodeElements(point: DesignerPointerPosition, candidateId: string): DesignerRuntimeNodeGeometry[] {
  return runtimeNodeGeometry()
    .flatMap((geometry) => {
      if (geometry.nodeId === candidateId)
        return []
      const rect = geometry.rect
      if (rect.width <= 0 || rect.height <= 0
        || point.x < rect.left || point.x > rect.right
        || point.y < rect.top || point.y > rect.bottom) {
        return []
      }
      return [{
        area: rect.width * rect.height,
        geometry,
      }]
    })
    .sort((left, right) => right.geometry.depth - left.geometry.depth
      || left.area - right.area
      || right.geometry.order - left.geometry.order)
    .map(({ geometry }) => geometry)
}

function siblingTarget(nodeId: string, after: boolean): DesignerDropTarget | undefined {
  const location = findDesignNode(props.graph, nodeId)
  if (!location)
    return undefined
  const index = location.index + (after ? 1 : 0)
  return location.parentId !== null && location.slot
    ? { parentId: location.parentId, slot: location.slot, index }
    : { parentId: null, index }
}

function isValidTarget(target: DesignerDropTarget, source = activeSession.value?.source): boolean {
  const command = candidateCommandForSource(source, target)
  if (!command)
    return false
  return props.candidatePreview(command) !== undefined
}

function keyboardDropTargets(source: DesignerDragSource): DesignerDropTarget[] {
  const node = nodeForDragSource(source)
  if (!node)
    return []
  const targets: DesignerDropTarget[] = []
  for (let index = 0; index <= props.graph.root.length; index += 1)
    targets.push({ parentId: null, index })

  const visit = (items: PageGraph['root']): void => {
    for (const item of items) {
      const parent = props.graph.nodesById[item.nodeId]
      if (!parent || parent.kind !== 'layout')
        continue
      const material = props.registry.getMaterial(parent.component)
      if (material?.kind === 'layout') {
        for (const slot of material.slots) {
          const children = parent.slots[slot.name] ?? []
          const accepts = (!slot.accepts || slot.accepts.includes(node.kind))
            && (!slot.materials || slot.materials.includes(node.component))
          if (accepts) {
            for (let index = 0; index <= children.length; index += 1)
              targets.push({ parentId: parent.id, slot: slot.name, index })
          }
          visit(children)
        }
      }
    }
  }
  visit(props.graph.root)
  return targets.filter(target => isValidTarget(target, source))
}

function scheduleCanvasAutoScroll(point: DesignerPointerPosition): void {
  autoScrollPoint = point
  if (autoScrollFrame !== undefined)
    return
  autoScrollFrame = window.requestAnimationFrame(runCanvasAutoScroll)
}

function runCanvasAutoScroll(): void {
  autoScrollFrame = undefined
  const point = autoScrollPoint
  const viewport = cameraViewportRef.value
  if (!point || !viewport || !activeSession.value?.active || activeSession.value.input !== 'pointer')
    return
  const delta = resolveDesignerAutoScrollDelta(point, viewport.getBoundingClientRect())
  if (delta.x !== 0 || delta.y !== 0) {
    viewport.scrollBy(delta.x, delta.y)
    elementVersion.value += 1
    dragController?.move(point)
  }
  autoScrollFrame = window.requestAnimationFrame(runCanvasAutoScroll)
}

function stopCanvasAutoScroll(): void {
  autoScrollPoint = undefined
  if (autoScrollFrame !== undefined)
    window.cancelAnimationFrame(autoScrollFrame)
  autoScrollFrame = undefined
}

function resolveDropTarget(
  point: DesignerPointerPosition,
  source: DesignerDragSource,
  previous?: DesignerDropTarget,
): DesignerDropTarget | undefined {
  const sheet = sheetRef.value
  const node = candidateNode.value
  if (!sheet || !node)
    return undefined
  scheduleCanvasAutoScroll(point)
  const sheetRect = sheet.getBoundingClientRect()
  if (point.x < sheetRect.left || point.x > sheetRect.right || point.y < sheetRect.top || point.y > sheetRect.bottom)
    return undefined

  const hits = hitNodeElements(point, source.candidateId)
  const hit = hits[0]
  const hitId = hit?.nodeId
  const collapsedTarget = resolveDesignerCollapsedDropTarget(
    point,
    runtimeNodeGeometry().flatMap((geometry) => {
      if (geometry.nodeId === source.candidateId)
        return []
      const location = findDesignNode(props.graph, geometry.nodeId)
      if (!location)
        return []
      const slot = acceptedSlot(location.node, node)
      if (!slot)
        return []
      const target = {
        parentId: location.node.id,
        slot: slot.name,
        index: location.node.kind === 'layout' ? (location.node.slots[slot.name]?.length ?? 0) : 0,
      } satisfies DesignerDropTarget
      if (!isValidTarget(target))
        return []
      const rect = geometry.rect
      return [{
        depth: location.path.length,
        rect: {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        },
        specificity: slot.materials?.includes(node.component) ? 1 : 0,
        target,
      }]
    }),
  )
  if (collapsedTarget)
    return collapsedTarget

  if (!hitId) {
    const target = { parentId: null, index: props.graph.root.length } satisfies DesignerDropTarget
    return isValidTarget(target) ? target : previous
  }

  const insideTargets = hits.flatMap((geometry, depth) => {
    const location = findDesignNode(props.graph, geometry.nodeId)
    if (!location)
      return []
    const rect = geometry.rect
    const verticalRatio = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5
    const slot = acceptedSlot(location.node, node)
    if (!slot || verticalRatio < 0.2 || verticalRatio > 0.8)
      return []
    const target = {
      parentId: location.node.id,
      slot: slot.name,
      index: location.node.kind === 'layout' ? (location.node.slots[slot.name]?.length ?? 0) : 0,
    } satisfies DesignerDropTarget
    return isValidTarget(target)
      ? [{ depth, specific: slot.materials?.includes(node.component) ? 1 : 0, target }]
      : []
  }).sort((left, right) => right.specific - left.specific || left.depth - right.depth)
  if (insideTargets[0])
    return insideTargets[0].target

  const stickyTarget = resolveStickyDesignerDropTarget(
    previous,
    hits.map(geometry => geometry.nodeId),
    isValidTarget,
  )
  if (stickyTarget)
    return stickyTarget

  const location = findDesignNode(props.graph, hitId)
  if (!location)
    return previous
  const rect = hit.rect
  const verticalRatio = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5
  const target = siblingTarget(hitId, verticalRatio > 0.5)
  return target && isValidTarget(target) ? target : previous
}

function nodeIdFromEvent(event: Event): string | undefined {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-config-node-id]')
    : undefined
  const directNodeId = target?.dataset.configNodeId
  if (directNodeId && directNodeId !== candidateId.value)
    return directNodeId
  if (!('clientX' in event) || !('clientY' in event)
    || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
    return undefined
  }
  const nodeId = hitNodeElements(
    { x: event.clientX, y: event.clientY },
    candidateId.value ?? '',
  )[0]?.nodeId
  return nodeId && nodeId !== candidateId.value ? nodeId : undefined
}

function dragHandleNodeIdFromEvent(event: Event): string | undefined {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-designer-drag-node-id]')?.dataset.designerDragNodeId
    : undefined
}

function selectionMode(event: MouseEvent | PointerEvent): DesignerSelectionMode {
  return event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'replace'
}

function isEditorControlEvent(event: Event): boolean {
  return event.target instanceof Element && Boolean(event.target.closest('[data-designer-editor-control]'))
}

function nodeActionMenuElement(): HTMLElement | undefined {
  return sheetRef.value?.querySelector<HTMLElement>('[data-node-action-menu]') ?? undefined
}

function nodeActionMenuTriggerElement(): HTMLButtonElement | undefined {
  return sheetRef.value?.querySelector<HTMLButtonElement>('[data-node-action-menu-trigger]') ?? undefined
}

function closeNodeActionMenu(restoreFocus = false): void {
  if (!nodeActionMenuNodeId.value)
    return
  nodeActionMenuNodeId.value = undefined
  if (restoreFocus)
    void nextTick(() => nodeActionMenuTriggerElement()?.focus({ preventScroll: true }))
}

async function toggleNodeActionMenu(nodeId: string): Promise<void> {
  if (nodeActionMenuNodeId.value === nodeId) {
    closeNodeActionMenu(true)
    return
  }
  nodeActionMenuNodeId.value = nodeId
  await nextTick()
  nodeActionMenuElement()?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true })
}

function runNodeAction(action: DesignerNodeAction, nodeId: string): void {
  closeNodeActionMenu()
  emit('action', action, nodeId)
  void nextTick(() => nodeActionMenuTriggerElement()?.focus({ preventScroll: true }))
}

function moveMenuFocus(event: KeyboardEvent, container: HTMLElement, selector: string): boolean {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
    return false
  const items = [...container.querySelectorAll<HTMLButtonElement>(selector)]
  if (items.length === 0)
    return false
  event.preventDefault()
  const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
  const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? items.length - 1
      : forward
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length
  items[next]?.focus({ preventScroll: true })
  return true
}

function handleNodeActionMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeNodeActionMenu(true)
    return
  }
  moveMenuFocus(event, event.currentTarget as HTMLElement, '[role="menuitem"]:not(:disabled)')
}

function handleNodeToolbarKeydown(event: KeyboardEvent): void {
  if (event.target instanceof Element && event.target.closest('[role="menu"]'))
    return
  moveMenuFocus(event, event.currentTarget as HTMLElement, '[data-node-toolbar-button]:not(:disabled)')
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!nodeActionMenuNodeId.value || !(event.target instanceof Node))
    return
  if (nodeActionMenuElement()?.contains(event.target) || nodeActionMenuTriggerElement()?.contains(event.target))
    return
  closeNodeActionMenu()
}

async function focusEditorNode(nodeId: string): Promise<void> {
  await nextTick()
  const target = [...(sheetRef.value?.querySelectorAll<HTMLElement>('[data-editor-focus-node-id]') ?? [])]
    .find(element => element.dataset.editorFocusNodeId === nodeId)
  target?.focus({ preventScroll: true })
}

function handleCanvasPointerDown(event: PointerEvent): void {
  if (isEditorControlEvent(event))
    return
  const nodeId = dragHandleNodeIdFromEvent(event) ?? nodeIdFromEvent(event)
  if (nodeId)
    emit('select', nodeId, selectionMode(event))
  else
    emit('select', '')
  if (!props.interactive) {
    event.preventDefault()
    if (nodeId)
      void focusEditorNode(nodeId)
  }
}

function handleCanvasClick(event: MouseEvent): void {
  if (!isEditorControlEvent(event) && !nodeIdFromEvent(event))
    emit('select', '')
}

function handleCanvasSelectStart(event: Event): void {
  if (!props.interactive)
    event.preventDefault()
}

function handleCanvasKeydown(event: KeyboardEvent): void {
  if (dragHandleNodeIdFromEvent(event))
    return
  if (isEditorControlEvent(event))
    return
  const keyboardSession = activeSession.value?.input === 'keyboard' && activeSession.value.active
  if (keyboardSession) {
    if (event.key === 'Escape') {
      event.preventDefault()
      dragController?.cancel()
    }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      dragController?.finishKeyboard()
    }
    else if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      dragController?.moveKeyboard(event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 'next' : 'previous')
    }
    return
  }
  if (props.interactive)
    return
  const nodeId = nodeIdFromEvent(event) ?? props.selectedId
  if (!nodeId)
    return
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('select', nodeId, event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'replace')
  }
  else if (event.key === ' ') {
    event.preventDefault()
    dragController?.beginNodeKeyboard(nodeId)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    emit('action', 'moveBefore', nodeId)
  }
  else if (event.key === 'ArrowDown') {
    event.preventDefault()
    emit('action', 'moveAfter', nodeId)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    emit('action', 'indent', nodeId)
  }
  else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('action', 'outdent', nodeId)
  }
  else if (event.key === 'Delete') {
    event.preventDefault()
    emit('action', 'remove', nodeId)
  }
}

function handleNodeDragMove(event: PointerEvent): void {
  if (event.pointerId !== activeDragPointer)
    return
  if (dragController?.move({ x: event.clientX, y: event.clientY }))
    event.preventDefault()
}

function cleanupNodeDrag(): void {
  activeDragPointerTarget?.removeEventListener('lostpointercapture', handleNodeLostPointerCapture)
  if (activeDragPointer !== undefined && activeDragPointerTarget?.hasPointerCapture?.(activeDragPointer))
    activeDragPointerTarget.releasePointerCapture(activeDragPointer)
  activeDragPointer = undefined
  activeDragPointerTarget = undefined
  stopCanvasAutoScroll()
  window.removeEventListener('pointermove', handleNodeDragMove)
  window.removeEventListener('pointerup', handleNodeDragEnd)
  window.removeEventListener('pointercancel', handleNodeDragCancel)
}

function handleNodeLostPointerCapture(event: PointerEvent): void {
  if (event.pointerId !== activeDragPointer)
    return
  dragController?.cancel()
  cleanupNodeDrag()
}

function handleNodeDragEnd(event: PointerEvent): void {
  if (event.pointerId !== activeDragPointer)
    return
  dragController?.finish({ x: event.clientX, y: event.clientY })
  cleanupNodeDrag()
}

function handleNodeDragCancel(event: PointerEvent): void {
  if (event.pointerId !== activeDragPointer)
    return
  dragController?.cancel()
  cleanupNodeDrag()
}

function beginNodeDrag(event: PointerEvent, nodeId: string): void {
  if (props.readonly || !dragController || event.button !== 0)
    return
  closeNodeActionMenu()
  event.preventDefault()
  event.stopPropagation()
  activeDragPointer = event.pointerId
  activeDragPointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  activeDragPointerTarget?.setPointerCapture?.(event.pointerId)
  activeDragPointerTarget?.addEventListener('lostpointercapture', handleNodeLostPointerCapture)
  const point = { x: event.clientX, y: event.clientY }
  const sourceRect = runtimeNodeGeometryById(nodeId)?.rect
  const pointerOffset = sourceRect
    && point.x >= sourceRect.left && point.x <= sourceRect.right
    && point.y >= sourceRect.top && point.y <= sourceRect.bottom
    ? { x: point.x - sourceRect.left, y: point.y - sourceRect.top }
    : { x: 16, y: 16 }
  dragController.beginNode(nodeId, point, pointerOffset)
  window.addEventListener('pointermove', handleNodeDragMove, { passive: false })
  window.addEventListener('pointerup', handleNodeDragEnd)
  window.addEventListener('pointercancel', handleNodeDragCancel)
}

function beginNodeKeyboard(nodeId: string): void {
  if (!props.readonly)
    dragController?.beginNodeKeyboard(nodeId)
}

function handleNodeDragHandleKeydown(event: KeyboardEvent, nodeId: string): void {
  const keyboardSession = activeSession.value?.input === 'keyboard' && activeSession.value.active
  if (event.key === 'Escape' && keyboardSession) {
    event.preventDefault()
    event.stopPropagation()
    dragController?.cancel()
    return
  }
  if (event.key.startsWith('Arrow') && keyboardSession) {
    event.preventDefault()
    event.stopPropagation()
    dragController?.moveKeyboard(event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 'next' : 'previous')
    return
  }
  if (event.key !== ' ')
    return
  event.preventDefault()
  event.stopPropagation()
  if (keyboardSession)
    dragController?.finishKeyboard()
  else
    beginNodeKeyboard(nodeId)
}

function isNodeKeyboardDragging(nodeId: string): boolean {
  const session = activeSession.value
  return Boolean(session?.active && session.input === 'keyboard' && session.source.type === 'node' && session.source.nodeId === nodeId)
}

function canResize(nodeId: string): boolean {
  return !props.readonly
    && !props.graph.form.inline
    && findDesignNode(props.graph, nodeId)?.parentId === null
}

function beginResize(event: PointerEvent, nodeId: string): void {
  const location = findDesignNode(props.graph, nodeId)
  const layoutRect = runtimeLayoutRect()
  if (!location || !layoutRect || !canResize(nodeId))
    return
  event.preventDefault()
  event.stopPropagation()
  resizeCleanup?.()
  resizingNodeId.value = nodeId
  const layout = resolveConfigFormLayout(
    props.graph.form.columns,
    props.graph.form.fieldSpan,
    props.graph.form.responsive,
    props.breakpoint ?? 'desktop',
  )
  const startSpan = typeof location.placement.span === 'number' ? location.placement.span : layout.fieldSpan
  const startX = event.clientX
  const width = layoutRect.width || 1
  const pointerId = event.pointerId
  const pointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  pointerTarget?.setPointerCapture?.(pointerId)
  let nextSpan = startSpan
  const move = (moveEvent: PointerEvent): void => {
    if (moveEvent.pointerId !== pointerId)
      return
    const delta = Math.round((moveEvent.clientX - startX) / width * layout.columns)
    nextSpan = Math.min(layout.columns, Math.max(1, startSpan + delta))
  }
  const moveFromRuntime = (moveEvent: DesignerRuntimePointerPayload): void => {
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
      emit('resize', nodeId, nextSpan)
  }
  const cancel = (): void => resizeCleanup?.()
  const lostCapture = (lostEvent: PointerEvent): void => {
    if (lostEvent.pointerId === pointerId)
      resizeCleanup?.()
  }
  pointerTarget?.addEventListener('lostpointercapture', lostCapture)
  runtimePointerMove = moveFromRuntime
  runtimePointerUp = finish
  runtimePointerCancel = cancel
  resizeCleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    pointerTarget?.removeEventListener('lostpointercapture', lostCapture)
    if (pointerTarget?.hasPointerCapture?.(pointerId))
      pointerTarget.releasePointerCapture(pointerId)
    runtimePointerMove = undefined
    runtimePointerUp = undefined
    runtimePointerCancel = undefined
    resizeCleanup = undefined
    resizingNodeId.value = undefined
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
}

watch(() => props.breakpoint, () => {
  void nextTick(() => {
    elementVersion.value += 1
    scheduleCanvasCameraMeasure()
  })
})

watch(() => camera.scale, () => {
  void nextTick(() => {
    elementVersion.value += 1
    if (activeSession.value?.active && activeSession.value.input === 'pointer')
      scheduleDragOverlay()
  })
})

watch([activeSession, elementVersion], ([session]) => {
  if (session?.active) {
    closeNodeActionMenu()
  }
  if (session?.active && session.input === 'pointer')
    scheduleDragOverlay()
  else
    clearDragOverlay()
}, { flush: 'post' })

watch(overlayMode, mode => designSession?.publishOverlayMode(mode), { immediate: true })

watch(() => props.selectedId, () => closeNodeActionMenu())

watch(() => props.readonly, (readonly) => {
  if (!readonly)
    return
  dragController?.cancel()
  cleanupNodeDrag()
  clearDragOverlay()
  resizeCleanup?.()
  closeNodeActionMenu()
})

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      elementVersion.value += 1
      scheduleCanvasCameraMeasure()
    })
    if (sheetRef.value)
      resizeObserver.observe(sheetRef.value)
    if (cameraViewportRef.value)
      resizeObserver.observe(cameraViewportRef.value)
  }
  scheduleCanvasCameraMeasure()
  unregisterDropResolver = dragController?.registerResolver(resolveDropTarget)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('keyup', handleDocumentKeyup)
  window.addEventListener('blur', handleWindowBlur)
})

// Keyboard destinations only depend on the graph and registry, so register them
// before the first paint. This keeps a fast Space press from racing Canvas mount.
unregisterKeyboardTargets = dragController?.registerKeyboardTargets(keyboardDropTargets)

onBeforeUnmount(() => {
  unregisterDropResolver?.()
  unregisterKeyboardTargets?.()
  resizeObserver?.disconnect()
  cleanupNodeDrag()
  clearDragOverlay()
  cameraPanCleanup?.()
  if (cameraMeasureFrame !== undefined)
    window.cancelAnimationFrame(cameraMeasureFrame)
  resizeCleanup?.()
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.removeEventListener('keyup', handleDocumentKeyup)
  window.removeEventListener('blur', handleWindowBlur)
  designSession?.publishCandidate(undefined)
  designSession?.publishGeometry(undefined)
  designSession?.publishOverlayMode('idle')
})
</script>

<template>
  <main
    ref="canvasRef"
    class="mx-config-form-designer__canvas"
    :class="{ 'is-dragging': activeSession?.active, 'is-camera-panning': cameraPanning }"
    :aria-label="locale.t('canvas.form', 'Form canvas')"
    :aria-describedby="showEmptyCanvas ? emptyCanvasDescriptionId : undefined"
    :data-camera-mode="camera.mode"
    :data-camera-scale="camera.scale"
    :data-preview-breakpoint="breakpoint ?? 'desktop'"
    :data-editor-overlay-mode="overlayMode"
    tabindex="-1"
    @pointerenter="cameraHovered = true"
    @pointerleave="cameraHovered = false"
  >
    <div v-if="showInteractiveToggle" class="mx-config-form-designer__canvas-tools mx-config-form-designer__segmented" role="group" :aria-label="locale.t('canvas.tools', 'Canvas tools')">
      <button
        type="button"
        :class="{ 'is-active': interactive }"
        :aria-label="locale.t('canvas.linkagePreview', 'Linkage preview')"
        :title="locale.t('canvas.linkagePreview', 'Linkage preview')"
        :aria-pressed="Boolean(interactive)"
        data-command-hint
        @click.stop="emit('toggleInteractive')"
      >
        <Workflow :size="15" aria-hidden="true" />
      </button>
    </div>

    <div
      ref="cameraViewportRef"
      class="mx-config-form-designer__canvas-viewport"
      data-canvas-camera-viewport
      @scroll="updateCameraPan"
    >
      <div class="mx-config-form-designer__camera-sizer" :style="cameraSizerStyle">
        <div
          ref="sheetRef"
          class="mx-config-form-designer__canvas-sheet mx-config-form-designer__runtime-surface"
          :data-sheet-breakpoint="breakpoint ?? 'desktop'"
          :data-intrinsic-width="intrinsicFrameWidth"
          :style="cameraSheetStyle"
          role="group"
          @pointerdown.capture="handleCanvasPointerDown"
          @click="handleCanvasClick"
          @selectstart="handleCanvasSelectStart"
          @keydown.capture="handleCanvasKeydown"
        >
      <slot name="runtime" v-bind="runtimeSlotScope">
        <ConfigFormRenderer
          v-model="surfaceModel"
          :fields="renderer.fields"
          :components="renderer.components"
          :namespace="registry.rendererNamespace"
          :readonly="renderer.readonly"
          :inline="renderer.inline"
          :columns="renderer.columns"
          :gap="renderer.gap"
          :field-span="renderer.fieldSpan"
          :label-position="renderer.labelPosition"
          :responsive="renderer.responsive"
          :breakpoint="breakpoint"
          :editor="editorBridge"
          :aria-hidden="!interactive ? 'true' : undefined"
          :inert="!interactive ? true : undefined"
          mode="design"
        />
      </slot>

          <div v-if="showEmptyCanvas" :id="emptyCanvasDescriptionId" class="mx-config-form-designer__canvas-empty">
            {{ locale.t('canvas.emptyGuide', 'Drag or click a component on the left to add a field') }}
          </div>

          <div class="mx-config-form-designer__editor-overlay">
        <div
          v-if="collapsedCandidateIndicator"
          class="mx-config-form-designer__collapsed-drop-indicator"
          :style="collapsedCandidateIndicator"
        />
        <div
          v-for="box in overlayBoxes"
          :key="box.id"
          class="mx-config-form-designer__selection-box"
          :class="{ 'is-primary': box.primary, 'is-resizing': overlayMode === 'resizing' && box.id === resizingNodeId }"
          :style="box.style"
          :aria-label="box.primary ? locale.t('node.select', 'Select {label}', { label: nodeLabel(box.id) }) : undefined"
          :data-editor-focus-node-id="box.primary ? box.id : undefined"
          :role="box.primary ? 'group' : undefined"
          :tabindex="box.primary ? -1 : undefined"
        >
          <div
            v-if="box.primary"
            class="mx-config-form-designer__node-actions"
            role="toolbar"
            :aria-label="locale.t('node.actions', 'Node actions')"
            aria-hidden="false"
            data-designer-editor-control
            @keydown="handleNodeToolbarKeydown"
          >
            <button data-node-toolbar-button type="button" class="mx-config-form-designer__icon-button mx-config-form-designer__drag-handle" :aria-disabled="readonly ? 'true' : undefined" :data-command-disabled-reason="readonly ? locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only') : undefined" data-command-hint data-command-shortcut="Space" aria-keyshortcuts="Space" :title="locale.t('node.move', 'Move')" :aria-label="locale.t('node.moveNode', 'Move node')" :aria-pressed="isNodeKeyboardDragging(box.id)" :data-designer-drag-node-id="box.id" @keydown="handleNodeDragHandleKeydown($event, box.id)" @pointerdown="beginNodeDrag($event, box.id)"><GripVertical :size="16" aria-hidden="true" /></button>
            <button data-node-toolbar-button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="readonly ? 'true' : undefined" :data-command-disabled-reason="readonly ? locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only') : undefined" data-command-hint data-command-shortcut="Ctrl/Cmd+D" aria-keyshortcuts="Control+D Meta+D" :title="locale.t('node.copy', 'Copy')" :aria-label="locale.t('node.copyNode', 'Copy node')" @click.stop="!readonly && emit('action', 'copy', box.id)"><Copy :size="15" aria-hidden="true" /></button>
            <button data-node-toolbar-button type="button" class="mx-config-form-designer__icon-button is-danger" :aria-disabled="readonly ? 'true' : undefined" :data-command-disabled-reason="readonly ? locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only') : undefined" data-command-hint data-command-shortcut="Delete" aria-keyshortcuts="Delete Backspace" :title="locale.t('node.delete', 'Delete')" :aria-label="locale.t('node.deleteNode', 'Delete node')" @click.stop="!readonly && emit('action', 'remove', box.id)"><Trash2 :size="15" aria-hidden="true" /></button>
            <button
              :id="`${nodeActionMenuId}-trigger`"
              data-node-toolbar-button
              data-node-action-menu-trigger
              type="button"
              class="mx-config-form-designer__icon-button"
              :aria-disabled="readonly ? 'true' : undefined"
              :data-command-disabled-reason="readonly ? locale.t('action.readonlyUnavailable', 'Editing is unavailable while the designer is read-only') : undefined"
              data-command-hint
              :title="locale.t('node.moreActions', 'More actions')"
              :aria-label="locale.t('node.moreActions', 'More actions')"
              aria-haspopup="menu"
              :aria-controls="nodeActionMenuId"
              :aria-expanded="nodeActionMenuNodeId === box.id"
              @click.stop="!readonly && toggleNodeActionMenu(box.id)"
            >
              <MoreHorizontal :size="16" aria-hidden="true" />
            </button>
            <div
              v-if="nodeActionMenuNodeId === box.id"
              :id="nodeActionMenuId"
              class="mx-config-form-designer__node-action-menu"
              data-node-action-menu
              role="menu"
              :aria-labelledby="`${nodeActionMenuId}-trigger`"
              @keydown="handleNodeActionMenuKeydown"
            >
              <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.moveNodeUp', 'Move node up')" @click.stop="runNodeAction('moveBefore', box.id)"><ChevronUp :size="15" aria-hidden="true" /><span>{{ locale.t('node.moveUp', 'Move up') }}</span></button>
              <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.moveNodeDown', 'Move node down')" @click.stop="runNodeAction('moveAfter', box.id)"><ChevronDown :size="15" aria-hidden="true" /><span>{{ locale.t('node.moveDown', 'Move down') }}</span></button>
              <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.indentNode', 'Move node into previous container')" @click.stop="runNodeAction('indent', box.id)"><CornerDownRight :size="15" aria-hidden="true" /><span>{{ locale.t('node.indent', 'Indent') }}</span></button>
              <button type="button" role="menuitem" tabindex="-1" :aria-label="locale.t('node.outdentNode', 'Move node out of container')" @click.stop="runNodeAction('outdent', box.id)"><CornerDownLeft :size="15" aria-hidden="true" /><span>{{ locale.t('node.outdent', 'Outdent') }}</span></button>
            </div>
          </div>
          <button
            v-if="box.primary && canResize(box.id)"
            type="button"
            class="mx-config-form-designer__resize-handle"
            :aria-label="locale.t('node.resize', 'Resize node')"
            :title="locale.t('node.resize', 'Resize node')"
            aria-hidden="false"
            data-command-hint
            data-designer-editor-control
            @pointerdown="beginResize($event, box.id)"
          />
        </div>
        <span
          v-for="spot in designPolicySpots"
          :key="`design-policy-${spot.id}`"
          class="mx-config-form-designer__design-policy-spot"
          :style="spot.style"
          :title="spot.message"
          :aria-label="spot.message"
          data-designer-editor-control
          role="img"
          tabindex="0"
        >
          <TriangleAlert :size="13" aria-hidden="true" />
        </span>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="spacePressed || cameraPanning"
      class="mx-config-form-designer__camera-gesture-layer"
      :class="{ 'is-panning': cameraPanning }"
      aria-hidden="true"
      @pointerdown="beginCameraPan"
    />
    <div class="mx-config-form-designer__camera-controls" role="group" :aria-label="locale.t('canvas.camera', 'Canvas zoom and pan')" data-designer-editor-control>
      <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="camera.scale <= CANVAS_MIN_SCALE ? 'true' : undefined" :data-command-disabled-reason="camera.scale <= CANVAS_MIN_SCALE ? locale.t('canvas.minimumZoom', 'Minimum zoom reached') : undefined" data-command-hint data-command-shortcut="-" aria-keyshortcuts="-" :aria-label="locale.t('canvas.zoomOut', 'Zoom out')" :title="locale.t('canvas.zoomOut', 'Zoom out')" @click="camera.scale > CANVAS_MIN_SCALE && zoomCamera('out')">
        <ZoomOut :size="16" aria-hidden="true" />
      </button>
      <button type="button" class="mx-config-form-designer__camera-percent" data-command-hint data-command-shortcut="0" aria-keyshortcuts="0" :aria-label="locale.t('canvas.actualSize', 'Actual size')" :title="locale.t('canvas.actualSizeHint', 'Actual size (100%)')" @click="resetCamera">
        {{ cameraPercent }}%
      </button>
      <button type="button" class="mx-config-form-designer__icon-button" :aria-disabled="camera.scale >= CANVAS_MAX_SCALE ? 'true' : undefined" :data-command-disabled-reason="camera.scale >= CANVAS_MAX_SCALE ? locale.t('canvas.maximumZoom', 'Maximum zoom reached') : undefined" data-command-hint data-command-shortcut="+" aria-keyshortcuts="Shift+=" :aria-label="locale.t('canvas.zoomIn', 'Zoom in')" :title="locale.t('canvas.zoomIn', 'Zoom in')" @click="camera.scale < CANVAS_MAX_SCALE && zoomCamera('in')">
        <ZoomIn :size="16" aria-hidden="true" />
      </button>
      <span class="mx-config-form-designer__camera-separator" aria-hidden="true" />
      <button type="button" class="mx-config-form-designer__icon-button" :class="{ 'is-active': camera.mode === 'fit' }" data-command-hint data-command-shortcut="Shift+1" aria-keyshortcuts="Shift+1" :aria-label="locale.t('canvas.fit', 'Fit canvas')" :title="locale.t('canvas.fitHint', 'Fit canvas (Shift+1)')" :aria-pressed="camera.mode === 'fit'" @click="fitCamera">
        <Scan :size="16" aria-hidden="true" />
      </button>
    </div>
    <div
      ref="dragOverlayRef"
      v-show="effectiveDragOverlayStyle"
      class="mx-config-form-designer__drag-overlay"
      :style="effectiveDragOverlayStyle"
      aria-hidden="true"
      data-designer-drag-overlay
    >
      <slot v-if="slots.runtime && dragVisualSlotScope" name="dragVisual" v-bind="dragVisualSlotScope" />
      <div v-else-if="dragOverlayHtml" class="mx-config-form-designer__drag-overlay-content" v-html="dragOverlayHtml" />
    </div>
  </main>
</template>
