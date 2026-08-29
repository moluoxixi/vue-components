<script setup lang="ts">
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { ConfigFormBreakpoint, RuntimeEditorBridge, RuntimeNodeMetadata } from '@moluoxixi/config-form/renderer'
import type { ComputedRef, CSSProperties } from 'vue'
import type { DesignerDocument, DesignerNode } from '../document'
import type { DesignerCommand, DesignerDropTarget } from '../history'
import type { DesignerMaterialSlotDefinition, DesignerRegistry } from '../registry'
import type { DesignerSelectionMode } from '../composables'
import type { DesignerNodeAction } from './types'
import type { DesignerDragSource, DesignerPointerPosition } from './designer-drag'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownLeft,
  CornerDownRight,
  GripVertical,
  TriangleAlert,
  Trash2,
  Workflow,
} from '@lucide/vue'
import { RuntimeSurface, resolveConfigFormLayout } from '@moluoxixi/config-form/renderer'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createDesignerRuntimeProjection } from '../compiler'
import { findDesignerNode, reduceDesignerCommand } from '../history'
import { useDesignerLocale } from '../locale'
import { resolveDesignerDesignPolicy } from '../registry'
import {
  createDesignerMaterialCandidate,
  DESIGNER_DRAG_KEY,
  resolveDesignerAutoScrollDelta,
  resolveDesignerCollapsedDropTarget,
  resolveStickyDesignerDropTarget,
} from './designer-drag'

const props = defineProps<{
  document: DesignerDocument
  registry: DesignerRegistry
  selectedId?: string
  selectedIds?: string[]
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
  interactive?: boolean
  model?: Record<string, unknown>
  reactionProps?: ConfigFormReactionProjection['props']
  reactionStates?: ConfigFormReactionProjection['states']
}>()

const emit = defineEmits<{
  select: [nodeId: string, mode?: DesignerSelectionMode]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
  toggleInteractive: []
  updateField: [field: string, value: unknown]
  resize: [nodeId: string, span: number]
}>()

const locale = useDesignerLocale()
const dragController = inject(DESIGNER_DRAG_KEY, undefined)
const sheetRef = ref<HTMLElement>()
const nodeElements = new Map<string, HTMLElement>()
const elementVersion = ref(0)
let resizeObserver: ResizeObserver | undefined
let unregisterDropResolver: (() => void) | undefined
let unregisterKeyboardTargets: (() => void) | undefined
let activeDragPointer: number | undefined
let activeDragPointerTarget: HTMLElement | undefined
let autoScrollFrame: number | undefined
let autoScrollPoint: DesignerPointerPosition | undefined
let resizeCleanup: (() => void) | undefined
let pointerSelection: { nodeId: string, startedAt: number } | undefined

const activeSession = computed(() => dragController?.session.value)
const candidateId = computed(() => activeSession.value?.active
  ? activeSession.value.source.candidateId
  : undefined)

function nodeForDragSource(source: DesignerDragSource | undefined): DesignerNode | undefined {
  if (!source)
    return undefined
  if (source.type === 'node')
    return findDesignerNode(props.document, source.nodeId)?.node

  return createDesignerMaterialCandidate(props.registry, source.materialKey, source.candidateId)
}

const candidateNode = computed<DesignerNode | undefined>(() => nodeForDragSource(activeSession.value?.source))

function candidateCommandForSource(source: DesignerDragSource | undefined, target: DesignerDropTarget): DesignerCommand | undefined {
  if (!source)
    return undefined
  if (source.type === 'node')
    return { type: 'moveNode', nodeId: source.nodeId, target }
  const node = nodeForDragSource(source)
  return node
    ? { type: 'addNode', node, target }
    : undefined
}

function candidateCommand(target: DesignerDropTarget): DesignerCommand | undefined {
  return candidateCommandForSource(activeSession.value?.source, target)
}

const projectedDocument = computed(() => {
  const session = activeSession.value
  if (!session?.active || !session.target)
    return props.document
  const command = candidateCommand(session.target)
  if (!command)
    return props.document
  const result = reduceDesignerCommand(props.document, command, props.registry)
  return result.changed ? result.document : props.document
})

const renderer = computed(() => createDesignerRuntimeProjection(projectedDocument.value, props.registry))

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

function nodeLabel(nodeId: string): string {
  const node = findDesignerNode(props.document, nodeId)?.node
  if (!node)
    return nodeId
  if (node.kind === 'field')
    return node.label || node.field
  const material = props.registry.getMaterial(node.material)
  return material ? locale.materialTitle(material) : node.material
}

const editorBridge = computed<RuntimeEditorBridge<Record<string, unknown>>>(() => {
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
    getNodeAttrs: (metadata: RuntimeNodeMetadata<Record<string, unknown>>) => {
      const documentNode = findDesignerNode(projectedDocument.value, metadata.nodeId)?.node
      const states = [
        selection.has(metadata.nodeId) ? 'selected' : '',
        primary === metadata.nodeId ? 'primary' : '',
        dragCandidateId === metadata.nodeId ? 'candidate' : '',
      ].filter(Boolean).join(' ')
      return {
        'aria-label': locale.t('node.select', 'Select {label}', { label: nodeLabel(metadata.nodeId) }),
        'data-config-node-state': states || undefined,
        'data-designer-draggable': dragCandidateId === metadata.nodeId ? undefined : '',
        'data-designer-span': documentNode?.span,
        'data-focus-node-id': metadata.nodeId,
        'data-material': documentNode?.material,
        'data-node-kind': documentNode?.kind,
        'onClick': (event: MouseEvent) => {
          if (pointerSelection?.nodeId === metadata.nodeId && performance.now() - pointerSelection.startedAt < 500) {
            pointerSelection = undefined
            return
          }
          emit('select', metadata.nodeId, selectionMode(event))
        },
        'onFocus': () => {
          if (pointerSelection?.nodeId === metadata.nodeId && performance.now() - pointerSelection.startedAt < 500)
            return
          emit('select', metadata.nodeId)
        },
        'role': 'group',
        'tabindex': dragCandidateId === metadata.nodeId ? -1 : 0,
      }
    },
    interceptEvent: ({ metadata }) => {
      const node = findDesignerNode(projectedDocument.value, metadata.nodeId)?.node
      const material = node ? props.registry.getMaterial(node.material) : undefined
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

const overlayBoxes = computed<OverlayBox[]>(() => {
  elementVersion.value
  const sheet = sheetRef.value
  if (!sheet)
    return []
  const sheetRect = sheet.getBoundingClientRect()
  return [...selectedSet()].flatMap((id) => {
    const element = nodeElements.get(id)
    if (!element)
      return []
    const rect = element.getBoundingClientRect()
    return [{
      id,
      primary: id === props.selectedId,
      style: {
        height: `${rect.height}px`,
        left: `${rect.left - sheetRect.left}px`,
        top: `${rect.top - sheetRect.top}px`,
        width: `${rect.width}px`,
      },
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
  const sheet = sheetRef.value
  if (!sheet)
    return []
  const sheetRect = sheet.getBoundingClientRect()
  return [...nodeElements.entries()].flatMap(([id, element]) => {
    const node = findDesignerNode(projectedDocument.value, id)?.node
    const material = node ? props.registry.getMaterial(node.material) : undefined
    const policy = resolveDesignerDesignPolicy(material?.designPolicy)
    if (policy.render !== 'adapter')
      return []
    const rect = element.getBoundingClientRect()
    return [{
      id,
      message: policy.diagnostic
        || locale.t('node.controlledAdapter', 'Controlled design adapter active'),
      style: {
        left: `${rect.right - sheetRect.left - 20}px`,
        top: `${rect.top - sheetRect.top + 4}px`,
      },
    }]
  })
})

const collapsedCandidateIndicator = computed<CSSProperties | undefined>(() => {
  elementVersion.value
  const sheet = sheetRef.value
  const id = candidateId.value
  const element = id ? nodeElements.get(id) : undefined
  if (!sheet || !element)
    return undefined
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height >= 36)
    return undefined
  const sheetRect = sheet.getBoundingClientRect()
  const height = 36
  return {
    height: `${height}px`,
    left: `${rect.left - sheetRect.left}px`,
    top: `${rect.top - sheetRect.top - (height - rect.height) / 2}px`,
    width: `${rect.width}px`,
  }
})

function acceptedSlot(parent: DesignerNode, node: DesignerNode): DesignerMaterialSlotDefinition | undefined {
  if (parent.kind !== 'container')
    return undefined
  const material = props.registry.getMaterial(parent.material)
  if (!material || material.kind !== 'container')
    return undefined
  return material.slots.find(slot => (
    (!slot.accepts || slot.accepts.includes(node.kind))
    && (!slot.materials || slot.materials.includes(node.material))
    && (slot.max === undefined || (parent.slots[slot.name]?.length ?? 0) < slot.max)
  ))
}

function hitNodeElements(point: DesignerPointerPosition, candidateId: string): HTMLElement[] {
  const sheet = sheetRef.value
  if (!sheet)
    return []
  const seen = new Set<HTMLElement>()
  const hits: HTMLElement[] = []
  for (const surface of document.elementsFromPoint(point.x, point.y)) {
    let element = surface.closest<HTMLElement>('[data-config-node-id]')
    while (element && sheet.contains(element)) {
      if (element.dataset.configNodeId !== candidateId && !seen.has(element)) {
        seen.add(element)
        hits.push(element)
      }
      element = element.parentElement?.closest<HTMLElement>('[data-config-node-id]') ?? null
    }
  }
  return hits
}

function siblingTarget(nodeId: string, after: boolean): DesignerDropTarget | undefined {
  const location = findDesignerNode(props.document, nodeId)
  if (!location)
    return undefined
  const index = location.index + (after ? 1 : 0)
  return location.parent && location.slot
    ? { parentId: location.parent.id, slot: location.slot, index }
    : { parentId: null, index }
}

function isValidTarget(target: DesignerDropTarget, source = activeSession.value?.source): boolean {
  const command = candidateCommandForSource(source, target)
  if (!command)
    return false
  return reduceDesignerCommand(props.document, command, props.registry).changed
}

function keyboardDropTargets(source: DesignerDragSource): DesignerDropTarget[] {
  const node = nodeForDragSource(source)
  if (!node)
    return []
  const targets: DesignerDropTarget[] = []
  for (let index = 0; index <= props.document.nodes.length; index += 1)
    targets.push({ parentId: null, index })

  const visit = (nodes: DesignerNode[]): void => {
    for (const parent of nodes) {
      if (parent.kind !== 'container')
        continue
      const material = props.registry.getMaterial(parent.material)
      if (material?.kind === 'container') {
        for (const slot of material.slots) {
          const children = parent.slots[slot.name] ?? []
          const accepts = (!slot.accepts || slot.accepts.includes(node.kind))
            && (!slot.materials || slot.materials.includes(node.material))
          if (accepts) {
            for (let index = 0; index <= children.length; index += 1)
              targets.push({ parentId: parent.id, slot: slot.name, index })
          }
          visit(children)
        }
      }
    }
  }
  visit(props.document.nodes)
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
  const viewport = sheetRef.value?.parentElement
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
  const hitId = hit?.dataset.configNodeId
  const collapsedTarget = resolveDesignerCollapsedDropTarget(
    point,
    [...nodeElements.entries()].flatMap(([nodeId, element]) => {
      if (nodeId === source.candidateId)
        return []
      const location = findDesignerNode(props.document, nodeId)
      if (!location)
        return []
      const slot = acceptedSlot(location.node, node)
      if (!slot)
        return []
      const target = {
        parentId: location.node.id,
        slot: slot.name,
        index: location.node.kind === 'container' ? (location.node.slots[slot.name]?.length ?? 0) : 0,
      } satisfies DesignerDropTarget
      if (!isValidTarget(target))
        return []
      const rect = element.getBoundingClientRect()
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
        specificity: slot.materials?.includes(node.material) ? 1 : 0,
        target,
      }]
    }),
  )
  if (collapsedTarget)
    return collapsedTarget

  if (!hitId) {
    const target = { parentId: null, index: props.document.nodes.length } satisfies DesignerDropTarget
    return isValidTarget(target) ? target : previous
  }

  const insideTargets = hits.flatMap((element, depth) => {
    const location = findDesignerNode(props.document, element.dataset.configNodeId ?? '')
    if (!location)
      return []
    const rect = element.getBoundingClientRect()
    const verticalRatio = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5
    const slot = acceptedSlot(location.node, node)
    if (!slot || verticalRatio < 0.2 || verticalRatio > 0.8)
      return []
    const target = {
      parentId: location.node.id,
      slot: slot.name,
      index: location.node.kind === 'container' ? (location.node.slots[slot.name]?.length ?? 0) : 0,
    } satisfies DesignerDropTarget
    return isValidTarget(target)
      ? [{ depth, specific: slot.materials?.includes(node.material) ? 1 : 0, target }]
      : []
  }).sort((left, right) => right.specific - left.specific || left.depth - right.depth)
  if (insideTargets[0])
    return insideTargets[0].target

  const stickyTarget = resolveStickyDesignerDropTarget(
    previous,
    hits.flatMap(element => element.dataset.configNodeId ? [element.dataset.configNodeId] : []),
    isValidTarget,
  )
  if (stickyTarget)
    return stickyTarget

  const location = findDesignerNode(props.document, hitId)
  if (!location)
    return previous
  const rect = hit.getBoundingClientRect()
  const verticalRatio = rect.height > 0 ? (point.y - rect.top) / rect.height : 0.5
  const target = siblingTarget(hitId, verticalRatio > 0.5)
  return target && isValidTarget(target) ? target : previous
}

function nodeIdFromEvent(event: Event): string | undefined {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-config-node-id]')
    : undefined
  const nodeId = target?.dataset.configNodeId
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

function handleCanvasPointerDown(event: PointerEvent): void {
  const nodeId = dragHandleNodeIdFromEvent(event) ?? nodeIdFromEvent(event)
  if (nodeId) {
    pointerSelection = { nodeId, startedAt: performance.now() }
    emit('select', nodeId, selectionMode(event))
  }
  else if (event.target === sheetRef.value)
    emit('select', '')
  if (!props.interactive && nodeId)
    event.preventDefault()
}

function handleCanvasClick(event: MouseEvent): void {
  if (!nodeIdFromEvent(event) && event.target === sheetRef.value)
    emit('select', '')
}

function handleCanvasKeydown(event: KeyboardEvent): void {
  if (dragHandleNodeIdFromEvent(event))
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
  const nodeId = nodeIdFromEvent(event)
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
  if (activeDragPointer !== undefined && activeDragPointerTarget?.hasPointerCapture?.(activeDragPointer))
    activeDragPointerTarget.releasePointerCapture(activeDragPointer)
  activeDragPointer = undefined
  activeDragPointerTarget = undefined
  stopCanvasAutoScroll()
  window.removeEventListener('pointermove', handleNodeDragMove)
  window.removeEventListener('pointerup', handleNodeDragEnd)
  window.removeEventListener('pointercancel', handleNodeDragCancel)
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
  event.preventDefault()
  event.stopPropagation()
  activeDragPointer = event.pointerId
  activeDragPointerTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined
  activeDragPointerTarget?.setPointerCapture?.(event.pointerId)
  dragController.beginNode(nodeId, { x: event.clientX, y: event.clientY })
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
    && !props.document.form.inline
    && findDesignerNode(props.document, nodeId)?.parent === undefined
}

function beginResize(event: PointerEvent, nodeId: string): void {
  const location = findDesignerNode(props.document, nodeId)
  const row = sheetRef.value?.querySelector<HTMLElement>('[data-config-form-responsive-layout]')
  if (!location || !row || !canResize(nodeId))
    return
  event.preventDefault()
  event.stopPropagation()
  resizeCleanup?.()
  const layout = resolveConfigFormLayout(
    props.document.form.columns,
    props.document.form.fieldSpan,
    props.document.form.responsive,
    props.breakpoint ?? 'desktop',
  )
  const startSpan = location.node.span ?? layout.fieldSpan
  const startX = event.clientX
  const width = row.getBoundingClientRect().width || 1
  const pointerId = event.pointerId
  let nextSpan = startSpan
  const move = (moveEvent: PointerEvent): void => {
    if (moveEvent.pointerId !== pointerId)
      return
    const delta = Math.round((moveEvent.clientX - startX) / width * layout.columns)
    nextSpan = Math.min(layout.columns, Math.max(1, startSpan + delta))
  }
  const finish = (finishEvent: PointerEvent): void => {
    if (finishEvent.pointerId !== pointerId)
      return
    resizeCleanup?.()
    if (nextSpan !== startSpan)
      emit('resize', nodeId, nextSpan)
  }
  const cancel = (): void => resizeCleanup?.()
  resizeCleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    resizeCleanup = undefined
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
}

watch(() => props.breakpoint, () => {
  void nextTick(() => {
    elementVersion.value += 1
  })
})

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      elementVersion.value += 1
    })
    if (sheetRef.value)
      resizeObserver.observe(sheetRef.value)
  }
  unregisterDropResolver = dragController?.registerResolver(resolveDropTarget)
  unregisterKeyboardTargets = dragController?.registerKeyboardTargets(keyboardDropTargets)
})

onBeforeUnmount(() => {
  unregisterDropResolver?.()
  unregisterKeyboardTargets?.()
  resizeObserver?.disconnect()
  cleanupNodeDrag()
  resizeCleanup?.()
})
</script>

<template>
  <main
    class="mx-config-form-designer__canvas"
    :class="{ 'is-dragging': activeSession?.active }"
    :aria-label="locale.t('canvas.form', 'Form canvas')"
    :data-preview-breakpoint="breakpoint ?? 'desktop'"
  >
    <div class="mx-config-form-designer__canvas-tools mx-config-form-designer__segmented" role="group" :aria-label="locale.t('canvas.tools', 'Canvas tools')">
      <button
        type="button"
        :class="{ 'is-active': interactive }"
        :aria-label="locale.t('canvas.linkagePreview', 'Linkage preview')"
        :title="locale.t('canvas.linkagePreview', 'Linkage preview')"
        :aria-pressed="Boolean(interactive)"
        @click.stop="emit('toggleInteractive')"
      >
        <Workflow :size="15" aria-hidden="true" />
      </button>
    </div>

    <div
      ref="sheetRef"
      class="mx-config-form-designer__canvas-sheet mx-config-form-designer__runtime-surface"
      :data-sheet-breakpoint="breakpoint ?? 'desktop'"
      @pointerdown.capture="handleCanvasPointerDown"
      @click="handleCanvasClick"
      @keydown.capture="handleCanvasKeydown"
    >
      <RuntimeSurface
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
        :editor="editorBridge"
        mode="design"
      />

      <div v-if="renderer.fields.length === 0" class="mx-config-form-designer__canvas-empty" aria-hidden="true">
        {{ locale.t('canvas.dropHere', 'Drop a field here') }}
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
          :class="{ 'is-primary': box.primary }"
          :style="box.style"
        >
          <div v-if="box.primary" class="mx-config-form-designer__node-actions" role="toolbar" :aria-label="locale.t('node.actions', 'Node actions')" aria-hidden="false">
            <button type="button" class="mx-config-form-designer__icon-button mx-config-form-designer__drag-handle" :disabled="readonly" :title="locale.t('node.move', 'Move')" :aria-label="locale.t('node.moveNode', 'Move node')" :aria-pressed="isNodeKeyboardDragging(box.id)" :data-designer-drag-node-id="box.id" @keydown="handleNodeDragHandleKeydown($event, box.id)" @pointerdown="beginNodeDrag($event, box.id)"><GripVertical :size="16" aria-hidden="true" /></button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.moveUp', 'Move up')" :aria-label="locale.t('node.moveNodeUp', 'Move node up')" @click.stop="emit('action', 'moveBefore', box.id)"><ChevronUp :size="15" aria-hidden="true" /></button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.moveDown', 'Move down')" :aria-label="locale.t('node.moveNodeDown', 'Move node down')" @click.stop="emit('action', 'moveAfter', box.id)"><ChevronDown :size="15" aria-hidden="true" /></button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.indent', 'Indent')" :aria-label="locale.t('node.indentNode', 'Move node into previous container')" @click.stop="emit('action', 'indent', box.id)"><CornerDownRight :size="15" aria-hidden="true" /></button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.outdent', 'Outdent')" :aria-label="locale.t('node.outdentNode', 'Move node out of container')" @click.stop="emit('action', 'outdent', box.id)"><CornerDownLeft :size="15" aria-hidden="true" /></button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.copy', 'Copy')" :aria-label="locale.t('node.copyNode', 'Copy node')" @click.stop="emit('action', 'copy', box.id)"><Copy :size="15" aria-hidden="true" /></button>
            <button type="button" class="mx-config-form-designer__icon-button is-danger" :disabled="readonly" :title="locale.t('node.delete', 'Delete')" :aria-label="locale.t('node.deleteNode', 'Delete node')" @click.stop="emit('action', 'remove', box.id)"><Trash2 :size="15" aria-hidden="true" /></button>
          </div>
          <button
            v-if="box.primary && canResize(box.id)"
            type="button"
            class="mx-config-form-designer__resize-handle"
            :aria-label="locale.t('node.resize', 'Resize node')"
            :title="locale.t('node.resize', 'Resize node')"
            aria-hidden="false"
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
          role="img"
          tabindex="0"
        >
          <TriangleAlert :size="13" aria-hidden="true" />
        </span>
      </div>
    </div>
  </main>
</template>
