<script setup lang="ts">
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerCompileResult } from '../compiler'
import type { DesignerCommand, DesignerDropTarget } from '../history'
import type { LowCodeNode, ModelOperation } from '../model'
import type { DesignerDragAnnouncement, DesignerDragSource } from './designer-drag'
import type {
  ConfigFormDesignerEmits,
  ConfigFormDesignerExpose,
  ConfigFormDesignerProps,
  ConfigFormDesignerSlots,
  DesignerNodeAction,
} from './types'
import {
  Clipboard,
  Copy,
  Download,
  Eye,
  FileDown,
  FileUp,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  X,
} from '@lucide/vue'
import { ConfigFormRenderer } from '@moluoxixi/config-form/renderer'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, useId, watch } from 'vue'
import { useDesignerController } from '../composables'
import { applyDesignerDocumentReactions, createDesignerPreviewModel } from '../document'
import { findDesignerNode } from '../history'
import { createDesignerLocale, DESIGNER_LOCALE_KEY } from '../locale'
import { findConfigModelNode } from '../model'
import DesignerCanvas from './DesignerCanvas.vue'
import DesignerPalette from './DesignerPalette.vue'
import DesignerPropertyPanel from './DesignerPropertyPanel.vue'
import { createDesignerDragController, createDesignerMaterialCandidate, DESIGNER_DRAG_KEY } from './designer-drag'
import '../styles.scss'

const props = withDefaults(defineProps<ConfigFormDesignerProps>(), {
  historyLimit: 100,
  readonly: false,
})
const emit = defineEmits<ConfigFormDesignerEmits>()
defineSlots<ConfigFormDesignerSlots>()
const locale = reactive(createDesignerLocale(props.locale))
provide(DESIGNER_LOCALE_KEY, locale)

watch(() => props.locale, (value) => {
  Object.assign(locale, createDesignerLocale(value))
}, { deep: true })

const rootRef = ref<HTMLElement>()
const transferDialogRef = ref<HTMLElement>()
const previewDialogRef = ref<HTMLElement>()
const previewResult = shallowRef<DesignerCompileResult>()
const previewOpen = ref(false)
const initialReactionProjection = applyDesignerDocumentReactions(
  props.document,
  createDesignerPreviewModel(props.document),
)
const previewModel = ref<Record<string, unknown>>(initialReactionProjection.values)
const previewReactionProps = ref<ConfigFormReactionProjection['props']>(initialReactionProjection.props)
const previewReactionStates = ref<ConfigFormReactionProjection['states']>(initialReactionProjection.states)
const linkagePreview = ref(false)
const transferMode = ref<'import' | 'export'>()
const transferText = ref('')
const transferError = ref('')
const activeBreakpoint = ref<ConfigFormBreakpoint>(recommendedBreakpoint())
const workspaceWidth = ref<number>()
const activeWorkspaceView = ref<'canvas' | 'palette' | 'properties'>('canvas')
const paletteOpen = ref(true)
const propertiesOpen = ref(true)
type DesignerSidePanel = 'palette' | 'properties'
const mediumPanel = ref<DesignerSidePanel>()
const workspaceId = useId()
const workspaceViews = [
  { id: 'palette' as const, label: 'Palette' },
  { id: 'canvas' as const, label: 'Canvas' },
  { id: 'properties' as const, label: 'Properties' },
]
const breakpoints: Array<{ key: ConfigFormBreakpoint, icon: typeof Monitor }> = [
  { key: 'desktop', icon: Monitor },
  { key: 'tablet', icon: Tablet },
  { key: 'mobile', icon: Smartphone },
]
const workspaceMode = computed(() => {
  const width = workspaceWidth.value
  if (!width)
    return 'desktop' as const
  if (width <= 720)
    return 'narrow' as const
  if (width <= 1100)
    return 'medium' as const
  return 'desktop' as const
})
let breakpointManuallySelected = false
let resizeObserver: ResizeObserver | undefined
let transferReturnFocus: HTMLElement | undefined
let previewReturnFocus: HTMLElement | undefined
let focusedWorkspaceControl: {
  kind: 'drawer' | 'panel' | 'tab' | 'trigger'
  view: typeof activeWorkspaceView.value
} | undefined

const dialogFocusableSelector = [
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function recommendedBreakpoint(): ConfigFormBreakpoint {
  if (typeof window === 'undefined')
    return 'desktop'
  if (window.innerWidth <= 720)
    return 'mobile'
  if (window.innerWidth <= 1024)
    return 'tablet'
  return 'desktop'
}

function syncBreakpointToViewport(): void {
  if (!breakpointManuallySelected)
    activeBreakpoint.value = recommendedBreakpoint()
}

function selectBreakpoint(breakpoint: ConfigFormBreakpoint): void {
  breakpointManuallySelected = true
  activeBreakpoint.value = breakpoint
}

function breakpointTitle(breakpoint: ConfigFormBreakpoint): string {
  if (breakpoint === 'tablet')
    return locale.t('breakpoint.tablet', 'Tablet')
  if (breakpoint === 'mobile')
    return locale.t('breakpoint.mobile', 'Mobile')
  return locale.t('breakpoint.desktop', 'Desktop')
}

function measureWorkspace(): void {
  const width = rootRef.value?.getBoundingClientRect().width
  if (width && width > 0)
    workspaceWidth.value = width
}

function selectWorkspaceView(view: typeof activeWorkspaceView.value): void {
  activeWorkspaceView.value = view
}

function isSidePanelOpen(view: DesignerSidePanel): boolean {
  if (workspaceMode.value === 'medium')
    return mediumPanel.value === view
  return view === 'palette' ? paletteOpen.value : propertiesOpen.value
}

function isWorkspacePanelHidden(view: typeof activeWorkspaceView.value): boolean {
  if (workspaceMode.value === 'narrow')
    return activeWorkspaceView.value !== view
  if (workspaceMode.value === 'medium')
    return view === 'canvas' ? false : mediumPanel.value !== view
  if (view === 'palette')
    return !paletteOpen.value
  if (view === 'properties')
    return !propertiesOpen.value
  return false
}

function toggleWorkspacePanel(view: 'palette' | 'properties'): void {
  if (workspaceMode.value === 'medium') {
    mediumPanel.value = mediumPanel.value === view ? undefined : view
    return
  }
  if (view === 'palette')
    paletteOpen.value = !paletteOpen.value
  else
    propertiesOpen.value = !propertiesOpen.value
}

function closeMediumPanel(view: DesignerSidePanel): void {
  if (workspaceMode.value !== 'medium' || mediumPanel.value !== view)
    return
  const activeElement = document.activeElement
  const panel = rootRef.value?.querySelector<HTMLElement>(`[data-workspace-panel="${view}"]`)
  const shouldRestoreFocus = activeElement === document.body
    || (activeElement instanceof HTMLElement && panel?.contains(activeElement))
  mediumPanel.value = undefined
  if (shouldRestoreFocus) {
    void nextTick(() => rootRef.value
      ?.querySelector<HTMLButtonElement>(`[data-sidebar-trigger="${view}"]`)
      ?.focus())
  }
}

function handleWorkspaceTabKeydown(event: KeyboardEvent, view: typeof activeWorkspaceView.value): void {
  const index = workspaceViews.findIndex(item => item.id === view)
  let nextIndex = index
  if (event.key === 'ArrowRight')
    nextIndex = (index + 1) % workspaceViews.length
  else if (event.key === 'ArrowLeft')
    nextIndex = (index - 1 + workspaceViews.length) % workspaceViews.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = workspaceViews.length - 1
  else
    return
  event.preventDefault()
  const nextView = workspaceViews[nextIndex]!.id
  selectWorkspaceView(nextView)
  void nextTick(() => rootRef.value
    ?.querySelector<HTMLButtonElement>(`[data-workspace-tab="${nextView}"]`)
    ?.focus())
}

function workspaceViewForElement(element: HTMLElement | null): typeof activeWorkspaceView.value | undefined {
  const view = element?.dataset.workspaceTab
    ?? element?.dataset.sidebarTrigger
    ?? element?.closest<HTMLElement>('[data-workspace-panel]')?.dataset.workspacePanel
  return workspaceViews.some(item => item.id === view)
    ? view as typeof activeWorkspaceView.value
    : undefined
}

function handleRootFocusin(event: FocusEvent): void {
  const element = event.target instanceof HTMLElement ? event.target : null
  const view = workspaceViewForElement(element)
  if (!view) {
    focusedWorkspaceControl = undefined
    return
  }
  focusedWorkspaceControl = {
    kind: element?.dataset.drawerControl
      ? 'drawer'
      : element?.dataset.workspaceTab
      ? 'tab'
      : element?.dataset.sidebarTrigger
        ? 'trigger'
        : 'panel',
    view,
  }
}

watch(workspaceMode, (mode, previousMode) => {
  if (mode === previousMode)
    return
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const focusedView = workspaceViewForElement(activeElement) ?? focusedWorkspaceControl?.view

  if (mode === 'narrow') {
    activeWorkspaceView.value = focusedView
      ?? (previousMode === 'medium' ? mediumPanel.value : undefined)
      ?? activeWorkspaceView.value
    if (
      activeElement?.dataset.drawerControl
      || activeElement?.dataset.sidebarTrigger
      || focusedWorkspaceControl?.kind === 'drawer'
      || focusedWorkspaceControl?.kind === 'trigger'
    ) {
      void nextTick(() => window.setTimeout(() => rootRef.value
        ?.querySelector<HTMLButtonElement>(`[data-workspace-tab="${activeWorkspaceView.value}"]`)
        ?.focus(), 0))
    }
    return
  }

  if (previousMode === 'medium' && focusedWorkspaceControl?.kind === 'drawer') {
    void nextTick(() => window.setTimeout(() => rootRef.value
      ?.querySelector<HTMLButtonElement>(`[data-sidebar-trigger="${focusedView}"]`)
      ?.focus(), 0))
    return
  }

  if (previousMode !== 'narrow')
    return
  const view = activeWorkspaceView.value
  if (mode === 'medium')
    mediumPanel.value = view === 'canvas' ? undefined : view
  else if (view === 'palette')
    paletteOpen.value = true
  else if (view === 'properties')
    propertiesOpen.value = true

  if (activeElement?.dataset.workspaceTab || focusedWorkspaceControl?.kind === 'tab') {
    void nextTick(() => window.setTimeout(() => {
      const target = view === 'canvas'
        ? rootRef.value?.querySelector<HTMLElement>('[data-workspace-panel="canvas"]')
        : rootRef.value?.querySelector<HTMLButtonElement>(`[data-sidebar-trigger="${view}"]`)
      target?.focus()
    }, 0))
  }
}, { flush: 'sync' })

onMounted(() => {
  syncBreakpointToViewport()
  window.addEventListener('resize', syncBreakpointToViewport)
  measureWorkspace()
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver(measureWorkspace)
    resizeObserver.observe(rootRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncBreakpointToViewport)
  resizeObserver?.disconnect()
})

const controller = useDesignerController({
  document: () => props.document,
  registry: () => props.registry,
  historyLimit: () => props.historyLimit,
  readonly: () => props.readonly,
  controlled: () => Boolean(props.commandControl),
  onBeforeCommandCommit: (command, document) => props.commandControl?.apply(command, document) ?? true,
  onDocumentChange: (document) => {
    if (!linkagePreview.value)
      resetPreviewModel(document)
    emit('update:document', document)
  },
  onCommand: (command, document) => emit('command', command, document),
  onDiagnostics: diagnostics => emit('diagnostics', diagnostics),
  onSelectionChange: (nodeId, nodeIds) => {
    emit('selectionChange', nodeId)
    emit('selectionSetChange', nodeIds, nodeId)
  },
})

const dragController = createDesignerDragController({
  commitMaterial: (source, target) => {
    const node = createDesignerMaterialCandidate(props.registry, source.materialKey, source.candidateId)
    if (!node || !controller.dispatch({ type: 'addNode', node, target }))
      return
    controller.select(node.id)
    if (workspaceMode.value === 'narrow')
      activeWorkspaceView.value = 'canvas'
    else if (workspaceMode.value === 'medium')
      mediumPanel.value = 'properties'
  },
  commitNode: (nodeId, target) => handleMove(nodeId, target),
})
provide(DESIGNER_DRAG_KEY, dragController)
onBeforeUnmount(dragController.cancel)

function dragSourceLabel(source: DesignerDragSource): string {
  if (source.type === 'material') {
    const material = props.registry.getMaterial(source.materialKey)
    return material ? locale.materialTitle(material) : source.materialKey
  }
  const node = findDesignerNode(controller.document.value, source.nodeId)?.node
  if (!node)
    return source.nodeId
  if (node.kind === 'field')
    return node.label || node.field
  const material = props.registry.getMaterial(node.material)
  return material ? locale.materialTitle(material) : node.material
}

function dragTargetLabel(target: DesignerDropTarget | undefined): string {
  if (!target)
    return locale.t('drag.targetUnavailable', 'an unavailable position')
  const position = (target.index ?? 0) + 1
  if (target.parentId === null)
    return locale.t('drag.targetPage', 'at page position {position}', { position })
  const parent = findDesignerNode(controller.document.value, target.parentId)?.node
  const parentMaterial = parent ? props.registry.getMaterial(parent.material) : undefined
  const parentLabel = parentMaterial ? locale.materialTitle(parentMaterial) : target.parentId
  const slot = target.slot && parentMaterial
    ? locale.materialSlotTitle(parentMaterial, target.slot, target.slot)
    : target.slot ?? locale.t('drag.defaultSlot', 'default slot')
  return locale.t('drag.targetSlot', 'in {parent}, {slot}, position {position}', { parent: parentLabel, slot, position })
}

function formatDragAnnouncement(announcement: DesignerDragAnnouncement): string {
  const item = dragSourceLabel(announcement.source)
  const target = dragTargetLabel(announcement.target)
  switch (announcement.type) {
    case 'picked-up':
      return locale.t('drag.pickedUp', 'Picked up {item}, currently {target}. Use arrow keys to choose a destination, Space to drop, or Escape to cancel.', { item, target })
    case 'target':
      return locale.t('drag.targetChanged', '{item} will be placed {target}.', { item, target })
    case 'dropped':
      return locale.t('drag.dropped', 'Dropped {item} {target}.', { item, target })
    case 'cancelled':
      return locale.t('drag.cancelled', 'Cancelled dragging {item}.', { item })
  }
}

const dragAnnouncement = computed(() => {
  const announcement = dragController.announcement.value
  return announcement ? formatDragAnnouncement(announcement) : ''
})

const selectedModelNodes = computed<LowCodeNode[]>(() => props.model
  ? controller.selectedIds.value
      .map(nodeId => findConfigModelNode(props.model!, nodeId)?.node)
      .filter((node): node is LowCodeNode => Boolean(node))
  : [])
const selectedComponentDefinition = computed(() => {
  const component = selectedModelNodes.value[0]?.component
  return component ? props.modelRegistry?.get(component) : undefined
})

function handleModelOperation(operation: ModelOperation): void {
  if (!props.readonly)
    emit('modelOperation', operation)
}

watch(controller.document, (document) => {
  if (!linkagePreview.value)
    resetPreviewModel(document)
  else
    applyPreviewProjection(document, previewModel.value)
}, { deep: true })

const toolbarScope = computed(() => ({
  breakpoint: activeBreakpoint.value,
  canUndo: props.historyControl?.canUndo ?? controller.canUndo.value,
  canRedo: props.historyControl?.canRedo ?? controller.canRedo.value,
  canEditSelection: !props.readonly && controller.selectedIds.value.length > 0,
  readonly: props.readonly,
  copySelection: () => handleSelectionAction('copy'),
  removeSelection: () => handleSelectionAction('remove'),
  selectBreakpoint,
  undo: handleUndo,
  redo: handleRedo,
  preview: handlePreview,
  openImport,
  openExport,
}))

async function focusNode(nodeId?: string): Promise<void> {
  if (!nodeId)
    return
  await nextTick()
  const target = [...(rootRef.value?.querySelectorAll<HTMLElement>('[data-focus-node-id]') ?? [])]
    .find(element => element.dataset.focusNodeId === nodeId)
  target?.focus()
}

function dispatch(command: DesignerCommand): boolean {
  const changed = controller.dispatch(command)
  void focusNode(controller.selectedId.value)
  return changed
}

function handleUndo(): boolean {
  const changed = props.historyControl?.undo() ?? controller.undo()
  void focusNode(controller.selectedId.value)
  return changed
}

function handleRedo(): boolean {
  const changed = props.historyControl?.redo() ?? controller.redo()
  void focusNode(controller.selectedId.value)
  return changed
}

function handleMove(nodeId: string, target: DesignerDropTarget): void {
  controller.select(nodeId)
  dispatch({ type: 'moveNode', nodeId, target })
}

function handleAddMaterial(materialKey: string, target: DesignerDropTarget): void {
  if (!controller.addMaterial(materialKey, target))
    return
  if (workspaceMode.value === 'narrow')
    activeWorkspaceView.value = 'canvas'
  else if (workspaceMode.value === 'medium')
    mediumPanel.value = 'properties'
}

function addMaterial(materialKey: string, target?: DesignerDropTarget): boolean {
  const changed = controller.addMaterial(materialKey, target)
  if (changed && workspaceMode.value === 'narrow')
    activeWorkspaceView.value = 'canvas'
  else if (changed && workspaceMode.value === 'medium')
    mediumPanel.value = 'properties'
  return changed
}

function handleSelect(nodeId?: string): void {
  controller.select(nodeId)
  if (nodeId && workspaceMode.value === 'medium')
    mediumPanel.value = 'properties'
}

function handleCanvasSelect(nodeId?: string, mode: 'range' | 'replace' | 'toggle' = 'replace'): void {
  controller.select(nodeId, mode)
  if (nodeId && workspaceMode.value === 'medium')
    mediumPanel.value = 'properties'
}

function handleResize(nodeId: string, span: number): void {
  controller.select(nodeId)
  dispatch({ type: 'updateNode', nodeId, changes: { span } })
}

function handleUpdatePath(nodeId: string, path: string[], value: unknown): void {
  const changed = dispatch({ type: 'updateNodePath', nodeId, path, value })
  if (!changed || !['conditions', 'reactions'].includes(path[0] ?? ''))
    return
  if (!linkagePreview.value) {
    linkagePreview.value = true
    resetPreviewModel(controller.document.value)
    return
  }
  applyPreviewProjection(controller.document.value, previewModel.value)
}

function handleUpdateForm(changes: Record<string, unknown>): void {
  dispatch({ type: 'updateForm', changes })
}

function handleAction(action: DesignerNodeAction, nodeId: string): void {
  if (!controller.selectedIds.value.includes(nodeId))
    controller.select(nodeId)
  controller.performNodeAction(action, nodeId)
  void focusNode(controller.selectedId.value)
}

function handleSelectionAction(action: 'copy' | 'remove'): boolean {
  const nodeId = controller.selectedId.value
  if (!nodeId)
    return false
  const changed = controller.performNodeAction(action, nodeId)
  void focusNode(controller.selectedId.value)
  return changed
}

function handlePreview(): DesignerCompileResult {
  const result = controller.preview()
  previewResult.value = result
  emit('preview', result)
  if (result.success) {
    if (!linkagePreview.value)
      resetPreviewModel(result.document)
    previewOpen.value = true
    previewReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    void focusDialog(previewDialogRef)
  }
  return result
}

function toggleLinkagePreview(): void {
  linkagePreview.value = !linkagePreview.value
  resetPreviewModel(controller.document.value)
}

function updatePreviewField(field: string, value: unknown): void {
  applyPreviewProjection(controller.document.value, { ...previewModel.value, [field]: value })
}

function resetPreviewModel(document = controller.document.value): void {
  applyPreviewProjection(document, createDesignerPreviewModel(document))
}

function applyPreviewProjection(document: typeof props.document, values: Record<string, unknown>): void {
  const projection = applyDesignerDocumentReactions(document, values)
  previewModel.value = projection.values
  previewReactionProps.value = projection.props
  previewReactionStates.value = projection.states
}

function openImport(): void {
  transferReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined
  transferMode.value = 'import'
  transferText.value = ''
  transferError.value = ''
  void focusDialog(transferDialogRef, '[autofocus]')
}

function handleUpdatePaths(nodeIds: string[], path: string[], value: unknown): void {
  dispatch({
    type: 'batch',
    commands: nodeIds.map(nodeId => ({ type: 'updateNodePath', nodeId, path, value })),
  })
}

function openExport(): void {
  transferReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : undefined
  transferMode.value = 'export'
  transferText.value = controller.exportDocument()
  transferError.value = transferText.value
    ? ''
    : controller.diagnostics.value[0]?.message ?? locale.t('error.exportFailed', 'Export validation failed')
  if (transferText.value)
    emit('export', transferText.value)
  void focusDialog(transferDialogRef, '[autofocus]')
}

function closeTransfer(): void {
  transferMode.value = undefined
  transferError.value = ''
  void restoreDialogFocus('transfer')
}

function closePreview(): void {
  previewOpen.value = false
  void restoreDialogFocus('preview')
}

async function focusDialog(
  dialogRef: typeof transferDialogRef,
  preferredSelector = dialogFocusableSelector,
): Promise<void> {
  await nextTick()
  await new Promise<void>(resolve => window.setTimeout(resolve, 0))
  dialogRef.value?.querySelector<HTMLElement>(preferredSelector)?.focus()
}

async function restoreDialogFocus(dialog: 'preview' | 'transfer'): Promise<void> {
  const target = dialog === 'preview' ? previewReturnFocus : transferReturnFocus
  if (dialog === 'preview')
    previewReturnFocus = undefined
  else
    transferReturnFocus = undefined
  await nextTick()
  if (target?.isConnected)
    target.focus()
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement | undefined): void {
  if (event.key !== 'Tab' || !dialog)
    return
  const focusable = [...dialog.querySelectorAll<HTMLElement>(dialogFocusableSelector)]
  if (focusable.length === 0) {
    event.preventDefault()
    dialog.focus()
    return
  }
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleTransferDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeTransfer()
    return
  }
  trapDialogFocus(event, transferDialogRef.value)
}

function handlePreviewDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    closePreview()
    return
  }
  trapDialogFocus(event, previewDialogRef.value)
}

function applyImport(): boolean {
  let input: unknown
  try {
    input = JSON.parse(transferText.value)
  }
  catch {
    transferError.value = locale.t('error.invalidJson', 'Invalid JSON')
    return false
  }
  if (!controller.importDocument(input)) {
    transferError.value = controller.diagnostics.value[0]?.message ?? locale.t('error.importFailed', 'Import failed')
    return false
  }
  emit('import', controller.document.value)
  closeTransfer()
  return true
}

async function copyExport(): Promise<void> {
  await navigator.clipboard?.writeText(transferText.value)
}

function downloadExport(): void {
  const url = URL.createObjectURL(new Blob([transferText.value], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'config-form.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function importDocument(input: unknown): boolean {
  const changed = controller.importDocument(input)
  if (changed)
    emit('import', controller.document.value)
  return changed
}

function handleRootKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && workspaceMode.value === 'medium' && mediumPanel.value) {
    event.preventDefault()
    closeMediumPanel(mediumPanel.value)
    return
  }
  if (!(event.ctrlKey || event.metaKey))
    return
  const target = event.target as HTMLElement
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    return
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? handleRedo() : handleUndo()
  }
  else if (event.key.toLowerCase() === 'y') {
    event.preventDefault()
    handleRedo()
  }
}

defineExpose<ConfigFormDesignerExpose>({
  dispatch,
  performNodeAction: controller.performNodeAction,
  undo: handleUndo,
  redo: handleRedo,
  select: controller.select,
  selectBreakpoint,
  preview: handlePreview,
  importDocument,
  exportDocument: controller.exportDocument,
})
</script>

<template>
  <div
    ref="rootRef"
    class="mx-config-form-designer"
    :data-active-view="activeWorkspaceView"
    :data-palette-open="isSidePanelOpen('palette')"
    :data-properties-open="isSidePanelOpen('properties')"
    :data-workspace-mode="workspaceMode"
    @focusin="handleRootFocusin"
    @keydown="handleRootKeydown"
  >
    <header class="mx-config-form-designer__toolbar">
      <strong>{{ locale.t('designer.title', 'Form Designer') }}</strong>
      <div class="mx-config-form-designer__toolbar-controls">
        <div v-if="workspaceMode !== 'narrow'" class="mx-config-form-designer__sidebar-actions" role="group" :aria-label="locale.t('designer.sidebars', 'Designer sidebars')">
          <button
            type="button"
            class="mx-config-form-designer__icon-button"
            data-sidebar-trigger="palette"
            :aria-controls="`${workspaceId}-palette-panel`"
            :aria-expanded="isSidePanelOpen('palette')"
            :aria-label="isSidePanelOpen('palette') ? locale.t('designer.hidePalette', 'Hide materials') : locale.t('designer.showPalette', 'Show materials')"
            :title="isSidePanelOpen('palette') ? locale.t('designer.hidePalette', 'Hide materials') : locale.t('designer.showPalette', 'Show materials')"
            @click="toggleWorkspacePanel('palette')"
          >
            <PanelLeftClose v-if="isSidePanelOpen('palette')" :size="17" aria-hidden="true" />
            <PanelLeftOpen v-else :size="17" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="mx-config-form-designer__icon-button"
            data-sidebar-trigger="properties"
            :aria-controls="`${workspaceId}-properties-panel`"
            :aria-expanded="isSidePanelOpen('properties')"
            :aria-label="isSidePanelOpen('properties') ? locale.t('designer.hideProperties', 'Hide properties') : locale.t('designer.showProperties', 'Show properties')"
            :title="isSidePanelOpen('properties') ? locale.t('designer.hideProperties', 'Hide properties') : locale.t('designer.showProperties', 'Show properties')"
            @click="toggleWorkspacePanel('properties')"
          >
            <PanelRightClose v-if="isSidePanelOpen('properties')" :size="17" aria-hidden="true" />
            <PanelRightOpen v-else :size="17" aria-hidden="true" />
          </button>
        </div>
        <slot name="toolbar" v-bind="toolbarScope">
          <div class="mx-config-form-designer__toolbar-actions" role="toolbar" :aria-label="locale.t('designer.commands', 'Designer commands')">
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="!controller.canUndo.value" :title="locale.t('action.undo', 'Undo')" :aria-label="locale.t('action.undo', 'Undo')" @click="handleUndo">
              <Undo2 :size="17" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="!controller.canRedo.value" :title="locale.t('action.redo', 'Redo')" :aria-label="locale.t('action.redo', 'Redo')" @click="handleRedo">
              <Redo2 :size="17" aria-hidden="true" />
            </button>
            <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly || controller.selectedIds.value.length === 0" :title="locale.t('node.copySelection', 'Copy selection')" :aria-label="locale.t('node.copySelection', 'Copy selection')" @click="handleSelectionAction('copy')">
              <Copy :size="16" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__icon-button is-danger" :disabled="readonly || controller.selectedIds.value.length === 0" :title="locale.t('node.deleteSelection', 'Delete selection')" :aria-label="locale.t('node.deleteSelection', 'Delete selection')" @click="handleSelectionAction('remove')">
              <Trash2 :size="16" aria-hidden="true" />
            </button>
            <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
            <div class="mx-config-form-designer__segmented" role="group" :aria-label="locale.t('canvas.breakpoint', 'Preview breakpoint')">
              <button
                v-for="item in breakpoints"
                :key="item.key"
                type="button"
                :class="{ 'is-active': activeBreakpoint === item.key }"
                :aria-label="breakpointTitle(item.key)"
                :title="breakpointTitle(item.key)"
                :aria-pressed="activeBreakpoint === item.key"
                @click="selectBreakpoint(item.key)"
              >
                <component :is="item.icon" :size="15" aria-hidden="true" />
              </button>
            </div>
            <span class="mx-config-form-designer__toolbar-separator" aria-hidden="true" />
            <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.preview', 'Preview')" :aria-label="locale.t('action.previewForm', 'Preview form')" @click="handlePreview">
              <Eye :size="17" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('action.import', 'Import')" :aria-label="locale.t('action.importDocument', 'Import document')" @click="openImport">
              <FileUp :size="17" aria-hidden="true" />
            </button>
            <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.export', 'Export')" :aria-label="locale.t('action.exportDocument', 'Export document')" @click="openExport">
              <FileDown :size="17" aria-hidden="true" />
            </button>
          </div>
        </slot>
      </div>
    </header>

    <div class="mx-config-form-designer__workspace">
      <nav
        v-if="workspaceMode === 'narrow'"
        class="mx-config-form-designer__workspace-tabs"
        role="tablist"
        :aria-label="locale.t('designer.workspaceViews', 'Designer views')"
      >
        <button
          v-for="view in workspaceViews"
          :id="`${workspaceId}-${view.id}-tab`"
          :key="view.id"
          type="button"
          role="tab"
          :aria-controls="`${workspaceId}-${view.id}-panel`"
          :aria-selected="activeWorkspaceView === view.id"
          :data-workspace-tab="view.id"
          :tabindex="activeWorkspaceView === view.id ? 0 : -1"
          @click="selectWorkspaceView(view.id)"
          @keydown="handleWorkspaceTabKeydown($event, view.id)"
        >
          {{ locale.t(`designer.view.${view.id}`, view.label) }}
        </button>
      </nav>

      <section
        :id="`${workspaceId}-palette-panel`"
        class="mx-config-form-designer__workspace-panel is-palette"
        data-workspace-panel="palette"
        :aria-labelledby="workspaceMode === 'narrow' ? `${workspaceId}-palette-tab` : undefined"
        :aria-label="workspaceMode === 'medium' ? locale.t('palette.materials', 'Materials') : undefined"
        :hidden="isWorkspacePanelHidden('palette')"
        :inert="isWorkspacePanelHidden('palette') ? true : undefined"
        :role="workspaceMode === 'narrow' ? 'tabpanel' : workspaceMode === 'medium' ? 'region' : undefined"
      >
        <div v-if="workspaceMode === 'medium'" class="mx-config-form-designer__drawer-header">
          <strong>{{ locale.t('palette.materials', 'Materials') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" data-drawer-control="palette" :aria-label="locale.t('action.close', 'Close')" :title="locale.t('action.close', 'Close')" @click="closeMediumPanel('palette')">
            <X :size="17" aria-hidden="true" />
          </button>
        </div>
        <slot
          name="palette"
          :materials="registry.listMaterials()"
          :add-material="addMaterial"
          :readonly="readonly"
          :form="controller.document.value.form"
        >
          <DesignerPalette
            :materials="registry.listMaterials()"
            :registry="registry"
            :form="controller.document.value.form"
            :readonly="readonly"
            @add-material="addMaterial"
          />
        </slot>
      </section>

      <section
        :id="`${workspaceId}-canvas-panel`"
        class="mx-config-form-designer__workspace-panel is-canvas"
        data-workspace-panel="canvas"
        tabindex="-1"
        :aria-labelledby="workspaceMode === 'narrow' ? `${workspaceId}-canvas-tab` : undefined"
        :hidden="isWorkspacePanelHidden('canvas')"
        :inert="isWorkspacePanelHidden('canvas') ? true : undefined"
        :role="workspaceMode === 'narrow' ? 'tabpanel' : undefined"
      >
        <slot
          name="canvas"
          :document="controller.document.value"
          :selected-id="controller.selectedId.value"
          :selected-ids="controller.selectedIds.value"
          :select="controller.select"
          :move="handleMove"
          :breakpoint="activeBreakpoint"
          :interactive="linkagePreview"
          :model="previewModel"
          :reaction-props="previewReactionProps"
          :reaction-states="previewReactionStates"
        >
          <DesignerCanvas
            :document="controller.document.value"
            :registry="registry"
            :selected-id="controller.selectedId.value"
            :selected-ids="controller.selectedIds.value"
            :readonly="readonly"
            :breakpoint="activeBreakpoint"
            :interactive="linkagePreview"
            :model="previewModel"
            :reaction-props="previewReactionProps"
            :reaction-states="previewReactionStates"
            @select="handleCanvasSelect"
            @move="handleMove"
            @add-material="handleAddMaterial"
            @action="handleAction"
            @toggle-interactive="toggleLinkagePreview"
            @update-field="updatePreviewField"
            @resize="handleResize"
          />
        </slot>
      </section>

      <section
        :id="`${workspaceId}-properties-panel`"
        class="mx-config-form-designer__workspace-panel is-properties"
        data-workspace-panel="properties"
        :aria-labelledby="workspaceMode === 'narrow' ? `${workspaceId}-properties-tab` : undefined"
        :aria-label="workspaceMode === 'medium' ? locale.t('property.properties', 'Properties') : undefined"
        :hidden="isWorkspacePanelHidden('properties')"
        :inert="isWorkspacePanelHidden('properties') ? true : undefined"
        :role="workspaceMode === 'narrow' ? 'tabpanel' : workspaceMode === 'medium' ? 'region' : undefined"
      >
        <div v-if="workspaceMode === 'medium'" class="mx-config-form-designer__drawer-header">
          <strong>{{ locale.t('property.properties', 'Properties') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" data-drawer-control="properties" :aria-label="locale.t('action.close', 'Close')" :title="locale.t('action.close', 'Close')" @click="closeMediumPanel('properties')">
            <X :size="17" aria-hidden="true" />
          </button>
        </div>
        <slot
          name="properties"
          :document="controller.document.value"
          :node="controller.selectedNode.value"
          :nodes="controller.selectedNodes.value"
          :material="controller.selectedMaterial.value"
          :diagnostics="controller.diagnostics.value"
          :model-nodes="selectedModelNodes"
          :component-definition="selectedComponentDefinition"
        >
          <DesignerPropertyPanel
            :document="controller.document.value"
            :node="controller.selectedNode.value"
            :nodes="controller.selectedNodes.value"
            :material="controller.selectedMaterial.value"
            :diagnostics="controller.diagnostics.value"
            :model-nodes="selectedModelNodes"
            :component-definition="selectedComponentDefinition"
            :breakpoint="activeBreakpoint"
            :components="registry.components"
            :validator-options="registry.listValidators()"
            :property-controls="registry.propertyControls"
            :readonly="readonly"
            @update-path="handleUpdatePath"
            @update-paths="handleUpdatePaths"
            @update-form="handleUpdateForm"
            @model-operation="handleModelOperation"
          />
        </slot>
      </section>
    </div>

    <span class="mx-config-form-designer__screen-reader" role="status" aria-live="polite" aria-atomic="true">{{ dragAnnouncement }}</span>

    <footer class="mx-config-form-designer__status" aria-live="polite">
      <slot name="diagnostics" :diagnostics="controller.diagnostics.value">
        <span v-if="controller.diagnostics.value.length">
          {{ locale.t('status.issues', '{count} issue{suffix}', { count: controller.diagnostics.value.length, suffix: controller.diagnostics.value.length === 1 ? '' : 's' }) }} · {{ controller.diagnostics.value[0]?.message }}
        </span>
        <span v-else>{{ locale.t('status.ready', 'Ready') }}</span>
      </slot>
    </footer>

    <div v-if="transferMode" class="mx-config-form-designer__dialog-backdrop" @mousedown.self="closeTransfer">
      <section ref="transferDialogRef" class="mx-config-form-designer__dialog" role="dialog" aria-modal="true" tabindex="-1" :aria-label="transferMode === 'import' ? locale.t('action.importDocument', 'Import document') : locale.t('action.exportDocument', 'Export document')" @keydown="handleTransferDialogKeydown">
        <header>
          <strong>{{ transferMode === 'import' ? locale.t('action.importDocument', 'Import document') : locale.t('action.exportDocument', 'Export document') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.close', 'Close')" :aria-label="locale.t('action.close', 'Close')" @click="closeTransfer">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <textarea v-model="transferText" rows="18" spellcheck="false" :readonly="transferMode === 'export'" autofocus />
        <p v-if="transferError" class="mx-config-form-designer__dialog-error" role="alert">
          {{ transferError }}
        </p>
        <footer>
          <template v-if="transferMode === 'import'">
            <button type="button" class="mx-config-form-designer__command-button is-secondary" @click="closeTransfer">
              {{ locale.t('action.cancel', 'Cancel') }}
            </button>
            <button type="button" class="mx-config-form-designer__command-button" @click="applyImport">
              {{ locale.t('action.apply', 'Apply') }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="mx-config-form-designer__command-button is-secondary" :disabled="Boolean(transferError)" @click="copyExport">
              <Clipboard :size="15" aria-hidden="true" /> {{ locale.t('action.copy', 'Copy') }}
            </button>
            <button type="button" class="mx-config-form-designer__command-button" :disabled="Boolean(transferError)" @click="downloadExport">
              <Download :size="15" aria-hidden="true" /> {{ locale.t('action.download', 'Download') }}
            </button>
          </template>
        </footer>
      </section>
    </div>

    <div v-if="previewOpen && previewResult" class="mx-config-form-designer__dialog-backdrop" @mousedown.self="closePreview">
      <section ref="previewDialogRef" class="mx-config-form-designer__dialog is-preview" role="dialog" aria-modal="true" tabindex="-1" :aria-label="locale.t('dialog.preview', 'Form preview')" @keydown="handlePreviewDialogKeydown">
        <header>
          <strong>{{ locale.t('action.preview', 'Preview') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" :title="locale.t('action.close', 'Close')" :aria-label="locale.t('action.closePreview', 'Close preview')" @click="closePreview">
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <slot name="preview" :result="previewResult" :close="closePreview">
          <ConfigFormRenderer
            v-if="previewResult.success"
            v-model="previewModel"
            :namespace="registry.rendererNamespace"
            v-bind="previewResult.renderer"
          />
        </slot>
      </section>
    </div>
  </div>
</template>
