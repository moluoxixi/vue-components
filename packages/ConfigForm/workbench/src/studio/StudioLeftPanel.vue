<script setup lang="ts">
import type {
  DesignerDocument,
  DesignerLocaleOptions,
  DesignerMaterialDefinition,
  DesignerRegistry,
  DesignerSelectionMode,
} from '@moluoxixi/config-form-designer'
import type { WorkspaceApplication } from '../project'
import { Blocks, ChevronDown, ChevronUp, Files, IndentDecrease, IndentIncrease, Layers3, Settings2 } from '@lucide/vue'
import { createDesignerLocale, DesignerPalette } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, useTemplateRef } from 'vue'

export type StudioLeftView = 'components' | 'layers' | 'pages'
export type StudioLayerAction = 'moveBefore' | 'moveAfter' | 'indent' | 'outdent'

export interface StudioLayerEntry {
  component: string
  depth: number
  id: string
  label: string
}

const props = defineProps<{
  activeView?: StudioLeftView
  application: WorkspaceApplication
  currentPageId: string
  form: DesignerDocument['form']
  layers: StudioLayerEntry[]
  locale?: DesignerLocaleOptions
  materials: DesignerMaterialDefinition[]
  readonly?: boolean
  registry: DesignerRegistry
  selectedIds: string[]
}>()

const emit = defineEmits<{
  addMaterial: [materialKey: string]
  arrangeLayer: [action: StudioLayerAction, nodeId: string]
  managePages: []
  selectLayer: [nodeId: string, mode: DesignerSelectionMode]
  selectPage: [pageId: string]
  'update:activeView': [view: StudioLeftView]
}>()

const internalActiveView = ref<StudioLeftView>('components')
const activeView = computed(() => props.activeView ?? internalActiveView.value)
const tabs = useTemplateRef<HTMLElement>('tabs')
const layerTree = useTemplateRef<HTMLElement>('layerTree')
const pageList = useTemplateRef<HTMLElement>('pageList')
const locale = computed(() => createDesignerLocale(props.locale))
const views = computed(() => [
  { icon: Blocks, id: 'components' as const, label: locale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: locale.value.t('designer.view.layers', 'Layers') },
  { icon: Files, id: 'pages' as const, label: locale.value.t('designer.view.pages', 'Pages') },
])

function selectView(view: StudioLeftView): void {
  internalActiveView.value = view
  emit('update:activeView', view)
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
  const current = props.application.pages.findIndex(page => page.id === pageId)
  const next = navigationIndex(event, current, props.application.pages.length)
  if (next === undefined || next === current)
    return
  event.preventDefault()
  const nextId = props.application.pages[next]!.id
  emit('selectPage', nextId)
  focusItem(pageList.value, 'pageId', nextId)
}

function handleTabKeydown(event: KeyboardEvent, view: StudioLeftView): void {
  const ids = views.value.map(item => item.id)
  const index = ids.indexOf(view)
  let nextIndex = index
  if (event.key === 'ArrowRight')
    nextIndex = (index + 1) % ids.length
  else if (event.key === 'ArrowLeft')
    nextIndex = (index - 1 + ids.length) % ids.length
  else if (event.key === 'Home')
    nextIndex = 0
  else if (event.key === 'End')
    nextIndex = ids.length - 1
  else
    return
  event.preventDefault()
  selectView(ids[nextIndex]!)
  void nextTick(() => tabs.value
    ?.querySelector<HTMLButtonElement>(`[data-designer-left-tab="${activeView.value}"]`)
    ?.focus())
}
</script>

<template>
  <div class="designer-left-panel">
    <nav ref="tabs" class="designer-left-tabs" role="tablist" :aria-label="locale.t('designer.navigation', 'Designer navigation')">
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        role="tab"
        :aria-selected="activeView === view.id"
        :data-designer-left-tab="view.id"
        :tabindex="activeView === view.id ? 0 : -1"
        :title="view.label"
        @click="selectView(view.id)"
        @keydown="handleTabKeydown($event, view.id)"
      >
        <component :is="view.icon" :size="14" aria-hidden="true" />
        <span>{{ view.label }}</span>
      </button>
    </nav>

    <DesignerPalette
      v-if="activeView === 'components'"
      :materials="materials"
      :form="form"
      :registry="registry"
      :readonly="readonly"
      @add-material="emit('addMaterial', $event)"
    />

    <div v-else-if="activeView === 'layers'" ref="layerTree" class="designer-layers" role="tree" :aria-label="locale.t('layer.tree', 'Page layers')">
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
        <button type="button" class="designer-layer-select" :style="{ paddingLeft: `${10 + layer.depth * 16}px` }" @click="selectLayer(layer.id, $event)">
          <Layers3 :size="13" aria-hidden="true" />
          <span>{{ layer.label }}</span>
          <small>{{ layer.component }}</small>
        </button>
        <div class="designer-layer-actions" role="toolbar" :aria-label="locale.t('layer.arrange', 'Arrange {name}', { name: layer.label })">
          <button type="button" :title="locale.t('layer.moveUp', 'Move up')" :aria-label="locale.t('layer.moveUp', 'Move up')" @click="emit('arrangeLayer', 'moveBefore', layer.id)"><ChevronUp :size="12" aria-hidden="true" /></button>
          <button type="button" :title="locale.t('layer.moveDown', 'Move down')" :aria-label="locale.t('layer.moveDown', 'Move down')" @click="emit('arrangeLayer', 'moveAfter', layer.id)"><ChevronDown :size="12" aria-hidden="true" /></button>
          <button type="button" :title="locale.t('layer.indent', 'Indent')" :aria-label="locale.t('layer.indent', 'Indent')" @click="emit('arrangeLayer', 'indent', layer.id)"><IndentIncrease :size="12" aria-hidden="true" /></button>
          <button type="button" :title="locale.t('layer.outdent', 'Outdent')" :aria-label="locale.t('layer.outdent', 'Outdent')" @click="emit('arrangeLayer', 'outdent', layer.id)"><IndentDecrease :size="12" aria-hidden="true" /></button>
        </div>
      </div>
      <p v-if="layers.length === 0">{{ locale.t('layer.empty', 'No layers yet') }}</p>
    </div>

    <div v-else class="designer-pages-panel">
      <nav ref="pageList" class="designer-pages" role="listbox" :aria-label="locale.t('pages.application', 'Application pages')">
        <button
          v-for="page in application.pages"
          :key="page.id"
          type="button"
          role="option"
          :aria-selected="page.id === currentPageId"
          :aria-current="page.id === currentPageId ? 'page' : undefined"
          :data-page-id="page.id"
          :tabindex="page.id === currentPageId ? 0 : -1"
          :class="{ 'is-current': page.id === currentPageId }"
          @click="emit('selectPage', page.id)"
          @keydown="handlePageKeydown($event, page.id)"
        >
          <Files :size="14" aria-hidden="true" />
          <span>{{ page.name }}</span>
          <small>{{ page.route }}</small>
        </button>
      </nav>
      <button type="button" class="manage-pages-button" @click="emit('managePages')">
        <Settings2 :size="14" aria-hidden="true" />
        {{ locale.t('pages.manage', 'Manage pages') }}
      </button>
    </div>
  </div>
</template>
