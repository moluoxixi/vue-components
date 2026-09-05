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
import { Blocks, Check, ChevronDown, ChevronUp, Files, History, IndentDecrease, IndentIncrease, Layers3, MoreHorizontal, RotateCcw, Search, Settings2 } from '@lucide/vue'
import { createDesignerLocale, DesignerPalette } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import './style/index.scss'

const props = defineProps<StudioLeftPanelProps>()

const emit = defineEmits<StudioLeftPanelEmits>()

const internalActiveView = ref<StudioLeftView>('components')
const materialQuery = ref('')
const activeView = computed(() => props.activeView ?? internalActiveView.value)
const layerTree = useTemplateRef<HTMLElement>('layerTree')
const pageList = useTemplateRef<HTMLElement>('pageList')
const locale = computed(() => createDesignerLocale(props.locale))
const views = computed(() => [
  { icon: Blocks, id: 'components' as const, label: locale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: locale.value.t('designer.view.layers', 'Layers') },
  { icon: Files, id: 'pages' as const, label: locale.value.t('designer.view.pages', 'Pages') },
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
  emit('arrangeLayer', action, nodeId)
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

function focusItem(root: HTMLElement | null, attribute: 'layerId' | 'pageId', id: string): void {
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
    emit('arrangeLayer', action, nodeId)
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

function handlePageKeydown(event: KeyboardEvent, pageId: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('selectPage', pageId)
    return
  }
  const pages = props.project.pageOrder.map(id => props.project.pagesById[id]!).filter(Boolean)
  const current = pages.findIndex(page => page.id === pageId)
  const next = navigationIndex(event, current, pages.length)
  if (next === undefined || next === current)
    return
  event.preventDefault()
  const nextId = pages[next]!.id
  emit('selectPage', nextId)
  focusItem(pageList.value, 'pageId', nextId)
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
    <div ref="layerTree" class="designer-layers" role="tree" :aria-label="locale.t('layer.tree', 'Page layers')">
      <div
        v-for="(layer, index) in layers"
        :key="layer.id"
        role="treeitem"
        :aria-level="layer.depth + 1"
        :aria-selected="selectedIds.includes(layer.id)"
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
        :data-layer-id="layer.id"
        :tabindex="selectedIds[0] === layer.id || (selectedIds.length === 0 && index === 0) ? 0 : -1"
        :class="{ 'is-selected': selectedIds.includes(layer.id) }"
        @keydown="handleLayerKeydown($event, layer.id)"
      >
        <ElButton text native-type="button" tabindex="-1" class="designer-layer-select" :style="{ paddingLeft: `${10 + layer.depth * 16}px` }" @click="selectLayer(layer.id, $event)">
          <Layers3 :size="13" aria-hidden="true" />
          <span>{{ layer.label }}</span>
        </ElButton>
        <div class="designer-layer-actions">
          <ElDropdown trigger="click" placement="bottom-end" :show-timeout="0" :hide-timeout="0" append-to="#workbench-overlays" @command="runLayerAction($event, layer.id)" @visible-change="restoreLayerMenuFocus($event, layer.id)">
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
                <ElDropdownItem command="moveBefore"><ChevronUp :size="14" aria-hidden="true" /><span>{{ locale.t('layer.moveUp', 'Move up') }}</span></ElDropdownItem>
                <ElDropdownItem command="moveAfter"><ChevronDown :size="14" aria-hidden="true" /><span>{{ locale.t('layer.moveDown', 'Move down') }}</span></ElDropdownItem>
                <ElDropdownItem command="indent"><IndentIncrease :size="14" aria-hidden="true" /><span>{{ locale.t('layer.indent', 'Indent') }}</span></ElDropdownItem>
                <ElDropdownItem command="outdent"><IndentDecrease :size="14" aria-hidden="true" /><span>{{ locale.t('layer.outdent', 'Outdent') }}</span></ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </div>
      <ElEmpty v-if="layers.length === 0" :description="locale.t('layer.empty', 'No layers yet')" :image-size="42" />
    </div>
    </ElScrollbar>

    <div v-else-if="activeView === 'pages'" class="designer-pages-panel">
      <ElScrollbar>
      <nav ref="pageList" class="designer-pages" role="listbox" :aria-label="locale.t('pages.project', 'Project pages')">
        <ElButton
          v-for="pageId in project.pageOrder"
          :key="pageId"
          text
          native-type="button"
          role="option"
          :aria-selected="pageId === currentPageId"
          :aria-current="pageId === currentPageId ? 'page' : undefined"
          :data-page-id="pageId"
          :tabindex="pageId === currentPageId ? 0 : -1"
          :class="{ 'is-current': pageId === currentPageId }"
          @click="emit('selectPage', pageId)"
          @keydown="handlePageKeydown($event, pageId)"
        >
          <Files :size="14" aria-hidden="true" />
          <span>{{ project.pagesById[pageId]?.name }}</span>
          <small>{{ project.pagesById[pageId]?.route }}</small>
        </ElButton>
      </nav>
      </ElScrollbar>
      <ElButton native-type="button" class="manage-pages-button" @click="emit('managePages')">
        <Settings2 :size="14" aria-hidden="true" />
        {{ locale.t('pages.manage', 'Manage pages') }}
      </ElButton>
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
