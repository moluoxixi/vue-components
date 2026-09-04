<script setup lang="ts">
import type { PageNode, ProjectCommand } from '@moluoxixi/config-form-model'
import type { DesignerDropTarget } from '../../graph'
import type {
  DesignerCanvasEmits,
  DesignerCanvasProps,
  DesignerCanvasSlots,
  DesignerDragSource,
  DesignerRuntimeSlotScope,
} from './types'
import { Workflow } from '@lucide/vue'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { createInsertCommand, createMoveCommand, findDesignNode } from '../../graph'
import { useDesignerLocale } from '../../locale'
import { DesignerCommandHint } from '../DesignerCommandHint'
import { createDesignerMaterialCandidate } from './services'
import { DESIGNER_SESSION_KEY } from './services'
import {
  DesignerCanvasCameraControls,
  DesignerCanvasDragVisual,
  DesignerCanvasOverlay,
  DesignerCanvasRuntime,
} from './components'
import {
  useDesignerCanvasCamera,
  useDesignerCanvasDropTargets,
  useDesignerCanvasMenu,
  useDesignerCanvasNodeDrag,
  useDesignerCanvasOverlay,
  useDesignerCanvasOverlayState,
  useDesignerCanvasResize,
  useDesignerCanvasRuntime,
} from './composables'
import { createDesignerCanvasSelection } from './services/canvas-selection'
import './style'

const slots = defineSlots<DesignerCanvasSlots>()
const props = defineProps<DesignerCanvasProps>()
const emit = defineEmits<DesignerCanvasEmits>()

const locale = useDesignerLocale()
const designSession = inject(DESIGNER_SESSION_KEY, undefined)
const dragController = designSession?.drag
const canvasRef = ref<HTMLElement>()
const cameraViewportRef = ref<HTMLElement>()
const sheetRef = ref<HTMLElement>()
const dragVisualRef = useTemplateRef<{ getElement: () => HTMLElement | undefined }>('dragVisual')
const dragOverlayRef = computed(() => dragVisualRef.value?.getElement())
const emptyCanvasDescriptionId = useId()
const elementVersion = ref(0)
let unregisterDropResolver: (() => void) | undefined
let unregisterKeyboardTargets: (() => void) | undefined

const activeSession = computed(() => dragController?.session.value)
const candidateActive = computed(() => Boolean(activeSession.value?.active))
const candidateInput = computed(() => activeSession.value?.active ? activeSession.value.input : undefined)
const dragSource = computed(() => activeSession.value?.source)
const candidateSource = computed(() => candidateActive.value ? dragSource.value : undefined)
const candidateTarget = computed(() => activeSession.value?.active ? activeSession.value.target : undefined)
const candidateId = computed(() => candidateSource.value?.candidateId)
const {
  beginCameraPan,
  camera,
  cameraHovered,
  cameraPanning,
  cameraPercent,
  cameraSheetStyle,
  cameraSizerStyle,
  fitCamera,
  intrinsicFrameWidth,
  maxScale: CANVAS_MAX_SCALE,
  minScale: CANVAS_MIN_SCALE,
  observeRuntimeElement,
  resetCamera,
  spacePressed,
  unobserveRuntimeElement,
  updateCameraPan,
  zoomCamera,
} = useDesignerCanvasCamera({
  breakpoint: () => props.breakpoint,
  cameraViewportRef,
  canvasRef,
  onGeometryChange: () => {
    elementVersion.value += 1
  },
  onScaleChange: () => {
    elementVersion.value += 1
    if (activeSession.value?.active && activeSession.value.input === 'pointer')
      scheduleDragOverlay()
  },
  sheetRef,
})

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

const {
  editorBridge,
  externalGeometry,
  nodeElements,
  pointerHandlers: runtimePointerHandlers,
  runtimeHostBridge,
  runtimeLayoutRect,
  runtimeNodeGeometry,
  runtimeNodeGeometryById,
  selectedSet,
  surfaceModel,
} = useDesignerCanvasRuntime({
  cameraScale: () => camera.scale,
  candidateId: () => candidateId.value,
  candidateUsesFallback: () => candidateUsesFallback.value,
  elementVersion,
  focusNode: focusEditorNode,
  graph: () => props.graph,
  hasRuntimeSlot: () => Boolean(slots.runtime),
  interactive: () => Boolean(props.interactive),
  model: () => props.model,
  observeElement: observeRuntimeElement,
  onGeometryChange: () => {
    elementVersion.value += 1
  },
  onSelect: (nodeId, mode) => {
    if (mode)
      emit('select', nodeId, mode)
    else
      emit('select', nodeId)
  },
  onUpdateField: (field, value) => emit('updateField', field, value),
  projectedGraph: () => projectedGraph.value,
  publishGeometry: snapshot => designSession?.publishGeometry(snapshot),
  registry: () => props.registry,
  selectedId: () => props.selectedId,
  selectedIds: () => props.selectedIds,
  sheetRef,
  unobserveElement: unobserveRuntimeElement,
})

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

const {
  hitNodeElements,
  keyboardDropTargets,
  resolveDropTarget,
  stopCanvasAutoScroll,
} = useDesignerCanvasDropTargets({
  activeSource: () => activeSession.value?.source,
  cameraViewportRef,
  candidateCommandForSource,
  candidateNode: () => candidateNode.value,
  candidatePreview: command => props.candidatePreview(command),
  dragController,
  graph: () => props.graph,
  nodeForDragSource,
  onGeometryChange: () => {
    elementVersion.value += 1
  },
  registry: () => props.registry,
  runtimeNodeGeometry,
  sheetRef,
})
const {
  closeNodeActionMenu,
  handleNodeActionMenuKeydown,
  handleNodeToolbarKeydown,
  nodeActionMenuId,
  nodeActionMenuNodeId,
  runNodeAction,
  toggleNodeActionMenu,
} = useDesignerCanvasMenu({
  onAction: (action, nodeId) => emit('action', action, nodeId),
  readonly: () => Boolean(props.readonly),
  selectedId: () => props.selectedId,
  sheetRef,
})
const {
  beginNodeDrag,
  beginNodeKeyboard,
  handleActiveDragKeydown,
  handleNodeDragHandleKeydown,
  isNodeKeyboardDragging,
} = useDesignerCanvasNodeDrag({
  activeSession: () => activeSession.value,
  clearDragOverlay: () => clearDragOverlay(),
  closeNodeActionMenu,
  dragController,
  readonly: () => Boolean(props.readonly),
  runtimeNodeGeometryById,
  stopCanvasAutoScroll,
})
const {
  handleCanvasClick,
  handleCanvasKeydown,
  handleCanvasPointerDown,
  handleCanvasSelectStart,
} = createDesignerCanvasSelection({
  beginNodeKeyboard,
  candidateId: () => candidateId.value,
  focusNode: focusEditorNode,
  handleActiveDragKeydown,
  hitNodeElements,
  interactive: () => Boolean(props.interactive),
  onAction: (action, nodeId) => emit('action', action, nodeId),
  onSelect: (nodeId, mode) => emit('select', nodeId, mode),
  selectedId: () => props.selectedId,
})
const {
  beginResize,
  canResize,
  resizingNodeId,
} = useDesignerCanvasResize({
  breakpoint: () => props.breakpoint,
  graph: () => props.graph,
  onResize: (nodeId, span) => emit('resize', nodeId, span),
  readonly: () => Boolean(props.readonly),
  runtimeLayoutRect,
  runtimePointerHandlers,
})
const {
  overlayMode,
  selectionOverlayVisible,
} = useDesignerCanvasOverlayState({
  activeSession: () => activeSession.value,
  publishOverlayMode: mode => designSession?.publishOverlayMode(mode),
  resizingNodeId,
  selectedSet,
})

const {
  clearDragOverlay,
  collapsedCandidateIndicator,
  designPolicySpots,
  dragOverlayHtml,
  dragVisualSlotScope,
  effectiveDragOverlayStyle,
  nodeLabel,
  overlayBoxes,
  scheduleDragOverlay,
} = useDesignerCanvasOverlay({
  activeSession: () => activeSession.value,
  cameraScale: () => camera.scale,
  candidateId: () => candidateId.value,
  candidateNode: () => candidateNode.value,
  controlledAdapterMessage: () => locale.t('node.controlledAdapter', 'Controlled design adapter active'),
  dragOverlayRef,
  elementVersion,
  externalGeometry,
  hasRuntimeSlot: () => Boolean(slots.runtime),
  materialTitle: material => locale.materialTitle(material),
  nodeElements,
  projectedGraph: () => projectedGraph.value,
  registry: () => props.registry,
  runtimeNodeGeometryById,
  runtimeSlotScope,
  selectedId: () => props.selectedId,
  selectedSet,
  selectionOverlayVisible: () => selectionOverlayVisible.value,
  sheetRef,
})
async function focusEditorNode(nodeId: string): Promise<void> {
  await nextTick()
  const target = [...(sheetRef.value?.querySelectorAll<HTMLElement>('[data-editor-focus-node-id]') ?? [])]
    .find(element => element.dataset.editorFocusNodeId === nodeId)
  target?.focus({ preventScroll: true })
}

function handleOverlayAction(...args: DesignerCanvasEmits['action']): void {
  emit('action', ...args)
}

watch([activeSession, elementVersion], ([session]) => {
  if (session?.active) {
    closeNodeActionMenu()
  }
  if (session?.active && session.input === 'pointer')
    scheduleDragOverlay()
  else
    clearDragOverlay()
}, { flush: 'post' })

onMounted(() => {
  unregisterDropResolver = dragController?.registerResolver(resolveDropTarget)
})

// Keyboard destinations only depend on the graph and registry, so register them
// before the first paint. This keeps a fast Space press from racing Canvas mount.
unregisterKeyboardTargets = dragController?.registerKeyboardTargets(keyboardDropTargets)

onBeforeUnmount(() => {
  unregisterDropResolver?.()
  unregisterKeyboardTargets?.()
  clearDragOverlay()
  designSession?.publishCandidate(undefined)
  designSession?.publishGeometry(undefined)
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
      <DesignerCommandHint :renderer="commandHint" :label="locale.t('canvas.linkagePreview', 'Linkage preview')">
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
      </DesignerCommandHint>
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
            <DesignerCanvasRuntime
              v-model="surfaceModel"
              :renderer="renderer"
              :namespace="registry.rendererNamespace"
              :breakpoint="breakpoint"
              :editor="editorBridge"
              :interactive="Boolean(interactive)"
            />
          </slot>

          <div v-if="showEmptyCanvas" :id="emptyCanvasDescriptionId" class="mx-config-form-designer__canvas-empty">
            {{ locale.t('canvas.emptyGuide', 'Drag or click a component on the left to add a field') }}
          </div>

          <DesignerCanvasOverlay
            :boxes="overlayBoxes"
            :can-resize="canResize"
            :collapsed-candidate-indicator="collapsedCandidateIndicator"
            :command-hint="commandHint"
            :design-policy-spots="designPolicySpots"
            :is-node-keyboard-dragging="isNodeKeyboardDragging"
            :menu-id="nodeActionMenuId"
            :menu-node-id="nodeActionMenuNodeId"
            :node-label="nodeLabel"
            :overlay-mode="overlayMode"
            :readonly="Boolean(readonly)"
            :resizing-node-id="resizingNodeId"
            @action="handleOverlayAction"
            @begin-drag="beginNodeDrag"
            @begin-resize="beginResize"
            @drag-keydown="handleNodeDragHandleKeydown"
            @menu-action="runNodeAction"
            @menu-keydown="handleNodeActionMenuKeydown"
            @toggle-menu="toggleNodeActionMenu"
            @toolbar-keydown="handleNodeToolbarKeydown"
          />
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
    <DesignerCanvasCameraControls
      :command-hint="commandHint"
      :mode="camera.mode"
      :scale="camera.scale"
      :percent="cameraPercent"
      :min-scale="CANVAS_MIN_SCALE"
      :max-scale="CANVAS_MAX_SCALE"
      @fit="fitCamera"
      @reset="resetCamera"
      @zoom-in="zoomCamera('in')"
      @zoom-out="zoomCamera('out')"
    />
    <DesignerCanvasDragVisual
      ref="dragVisual"
      :html="dragOverlayHtml"
      :overlay-style="effectiveDragOverlayStyle"
      :use-slot="Boolean(slots.runtime && dragVisualSlotScope)"
    >
      <slot v-if="slots.runtime && dragVisualSlotScope" name="dragVisual" v-bind="dragVisualSlotScope" />
    </DesignerCanvasDragVisual>
  </main>
</template>
