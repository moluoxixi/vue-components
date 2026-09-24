<script setup lang="ts">
import type {
  DesignerSelectionMode,
} from '@moluoxixi/config-form-designer'
import type {
  StudioLeftPanelEmits,
  StudioLeftPanelProps,
  StudioLeftView,
  StudioLayerAction,
} from '../../../studio'
import { Blocks, Check, ChevronDown, ChevronUp, Database, Files, History, Image, IndentDecrease, IndentIncrease, Layers3, MoreHorizontal, Paintbrush, PanelRight, PanelsTopLeft, Plus, RotateCcw, Search, Settings2 } from '@lucide/vue'
import { createDesignerLocale, DesignerPalette } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import './style/index.scss'

const props = defineProps<StudioLeftPanelProps>()

const emit = defineEmits<StudioLeftPanelEmits>()

const internalActiveView = ref<StudioLeftView>('components')
const materialQuery = ref('')
const assetQuery = ref('')
const activeView = computed(() => props.activeView ?? internalActiveView.value)
const layerTree = useTemplateRef<HTMLElement>('layerTree')
const pageList = useTemplateRef<HTMLElement>('pageList')
const locale = computed(() => createDesignerLocale(props.locale))
const views = computed(() => [
  { icon: Blocks, id: 'components' as const, label: locale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: locale.value.t('designer.view.layers', 'Layers') },
  { icon: Files, id: 'pages' as const, label: locale.value.t('designer.view.pages', 'Surfaces') },
  { icon: Paintbrush, id: 'theme' as const, label: locale.value.t('designer.view.theme', 'Theme') },
  { icon: History, id: 'history' as const, label: locale.value.t('designer.view.history', 'History') },
])
const historyPositions = computed(() => {
  const history = props.history
  if (!history)
    return []
  return [
    {
      current: history.position === 0,
      label: locale.value.t('history.initial', 'Earliest retained state'),
      position: 0,
      timestamp: undefined,
    },
    ...history.entries.map((entry, index) => ({
      current: history.position === index + 1,
      label: entry.label,
      position: index + 1,
      timestamp: entry.timestamp as number | undefined,
    })),
  ].reverse()
})
const filteredMaterials = computed(() => {
  const query = materialQuery.value.trim().toLocaleLowerCase()
  if (!query)
    return props.materials
  return props.materials.filter(material => `${locale.value.materialTitle(material)} ${locale.value.materialCategory(material)}`
    .toLocaleLowerCase()
    .includes(query))
})
const materialCategories = computed(() => [...new Set(filteredMaterials.value.map(material => locale.value.materialCategory(material)))])
const surfaceGroups = computed(() => {
  const query = assetQuery.value.trim().toLocaleLowerCase()
  const definitions = [
    { id: 'page' as const, icon: Files, label: locale.value.t('assets.pages', 'Pages') },
    { id: 'dialog' as const, icon: PanelsTopLeft, label: locale.value.t('assets.dialogs', 'Dialogs') },
    { id: 'drawer' as const, icon: PanelRight, label: locale.value.t('assets.drawers', 'Drawers') },
  ]
  return definitions.map(group => ({
    ...group,
    items: props.project.surfaceOrder
      .map(id => props.project.surfacesById[id])
      .flatMap(surface => surface?.kind === group.id ? [surface] : [])
      .filter(surface => !query || `${surface.name} ${surface.id} ${surface.kind === 'page' ? surface.route : surface.kind}`.toLocaleLowerCase().includes(query)),
  }))
})
const visibleSurfaceIds = computed(() => surfaceGroups.value.flatMap(group => group.items.map(surface => surface!.id)))
const filteredDatasets = computed(() => {
  const query = assetQuery.value.trim().toLocaleLowerCase()
  return props.project.datasetOrder
      .map(id => props.project.datasetsById[id])
    .flatMap(dataset => dataset ? [dataset] : [])
    .filter(dataset => !query || `${dataset.name} ${dataset.id}`.toLocaleLowerCase().includes(query))
})
const filteredResources = computed(() => {
  const query = assetQuery.value.trim().toLocaleLowerCase()
  return Object.values(props.project.resources)
    .filter(resource => !query || `${resource.name} ${resource.id} ${resource.kind}`.toLocaleLowerCase().includes(query))
})
const expandedMaterialCategories = ref<string[]>([])

watch(materialCategories, categories => {
  expandedMaterialCategories.value = [...categories]
}, { immediate: true })

function historyTime(timestamp?: number): string {
  if (timestamp === undefined)
    return ''
  return new Intl.DateTimeFormat(locale.value.locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function selectView(view: StudioLeftView): void {
  internalActiveView.value = view
  emit('update:activeView', view)
}

function selectViewName(view: string | number): void {
  const value = String(view) as StudioLeftView
  if (views.value.some(item => item.id === value))
    selectView(value)
}

function runLayerAction(action: StudioLayerAction, nodeId: string): void {
  const layer = props.layers.find(item => item.id === nodeId)
  const allowed = action === 'indent'
    ? layer?.canIndent
    : action === 'outdent'
      ? layer?.canOutdent
      : action === 'moveBefore' ? layer?.canMoveBefore : layer?.canMoveAfter
  if (props.readonly || !allowed)
    return
  emit('arrangeLayer', action, nodeId)
}

function hasLayerActions(layer: StudioLeftPanelProps['layers'][number]): boolean {
  return !props.readonly && (layer.canIndent || layer.canOutdent || layer.canMoveBefore || layer.canMoveAfter)
}

function focusLayerMenuTrigger(nodeId: string): void {
  void nextTick(() => layerTree.value
    ?.querySelector<HTMLButtonElement>(`[data-layer-menu-trigger="${CSS.escape(nodeId)}"]`)
    ?.focus())
}

function restoreLayerMenuFocus(visible: boolean, nodeId: string): void {
  if (!visible)
    focusLayerMenuTrigger(nodeId)
}

function selectLayer(nodeId: string, event: Pick<MouseEvent | KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>): void {
  const mode: DesignerSelectionMode = event.shiftKey
    ? 'range'
    : event.ctrlKey || event.metaKey ? 'toggle' : 'replace'
  emit('selectLayer', nodeId, mode)
}

// Native drag reordering for the layer tree: the drop half of the hovered
// row decides whether the node lands before or after it.
const dragLayerId = ref<string>()
const dropIndicator = ref<{ id: string, position: 'after' | 'before' }>()

function handleLayerDragStart(event: DragEvent, nodeId: string): void {
  if (props.readonly) {
    event.preventDefault()
    return
  }
  dragLayerId.value = nodeId
  event.dataTransfer?.setData('text/plain', nodeId)
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
}

function handleLayerDragOver(event: DragEvent, nodeId: string): void {
  if (!dragLayerId.value || dragLayerId.value === nodeId)
    return
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropIndicator.value = {
    id: nodeId,
    position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
  }
}

function handleLayerDrop(event: DragEvent, nodeId: string): void {
  event.preventDefault()
  const source = dragLayerId.value
  const indicator = dropIndicator.value
  dragLayerId.value = undefined
  dropIndicator.value = undefined
  if (!source || source === nodeId || !indicator || indicator.id !== nodeId)
    return
  emit('moveLayer', source, nodeId, indicator.position)
}

function handleLayerDragEnd(): void {
  dragLayerId.value = undefined
  dropIndicator.value = undefined
}

function navigationIndex(event: KeyboardEvent, current: number, length: number): number | undefined {
  if (event.key === 'ArrowDown')
    return Math.min(length - 1, current + 1)
  if (event.key === 'ArrowUp')
    return Math.max(0, current - 1)
  if (event.key === 'Home')
    return 0
  if (event.key === 'End')
    return length - 1
  return undefined
}

function focusItem(root: HTMLElement | null, attribute: 'layerId' | 'surfaceId', id: string): void {
  void nextTick(() => [...(root?.querySelectorAll<HTMLElement>('[tabindex]') ?? [])]
    .find(element => element.dataset[attribute] === id)
    ?.focus())
}

function handleLayerKeydown(event: KeyboardEvent, nodeId: string): void {
  if (event.currentTarget !== event.target)
    return
  if (event.altKey) {
    const action = event.key === 'ArrowUp'
      ? 'moveBefore'
      : event.key === 'ArrowDown'
        ? 'moveAfter'
        : event.key === 'ArrowRight'
          ? 'indent'
          : event.key === 'ArrowLeft' ? 'outdent' : undefined
    if (!action)
      return
    event.preventDefault()
    runLayerAction(action, nodeId)
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectLayer(nodeId, event)
    return
  }
  const current = props.layers.findIndex(layer => layer.id === nodeId)
  const next = navigationIndex(event, current, props.layers.length)
  if (next === undefined || next === current)
    return
  event.preventDefault()
  const nextId = props.layers[next]!.id
  emit('selectLayer', nextId, 'replace')
  focusItem(layerTree.value, 'layerId', nextId)
}

function handleSurfaceKeydown(event: KeyboardEvent, surfaceId: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('selectSurface', surfaceId)
    return
  }
  const current = visibleSurfaceIds.value.indexOf(surfaceId)
  const next = navigationIndex(event, current, visibleSurfaceIds.value.length)
  if (next === undefined || next === current)
    return
  event.preventDefault()
  const nextId = visibleSurfaceIds.value[next]!
  emit('selectSurface', nextId)
  focusItem(pageList.value, 'surfaceId', nextId)
}

</script>

<template>
  <div class="designer-left-panel">
    <ElTabs class="designer-left-tabs" :model-value="activeView" stretch @tab-change="selectViewName">
      <ElTabPane v-for="view in views" :key="view.id" :name="view.id">
        <template #label>
          <span :data-designer-left-tab="view.id" :aria-label="view.label" :title="view.label">
            <component :is="view.icon" :size="14" aria-hidden="true" />
          </span>
        </template>
      </ElTabPane>
    </ElTabs>

    <div v-if="activeView === 'components'" class="designer-components-panel">
      <ElInput
        v-model="materialQuery"
        class="designer-material-search"
        clearable
        :placeholder="locale.t('palette.search', 'Search')"
        :aria-label="locale.t('palette.searchMaterials', 'Search materials')"
      >
        <template #prefix><Search :size="14" aria-hidden="true" /></template>
      </ElInput>
      <DesignerPalette
        v-if="filteredMaterials.length > 0"
        :materials="filteredMaterials"
        :form="form"
        :registry="registry"
        :readonly="readonly"
        :show-search="false"
        @add-material="emit('addMaterial', $event)"
      >
        <template #content="{ getMaterialBindings, groups, materialTitle }">
          <ElScrollbar class="designer-material-scrollbar">
            <ElCollapse v-model="expandedMaterialCategories" class="designer-material-groups">
              <ElCollapseItem v-for="[category, entries] in groups" :key="category" :name="category">
                <template #title>
                  <span class="designer-material-category">{{ category }}</span>
                </template>
                <div class="designer-material-list">
                  <ElButton
                    v-for="material in entries"
                    :key="material.key"
                    v-bind="getMaterialBindings(material)"
                    :data-material-row-key="material.key"
                    text
                    native-type="button"
                    class="designer-material-button"
                  >
                    <span class="mx-config-form-designer__palette-item-summary">
                      <component :is="material.icon" v-if="material.icon" :size="16" aria-hidden="true" />
                      <span v-else class="designer-material-kind" aria-hidden="true">{{ material.kind === 'field' ? 'F' : 'L' }}</span>
                      <span class="mx-config-form-designer__palette-item-name">{{ materialTitle(material) }}</span>
                    </span>
                  </ElButton>
                </div>
              </ElCollapseItem>
            </ElCollapse>
          </ElScrollbar>
        </template>
      </DesignerPalette>
      <ElEmpty v-else :description="locale.t('palette.empty', 'No materials')" :image-size="42" />
    </div>

    <ElScrollbar v-else-if="activeView === 'layers'" class="designer-layers-scrollbar">
    <div ref="layerTree" class="designer-layers" role="tree" :aria-label="locale.t('layer.tree', 'Surface layers')">
      <div
        v-for="(layer, index) in layers"
        :key="layer.id"
        role="treeitem"
        :aria-level="layer.depth + 1"
        :aria-selected="selectedIds.includes(layer.id)"
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
        :data-layer-id="layer.id"
        :tabindex="selectedIds[0] === layer.id || (selectedIds.length === 0 && index === 0) ? 0 : -1"
        :class="{
          'is-selected': selectedIds.includes(layer.id),
          'is-dragging': dragLayerId === layer.id,
          'is-drop-before': dropIndicator?.id === layer.id && dropIndicator.position === 'before',
          'is-drop-after': dropIndicator?.id === layer.id && dropIndicator.position === 'after',
        }"
        :draggable="!readonly"
        @keydown="handleLayerKeydown($event, layer.id)"
        @dragstart="handleLayerDragStart($event, layer.id)"
        @dragover="handleLayerDragOver($event, layer.id)"
        @drop="handleLayerDrop($event, layer.id)"
        @dragend="handleLayerDragEnd"
      >
        <ElButton text native-type="button" tabindex="-1" class="designer-layer-select" :style="{ paddingLeft: `${10 + layer.depth * 16}px` }" :title="layer.label" @click="selectLayer(layer.id, $event)">
          <Layers3 :size="13" aria-hidden="true" />
          <span>{{ layer.label }}</span>
        </ElButton>
        <div class="designer-layer-actions">
          <ElDropdown v-if="hasLayerActions(layer)" trigger="click" placement="bottom-end" :show-timeout="0" :hide-timeout="0" append-to="#workbench-overlays" @command="runLayerAction($event, layer.id)" @visible-change="restoreLayerMenuFocus($event, layer.id)">
            <ElButton
              text
              native-type="button"
              class="designer-layer-menu-trigger"
              :data-layer-menu-trigger="layer.id"
              :tabindex="selectedIds.includes(layer.id) ? 0 : -1"
              :aria-label="locale.t('layer.arrange', 'Arrange {name}', { name: layer.label })"
              :title="locale.t('layer.arrange', 'Arrange {name}', { name: layer.label })"
            ><MoreHorizontal :size="14" aria-hidden="true" /></ElButton>
            <template #dropdown>
              <ElDropdownMenu class="designer-layer-menu" data-layer-action-menu @keydown.capture.esc="focusLayerMenuTrigger(layer.id)">
                <ElDropdownItem v-if="layer.canMoveBefore" command="moveBefore"><ChevronUp :size="14" aria-hidden="true" /><span>{{ locale.t('layer.moveUp', 'Move up') }}</span></ElDropdownItem>
                <ElDropdownItem v-if="layer.canMoveAfter" command="moveAfter"><ChevronDown :size="14" aria-hidden="true" /><span>{{ locale.t('layer.moveDown', 'Move down') }}</span></ElDropdownItem>
                <ElDropdownItem v-if="layer.canIndent" command="indent"><IndentIncrease :size="14" aria-hidden="true" /><span>{{ locale.t('layer.indent', 'Indent') }}</span></ElDropdownItem>
                <ElDropdownItem v-if="layer.canOutdent" command="outdent"><IndentDecrease :size="14" aria-hidden="true" /><span>{{ locale.t('layer.outdent', 'Outdent') }}</span></ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </div>
      <ElEmpty v-if="layers.length === 0" :description="locale.t('layer.empty', 'No layers yet')" :image-size="42" />
    </div>
    </ElScrollbar>

    <div v-else-if="activeView === 'pages'" class="designer-pages-panel">
      <ElInput
        v-model="assetQuery"
        class="designer-asset-search"
        clearable
        :placeholder="locale.t('assets.search', 'Search assets')"
        :aria-label="locale.t('assets.search', 'Search assets')"
      >
        <template #prefix><Search :size="14" aria-hidden="true" /></template>
      </ElInput>
      <ElScrollbar>
      <nav ref="pageList" class="designer-pages" :aria-label="locale.t('assets.project', 'Project assets')">
        <section v-for="group in surfaceGroups" :key="group.id" class="designer-asset-group" :aria-labelledby="`asset-group-${group.id}`">
          <header :id="`asset-group-${group.id}`">
            <component :is="group.icon" :size="13" aria-hidden="true" />
            <strong>{{ group.label }}</strong>
            <span>{{ group.items.length }}</span>
          </header>
          <div role="listbox" :aria-label="group.label">
            <ElButton
              v-for="surface in group.items"
              :key="surface.id"
              text
              native-type="button"
              role="option"
              :aria-selected="surface.id === currentSurfaceId"
              :aria-current="surface.id === currentSurfaceId ? 'page' : undefined"
              :data-surface-id="surface.id"
              :tabindex="surface.id === currentSurfaceId ? 0 : -1"
              :class="{ 'is-current': surface.id === currentSurfaceId }"
              @click="emit('selectSurface', surface.id)"
              @keydown="handleSurfaceKeydown($event, surface.id)"
            >
              <component :is="group.icon" :size="14" aria-hidden="true" />
              <span>{{ surface.name }}</span>
              <small>{{ surface.kind === 'page' ? surface.route : surface.kind }}</small>
            </ElButton>
            <p v-if="group.items.length === 0">{{ locale.t('assets.emptyGroup', 'No matching assets') }}</p>
          </div>
        </section>
        <section class="designer-asset-group" aria-labelledby="asset-group-dataset">
          <header id="asset-group-dataset"><Database :size="13" aria-hidden="true" /><strong>{{ locale.t('assets.datasets', 'Datasets') }}</strong><span>{{ filteredDatasets.length }}</span></header>
          <ul><li v-for="dataset in filteredDatasets" :key="dataset.id"><ElButton text native-type="button" :aria-label="locale.t('assets.openDataset', 'Open dataset {name}', { name: dataset.name })" @click="emit('manageAssets', 'dataset', dataset.id)"><Database :size="13" aria-hidden="true" /><span>{{ dataset.name }}</span><small>{{ dataset.rows.length }}</small></ElButton></li></ul>
          <p v-if="filteredDatasets.length === 0">{{ locale.t('assets.emptyGroup', 'No matching assets') }}</p>
        </section>
        <section class="designer-asset-group" aria-labelledby="asset-group-resource">
          <header id="asset-group-resource"><Image :size="13" aria-hidden="true" /><strong>{{ locale.t('assets.resources', 'Resources') }}</strong><span>{{ filteredResources.length }}</span></header>
          <ul><li v-for="resource in filteredResources" :key="resource.id"><ElButton text native-type="button" :aria-label="locale.t('assets.openResource', 'Open resource {name}', { name: resource.name })" @click="emit('manageAssets', 'resource', resource.id)"><Image :size="13" aria-hidden="true" /><span>{{ resource.name }}</span><small>{{ resource.kind }}</small></ElButton></li></ul>
          <p v-if="filteredResources.length === 0">{{ locale.t('assets.emptyGroup', 'No matching assets') }}</p>
        </section>
      </nav>
      </ElScrollbar>
      <ElButton native-type="button" class="manage-data-button" @click="emit('manageAssets')">
        <Plus :size="14" aria-hidden="true" />
        {{ locale.t('assets.manage', 'Manage data') }}
      </ElButton>
      <ElButton native-type="button" class="manage-pages-button" @click="emit('manageSurfaces')">
        <Settings2 :size="14" aria-hidden="true" />
        {{ locale.t('pages.manage', 'Manage pages') }}
      </ElButton>
    </div>

    <div v-else-if="activeView === 'theme'" class="designer-theme-panel">
      <slot name="theme" />
    </div>

    <div v-else class="designer-history-panel">
      <div class="designer-history-header">
        <strong>{{ locale.t('history.title', 'Local history') }}</strong>
        <small>{{ locale.t('history.position', '{current} of {total}', { current: history?.position ?? 0, total: history?.entries.length ?? 0 }) }}</small>
      </div>
      <ElScrollbar v-if="historyPositions.length > 0">
      <ol class="designer-history-list" :aria-label="locale.t('history.timeline', 'Operation history')">
        <li v-for="item in historyPositions" :key="item.position" :class="{ 'is-current': item.current }">
          <ElButton text native-type="button" :aria-current="item.current ? 'step' : undefined" :disabled="item.current || readonly" @click="emit('jumpHistory', item.position)">
            <span class="designer-history-marker">
              <Check v-if="item.current" :size="12" aria-hidden="true" />
              <RotateCcw v-else :size="12" aria-hidden="true" />
            </span>
            <span class="designer-history-copy">
              <strong>{{ item.label }}</strong>
              <small v-if="item.timestamp">{{ historyTime(item.timestamp) }}</small>
            </span>
          </ElButton>
        </li>
      </ol>
      </ElScrollbar>
      <ElEmpty v-else class="designer-history-empty" :description="locale.t('history.empty', 'No local operations yet.')" :image-size="42" />
      <p class="designer-history-limit">{{ locale.t('history.limit', 'Keeps the latest {count} operations', { count: history?.limit ?? 0 }) }}</p>
    </div>
  </div>
</template>
