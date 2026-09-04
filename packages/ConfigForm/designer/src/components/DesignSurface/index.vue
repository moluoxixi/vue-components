<script setup lang="ts">
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form'
import type { DesignerDropTarget } from '../../graph'
import type { DesignerDragAnnouncement, DesignerDragSource } from '../DesignerCanvas'
import type {
  DesignSurfaceEmits,
  DesignSurfaceExpose,
  DesignSurfaceProps,
  DesignSurfaceSlots,
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
import { computed, onBeforeUnmount, provide, reactive, watch } from 'vue'
import { useDesignerController } from '../../composables'
import {
  applyDesignGraphReactions,
  createDesignPreviewModel,
  findDesignNode,
} from '../../graph'
import { createDesignerLocale, DESIGNER_LOCALE_KEY } from '../../locale'
import { DesignerCanvas } from '../DesignerCanvas'
import { DesignerCommandHint } from '../DesignerCommandHint'
import DesignerPalette from '../DesignerPalette'
import { DesignerPropertyPanel } from '../DesignerPropertyPanel'
import { createDesignerDesignSession, createDesignerMaterialCandidate, DESIGNER_SESSION_KEY } from '../DesignerCanvas/services'
import { useDesignSurfaceCommands, useDesignSurfaceWorkspace } from './composables'
import './style'

const props = withDefaults(defineProps<DesignSurfaceProps>(), {
  readonly: false,
  workspaceNavigation: 'internal',
})
const emit = defineEmits<DesignSurfaceEmits>()
const slots = defineSlots<DesignSurfaceSlots>()

const locale = reactive(createDesignerLocale(props.locale))
provide(DESIGNER_LOCALE_KEY, locale)
watch(() => props.locale, value => Object.assign(locale, createDesignerLocale(value)), { deep: true })

const {
  activeBreakpoint,
  activeWorkspaceView,
  closeMediumPanel,
  handleRootFocusin,
  handleWorkspaceTabKeydown,
  isSidePanelOpen,
  isWorkspacePanelHidden,
  mediumPanel,
  paletteOpen,
  propertiesOpen,
  rootRef,
  selectBreakpoint,
  selectWorkspaceView,
  toggleWorkspacePanel,
  workspaceId,
  workspaceMode,
  workspaceViews,
} = useDesignSurfaceWorkspace({
  navigation: () => props.workspaceNavigation,
})

const breakpoints: Array<{ key: ConfigFormBreakpoint, icon: typeof Monitor }> = [
  { key: 'desktop', icon: Monitor },
  { key: 'tablet', icon: Tablet },
  { key: 'mobile', icon: Smartphone },
]

function breakpointTitle(breakpoint: ConfigFormBreakpoint): string {
  return locale.t(`breakpoint.${breakpoint}`, breakpoint[0]!.toUpperCase() + breakpoint.slice(1))
}
let lastAcceptedCommandId: string | undefined
let historyTransitionSequence = 0
const controller = useDesignerController({
  execute: (command) => {
    const result = props.commandControl.execute(command)
    if (result.changed)
      lastAcceptedCommandId = command.id
    return result
  },
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

const designSession = createDesignerDesignSession(controller, {
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
const dragController = designSession.drag
provide(DESIGNER_SESSION_KEY, designSession)
onBeforeUnmount(designSession.dispose)

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
  const component = controller.selectedNode.value?.component
  return component ? props.componentRegistry.get(component) : undefined
})
const {
  addMaterial,
  handleAction,
  handleAddMaterial,
  handleCanvasSelect,
  handleMove,
  handleRedo,
  handleRemoveStoredConfig,
  handleResize,
  handleRootKeydown,
  handleUndo,
  handleUpdateForm,
  handleUpdatePath,
  handleUpdatePaths,
  toolbarScope,
} = useDesignSurfaceCommands({
  activeBreakpoint,
  activeWorkspaceView,
  closeMediumPanel,
  controller,
  deletedNotice: () => locale.t('node.deletedUndo', 'Deleted. Undo to restore.'),
  historyControl: () => props.historyControl,
  lastAcceptedCommandId: () => lastAcceptedCommandId,
  mediumPanel,
  onNotice: (message, action) => emit('notice', message, action),
  pageId: () => props.pageId,
  readonly: () => props.readonly,
  rootRef,
  selectBreakpoint,
  workspaceMode,
})
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
          <DesignerCommandHint :renderer="commandHint" :label="locale.t('action.close', 'Close')">
            <button type="button" class="mx-config-form-designer__icon-button" data-drawer-control="palette" :aria-label="locale.t('action.close', 'Close')" :title="locale.t('action.close', 'Close')" @click="closeMediumPanel('palette')"><X :size="17" aria-hidden="true" /></button>
          </DesignerCommandHint>
        </div>
        <slot name="palette" :materials="registry.listMaterials()" :add-material="addMaterial" :readonly="readonly" :form="controller.graph.value.form">
          <DesignerPalette :materials="registry.listMaterials()" :registry="registry" :form="controller.graph.value.form" :readonly="readonly" @add-material="addMaterial" />
        </slot>
      </section>

      <section :id="`${workspaceId}-canvas-panel`" class="mx-config-form-designer__workspace-panel is-canvas" data-workspace-panel="canvas" tabindex="-1" :hidden="isWorkspacePanelHidden('canvas')" :inert="isWorkspacePanelHidden('canvas') ? true : undefined" :role="workspaceMode === 'narrow' ? 'tabpanel' : undefined">
        <DesignerCanvas
          :command-hint="commandHint"
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
          <DesignerCommandHint :renderer="commandHint" :label="locale.t('action.close', 'Close')">
            <button type="button" class="mx-config-form-designer__icon-button" data-drawer-control="properties" :aria-label="locale.t('action.close', 'Close')" :title="locale.t('action.close', 'Close')" @click="closeMediumPanel('properties')"><X :size="17" aria-hidden="true" /></button>
          </DesignerCommandHint>
        </div>
        <slot name="properties" :graph="controller.graph.value" :node="controller.selectedNode.value" :nodes="controller.selectedNodes.value" :material="controller.selectedMaterial.value" :diagnostics="controller.diagnostics.value" :component-definition="selectedComponentDefinition">
          <DesignerPropertyPanel
            :graph="controller.graph.value"
            :node="controller.selectedNode.value"
            :nodes="controller.selectedNodes.value"
            :material="controller.selectedMaterial.value"
            :diagnostics="controller.diagnostics.value"
            :component-definition="selectedComponentDefinition"
            :get-material="registry.getMaterial"
            :get-component-definition="componentRegistry.get"
            :breakpoint="activeBreakpoint"
            :components="registry.components"
            :validator-options="registry.listValidators()"
            :property-controls="registry.propertyControls"
            :readonly="readonly"
            @configure-event="emit('configureEvent', $event.nodeId, $event.eventName)"
            @remove-stored-config="handleRemoveStoredConfig"
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
