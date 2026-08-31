<script setup lang="ts">
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { DesignerDropTarget } from '../graph'
import type { DesignerDragAnnouncement, DesignerDragSource } from './designer-drag'
import type {
  DesignSurfaceEmits,
  DesignSurfaceExpose,
  DesignSurfaceProps,
  DesignSurfaceSlots,
  DesignerNodeAction,
} from './types'
import {
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Smartphone,
  Tablet,
  X,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, useId, watch } from 'vue'
import { useDesignerController } from '../composables'
import {
  applyDesignGraphReactions,
  createDesignPreviewModel,
  createFormCommand,
  createMoveCommand,
  createNodePathCommand,
  createResizeCommand,
  findDesignNode,
} from '../graph'
import { createDesignerLocale, DESIGNER_LOCALE_KEY } from '../locale'
import DesignerCanvas from './DesignerCanvas.vue'
import DesignerPalette from './DesignerPalette.vue'
import DesignerPropertyPanel from './DesignerPropertyPanel.vue'
import { createDesignerDragController, createDesignerMaterialCandidate, DESIGNER_DRAG_KEY } from './designer-drag'
import '../styles.scss'

const props = withDefaults(defineProps<DesignSurfaceProps>(), {
  eventEditor: 'actions',
  readonly: false,
  workspaceNavigation: 'internal',
})
const emit = defineEmits<DesignSurfaceEmits>()
const slots = defineSlots<DesignSurfaceSlots>()

const locale = reactive(createDesignerLocale(props.locale))
provide(DESIGNER_LOCALE_KEY, locale)
watch(() => props.locale, value => Object.assign(locale, createDesignerLocale(value)), { deep: true })

type WorkspaceView = 'palette' | 'canvas' | 'properties'
type SidePanel = Exclude<WorkspaceView, 'canvas'>

const rootRef = ref<HTMLElement>()
const activeBreakpoint = ref<ConfigFormBreakpoint>(recommendedBreakpoint())
const activeWorkspaceView = ref<WorkspaceView>('canvas')
const workspaceWidth = ref<number>()
const paletteOpen = ref(true)
const propertiesOpen = ref(true)
const mediumPanel = ref<SidePanel>()
const workspaceId = useId()
const workspaceViews = [
  { id: 'palette' as const, label: 'Components' },
  { id: 'canvas' as const, label: 'Canvas' },
  { id: 'properties' as const, label: 'Inspector' },
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
let focusedWorkspaceControl: { kind: 'drawer' | 'panel' | 'tab' | 'trigger', view: WorkspaceView } | undefined

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

function selectWorkspaceView(view: WorkspaceView): void {
  activeWorkspaceView.value = view
  if (workspaceMode.value === 'medium' && view !== 'canvas')
    mediumPanel.value = view
}

function breakpointTitle(breakpoint: ConfigFormBreakpoint): string {
  return locale.t(`breakpoint.${breakpoint}`, breakpoint[0]!.toUpperCase() + breakpoint.slice(1))
}

function measureWorkspace(): void {
  const width = rootRef.value?.getBoundingClientRect().width
  if (width && width > 0)
    workspaceWidth.value = width
}

function isSidePanelOpen(view: SidePanel): boolean {
  if (workspaceMode.value === 'medium')
    return mediumPanel.value === view
  return view === 'palette' ? paletteOpen.value : propertiesOpen.value
}

function isWorkspacePanelHidden(view: WorkspaceView): boolean {
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

function toggleWorkspacePanel(view: SidePanel): void {
  if (workspaceMode.value === 'medium') {
    mediumPanel.value = mediumPanel.value === view ? undefined : view
    return
  }
  if (view === 'palette')
    paletteOpen.value = !paletteOpen.value
  else
    propertiesOpen.value = !propertiesOpen.value
}

function closeMediumPanel(view: SidePanel): void {
  if (workspaceMode.value !== 'medium' || mediumPanel.value !== view)
    return
  const activeElement = document.activeElement
  const panel = rootRef.value?.querySelector<HTMLElement>(`[data-workspace-panel="${view}"]`)
  const restoreFocus = activeElement === document.body
    || (activeElement instanceof HTMLElement && panel?.contains(activeElement))
  mediumPanel.value = undefined
  if (restoreFocus) {
    void nextTick(() => rootRef.value
      ?.querySelector<HTMLButtonElement>(`[data-sidebar-trigger="${view}"]`)
      ?.focus())
  }
}

function handleWorkspaceTabKeydown(event: KeyboardEvent, view: WorkspaceView): void {
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
  activeWorkspaceView.value = workspaceViews[nextIndex]!.id
  void nextTick(() => rootRef.value
    ?.querySelector<HTMLButtonElement>(`[data-workspace-tab="${activeWorkspaceView.value}"]`)
    ?.focus())
}

function workspaceViewForElement(element: HTMLElement | null): WorkspaceView | undefined {
  const view = element?.dataset.workspaceTab
    ?? element?.dataset.sidebarTrigger
    ?? element?.closest<HTMLElement>('[data-workspace-panel]')?.dataset.workspacePanel
  return workspaceViews.some(item => item.id === view) ? view as WorkspaceView : undefined
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
    if (props.workspaceNavigation === 'external') {
      if (focusedView && focusedView !== activeWorkspaceView.value) {
        void nextTick(() => rootRef.value
          ?.querySelector<HTMLElement>(`[data-workspace-panel="${activeWorkspaceView.value}"]`)
          ?.focus())
      }
      return
    }
    activeWorkspaceView.value = focusedView
      ?? (previousMode === 'medium' ? mediumPanel.value : undefined)
      ?? activeWorkspaceView.value
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
  execute: command => props.commandControl.execute(command),
  graph: () => props.graph,
  pageId: () => props.pageId,
  registry: () => props.registry,
  readonly: () => props.readonly,
  onDiagnostics: diagnostics => emit('diagnostics', diagnostics),
  onSelectionChange: (nodeId, nodeIds) => {
    emit('selectionChange', nodeId)
    emit('selectionSetChange', nodeIds, nodeId)
  },
})

const dragController = createDesignerDragController({
  commitMaterial: (source, target) => {
    const candidate = createDesignerMaterialCandidate(props.registry, source.materialKey, source.candidateId)
    if (!candidate || !controller.dispatch({
      id: `drop-${source.candidateId}`,
      label: 'Insert component',
      actions: [{
        type: 'operation.apply',
        operations: [{
          type: 'node.insert',
          pageId: props.pageId,
          subgraph: candidate.subgraph,
          target,
        }],
      }],
    }))
      return
    controller.select(candidate.node.id)
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
  const node = findDesignNode(controller.graph.value, source.nodeId)?.node
  if (!node)
    return source.nodeId
  if (node.kind === 'field')
    return node.label || node.field
  const material = props.registry.getMaterial(node.component)
  return material ? locale.materialTitle(material) : node.component
}

function dragTargetLabel(target: DesignerDropTarget | undefined): string {
  if (!target)
    return locale.t('drag.targetUnavailable', 'an unavailable position')
  const position = (target.index ?? 0) + 1
  if (target.parentId === null)
    return locale.t('drag.targetPage', 'at page position {position}', { position })
  const parent = findDesignNode(controller.graph.value, target.parentId)?.node
  const parentMaterial = parent ? props.registry.getMaterial(parent.component) : undefined
  const parentLabel = parentMaterial ? locale.materialTitle(parentMaterial) : target.parentId
  const slot = target.slot && parentMaterial
    ? locale.materialSlotTitle(parentMaterial, target.slot, target.slot)
    : target.slot ?? locale.t('drag.defaultSlot', 'default slot')
  return locale.t('drag.targetSlot', 'in {parent}, {slot}, position {position}', { parent: parentLabel, slot, position })
}

function formatDragAnnouncement(announcement: DesignerDragAnnouncement): string {
  const item = dragSourceLabel(announcement.source)
  const target = dragTargetLabel(announcement.target)
  if (announcement.type === 'picked-up')
    return locale.t('drag.pickedUp', 'Picked up {item}, currently {target}. Use arrow keys to choose a destination, Space to drop, or Escape to cancel.', { item, target })
  if (announcement.type === 'target')
    return locale.t('drag.targetChanged', '{item} will be placed {target}.', { item, target })
  if (announcement.type === 'dropped')
    return locale.t('drag.dropped', 'Dropped {item} {target}.', { item, target })
  return locale.t('drag.cancelled', 'Cancelled dragging {item}.', { item })
}

const dragAnnouncement = computed(() => {
  const announcement = dragController.announcement.value
  return announcement ? formatDragAnnouncement(announcement) : ''
})
const runtimeProjection = computed(() => applyDesignGraphReactions(
  controller.graph.value,
  createDesignPreviewModel(controller.graph.value),
))
const selectedComponentDefinition = computed(() => {
  const component = controller.selectedNodes.value[0]?.component
  return component ? props.componentRegistry.get(component) : undefined
})
const toolbarScope = computed(() => ({
  breakpoint: activeBreakpoint.value,
  canUndo: props.historyControl.canUndo,
  canRedo: props.historyControl.canRedo,
  canEditSelection: !props.readonly && controller.selectedIds.value.length > 0,
  readonly: props.readonly,
  copySelection: () => handleSelectionAction('copy'),
  removeSelection: () => handleSelectionAction('remove'),
  selectBreakpoint,
  undo: handleUndo,
  redo: handleRedo,
}))

async function focusNode(nodeId?: string): Promise<void> {
  if (!nodeId)
    return
  await nextTick()
  const target = [...(rootRef.value?.querySelectorAll<HTMLElement>('[data-editor-focus-node-id]') ?? [])]
    .find(element => element.dataset.editorFocusNodeId === nodeId)
  target?.focus()
}

function dispatch(command: ProjectCommand): boolean {
  const changed = controller.dispatch(command)
  void focusNode(controller.selectedId.value)
  return changed
}

function handleUndo(): boolean {
  const changed = props.historyControl.undo()
  void focusNode(controller.selectedId.value)
  return changed
}

function handleRedo(): boolean {
  const changed = props.historyControl.redo()
  void focusNode(controller.selectedId.value)
  return changed
}

function handleMove(nodeId: string, target: DesignerDropTarget): void {
  controller.select(nodeId)
  dispatch(createMoveCommand(props.pageId, nodeId, target))
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

function handleCanvasSelect(nodeId?: string, mode: 'range' | 'replace' | 'toggle' = 'replace'): void {
  controller.select(nodeId, mode)
  if (nodeId && workspaceMode.value === 'medium')
    mediumPanel.value = 'properties'
}

function handleResize(nodeId: string, span: number): void {
  controller.select(nodeId)
  dispatch(createResizeCommand(props.pageId, nodeId, span))
}

function handleUpdatePath(nodeId: string, path: string[], value: unknown): void {
  dispatch(createNodePathCommand(controller.graph.value, props.pageId, [nodeId], path, value))
}

function handleUpdatePaths(nodeIds: string[], path: string[], value: unknown): void {
  dispatch(createNodePathCommand(controller.graph.value, props.pageId, nodeIds, path, value))
}

function handleUpdateForm(changes: Record<string, unknown>): void {
  dispatch(createFormCommand(controller.graph.value, props.pageId, changes))
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

defineExpose<DesignSurfaceExpose>({
  performNodeAction: controller.performNodeAction,
  redo: handleRedo,
  select: controller.select,
  selectBreakpoint,
  selectWorkspaceView,
  undo: handleUndo,
})
</script>

<template>
  <div
    ref="rootRef"
    class="mx-config-form-designer mx-config-form-design-surface"
    :data-active-view="activeWorkspaceView"
    :data-palette-open="isSidePanelOpen('palette')"
    :data-properties-open="isSidePanelOpen('properties')"
    :data-workspace-navigation="workspaceNavigation"
    :data-workspace-mode="workspaceMode"
    @focusin="handleRootFocusin"
    @keydown="handleRootKeydown"
  >
    <header class="mx-config-form-designer__toolbar">
      <strong>{{ locale.t('designer.title', 'Form Designer') }}</strong>
      <div class="mx-config-form-designer__toolbar-controls">
        <div v-if="workspaceMode !== 'narrow'" class="mx-config-form-designer__sidebar-actions" role="group" :aria-label="locale.t('designer.sidebars', 'Designer sidebars')">
          <button type="button" class="mx-config-form-designer__icon-button" data-sidebar-trigger="palette" :aria-controls="`${workspaceId}-palette-panel`" :aria-expanded="isSidePanelOpen('palette')" :aria-label="isSidePanelOpen('palette') ? locale.t('designer.hidePalette', 'Hide materials') : locale.t('designer.showPalette', 'Show materials')" :title="isSidePanelOpen('palette') ? locale.t('designer.hidePalette', 'Hide materials') : locale.t('designer.showPalette', 'Show materials')" @click="toggleWorkspacePanel('palette')">
            <PanelLeftClose v-if="isSidePanelOpen('palette')" :size="17" aria-hidden="true" />
            <PanelLeftOpen v-else :size="17" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" data-sidebar-trigger="properties" :aria-controls="`${workspaceId}-properties-panel`" :aria-expanded="isSidePanelOpen('properties')" :aria-label="isSidePanelOpen('properties') ? locale.t('designer.hideProperties', 'Hide properties') : locale.t('designer.showProperties', 'Show properties')" :title="isSidePanelOpen('properties') ? locale.t('designer.hideProperties', 'Hide properties') : locale.t('designer.showProperties', 'Show properties')" @click="toggleWorkspacePanel('properties')">
            <PanelRightClose v-if="isSidePanelOpen('properties')" :size="17" aria-hidden="true" />
            <PanelRightOpen v-else :size="17" aria-hidden="true" />
          </button>
        </div>
        <slot name="toolbar" v-bind="toolbarScope" />
      </div>
    </header>

    <div class="mx-config-form-designer__workspace">
      <nav v-if="workspaceMode === 'narrow' && workspaceNavigation === 'internal'" class="mx-config-form-designer__workspace-tabs" role="tablist" :aria-label="locale.t('designer.workspaceViews', 'Designer views')">
        <button v-for="view in workspaceViews" :id="`${workspaceId}-${view.id}-tab`" :key="view.id" type="button" role="tab" :aria-controls="`${workspaceId}-${view.id}-panel`" :aria-selected="activeWorkspaceView === view.id" :data-workspace-tab="view.id" :tabindex="activeWorkspaceView === view.id ? 0 : -1" @click="activeWorkspaceView = view.id" @keydown="handleWorkspaceTabKeydown($event, view.id)">
          {{ locale.t(`designer.view.${view.id}`, view.label) }}
        </button>
      </nav>

      <section :id="`${workspaceId}-palette-panel`" class="mx-config-form-designer__workspace-panel is-palette" data-workspace-panel="palette" :hidden="isWorkspacePanelHidden('palette')" :inert="isWorkspacePanelHidden('palette') ? true : undefined" :role="workspaceMode === 'narrow' ? 'tabpanel' : workspaceMode === 'medium' ? 'region' : undefined">
        <div v-if="workspaceMode === 'medium'" class="mx-config-form-designer__drawer-header">
          <strong>{{ locale.t('palette.materials', 'Materials') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" data-drawer-control="palette" :aria-label="locale.t('action.close', 'Close')" :title="locale.t('action.close', 'Close')" @click="closeMediumPanel('palette')"><X :size="17" aria-hidden="true" /></button>
        </div>
        <slot name="palette" :materials="registry.listMaterials()" :add-material="addMaterial" :readonly="readonly" :form="controller.graph.value.form">
          <DesignerPalette :materials="registry.listMaterials()" :registry="registry" :form="controller.graph.value.form" :readonly="readonly" @add-material="addMaterial" />
        </slot>
      </section>

      <section :id="`${workspaceId}-canvas-panel`" class="mx-config-form-designer__workspace-panel is-canvas" data-workspace-panel="canvas" tabindex="-1" :hidden="isWorkspacePanelHidden('canvas')" :inert="isWorkspacePanelHidden('canvas') ? true : undefined" :role="workspaceMode === 'narrow' ? 'tabpanel' : undefined">
        <DesignerCanvas
          :graph="controller.graph.value"
          :page-id="pageId"
          :registry="registry"
          :selected-id="controller.selectedId.value"
          :selected-ids="controller.selectedIds.value"
          :readonly="readonly"
          :breakpoint="activeBreakpoint"
          :candidate-preview="commandControl.preview"
          :interactive="false"
          :model="runtimeProjection.values"
          :runtime-renderer="runtimeRenderer"
          :reaction-props="runtimeProjection.props"
          :reaction-states="runtimeProjection.states"
          @select="handleCanvasSelect"
          @move="handleMove"
          @add-material="handleAddMaterial"
          @action="handleAction"
          @resize="handleResize"
        >
          <template v-if="slots.runtime" #runtime="scope">
            <slot name="runtime" v-bind="scope" />
          </template>
          <template #dragVisual="scope">
            <slot v-if="slots.dragVisual" name="dragVisual" v-bind="scope" />
          </template>
        </DesignerCanvas>
      </section>

      <section :id="`${workspaceId}-properties-panel`" class="mx-config-form-designer__workspace-panel is-properties" data-workspace-panel="properties" :hidden="isWorkspacePanelHidden('properties')" :inert="isWorkspacePanelHidden('properties') ? true : undefined" :role="workspaceMode === 'narrow' ? 'tabpanel' : workspaceMode === 'medium' ? 'region' : undefined">
        <div v-if="workspaceMode === 'medium'" class="mx-config-form-designer__drawer-header">
          <strong>{{ locale.t('property.properties', 'Properties') }}</strong>
          <button type="button" class="mx-config-form-designer__icon-button" data-drawer-control="properties" :aria-label="locale.t('action.close', 'Close')" :title="locale.t('action.close', 'Close')" @click="closeMediumPanel('properties')"><X :size="17" aria-hidden="true" /></button>
        </div>
        <slot name="properties" :graph="controller.graph.value" :node="controller.selectedNode.value" :nodes="controller.selectedNodes.value" :material="controller.selectedMaterial.value" :diagnostics="controller.diagnostics.value" :component-definition="selectedComponentDefinition">
          <DesignerPropertyPanel
            :graph="controller.graph.value"
            :event-editor="eventEditor"
            :node="controller.selectedNode.value"
            :nodes="controller.selectedNodes.value"
            :material="controller.selectedMaterial.value"
            :diagnostics="controller.diagnostics.value"
            :component-definition="selectedComponentDefinition"
            :breakpoint="activeBreakpoint"
            :components="registry.components"
            :validator-options="registry.listValidators()"
            :property-controls="registry.propertyControls"
            :readonly="readonly"
            @configure-event="emit('configureEvent', $event.nodeId, $event.eventName)"
            @update-path="handleUpdatePath"
            @update-paths="handleUpdatePaths"
            @update-form="handleUpdateForm"
          />
        </slot>
      </section>
    </div>

    <span class="mx-config-form-designer__screen-reader" role="status" aria-live="polite" aria-atomic="true">{{ dragAnnouncement }}</span>
    <footer class="mx-config-form-designer__status" aria-live="polite">
      <span v-if="controller.diagnostics.value.length">{{ locale.t('status.issues', '{count} issues', { count: controller.diagnostics.value.length }) }} · {{ controller.diagnostics.value[0]?.message }}</span>
      <span v-else>{{ locale.t('status.ready', 'Ready') }}</span>
    </footer>
  </div>
</template>
