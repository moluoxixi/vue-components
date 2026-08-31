<script setup lang="ts">
import type {
  DesignerLocaleOptions,
  DesignerMaterialDefinition,
  DesignerRegistry,
  DesignerSelectionMode,
} from '@moluoxixi/config-form-designer'
import type { FormSettings, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { CSSProperties } from 'vue'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { Blocks, ChevronDown, ChevronUp, Files, IndentDecrease, IndentIncrease, Layers3, MoreHorizontal, Settings2 } from '@lucide/vue'
import { createDesignerLocale, DesignerPalette } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'

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
  project: ReadonlyProjectDocument
  currentPageId: string
  form: FormSettings
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
const layerMenuId = useId()
const layerMenuNodeId = ref<string>()
const layerMenuStyle = ref<CSSProperties>()
let stopLayerMenuPositioning: (() => void) | undefined
const locale = computed(() => createDesignerLocale(props.locale))
const views = computed(() => [
  { icon: Blocks, id: 'components' as const, label: locale.value.t('designer.view.components', 'Components') },
  { icon: Layers3, id: 'layers' as const, label: locale.value.t('designer.view.layers', 'Layers') },
  { icon: Files, id: 'pages' as const, label: locale.value.t('designer.view.pages', 'Pages') },
])

function selectView(view: StudioLeftView): void {
  closeLayerMenu()
  internalActiveView.value = view
  emit('update:activeView', view)
}

function layerMenuElement(): HTMLElement | undefined {
  return layerTree.value?.querySelector<HTMLElement>('[data-layer-action-menu]') ?? undefined
}

function layerMenuTrigger(nodeId: string): HTMLButtonElement | undefined {
  return [...(layerTree.value?.querySelectorAll<HTMLButtonElement>('[data-layer-menu-trigger]') ?? [])]
    .find(element => element.dataset.layerMenuTrigger === nodeId)
}

function closeLayerMenu(restoreFocus = false): void {
  const nodeId = layerMenuNodeId.value
  if (!nodeId)
    return
  stopLayerMenuPositioning?.()
  stopLayerMenuPositioning = undefined
  layerMenuStyle.value = undefined
  layerMenuNodeId.value = undefined
  if (restoreFocus)
    void nextTick(() => layerMenuTrigger(nodeId)?.focus())
}

async function toggleLayerMenu(nodeId: string): Promise<void> {
  if (layerMenuNodeId.value === nodeId) {
    closeLayerMenu(true)
    return
  }
  layerMenuNodeId.value = nodeId
  await nextTick()
  const trigger = layerMenuTrigger(nodeId)
  const menu = layerMenuElement()
  if (!trigger || !menu) {
    closeLayerMenu()
    return
  }
  const updatePosition = (): void => {
    void computePosition(trigger, menu, {
      middleware: [offset(4), flip({ fallbackPlacements: ['top-end'] }), shift({ padding: 8 })],
      placement: 'bottom-end',
      strategy: 'fixed',
    }).then(({ x, y }) => {
      if (layerMenuNodeId.value !== nodeId)
        return
      layerMenuStyle.value = {
        left: `${x}px`,
        position: 'fixed',
        top: `${y}px`,
      }
    })
  }
  stopLayerMenuPositioning?.()
  stopLayerMenuPositioning = autoUpdate(trigger, menu, updatePosition)
  updatePosition()
  menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
}

function runLayerAction(action: StudioLayerAction, nodeId: string): void {
  closeLayerMenu()
  emit('arrangeLayer', action, nodeId)
  void nextTick(() => layerMenuTrigger(nodeId)?.focus())
}

function handleLayerMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeLayerMenu(true)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
    return
  const menu = event.currentTarget as HTMLElement
  const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
  if (items.length === 0)
    return
  event.preventDefault()
  const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? items.length - 1
      : event.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length
  items[next]?.focus()
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!layerMenuNodeId.value || !(event.target instanceof Node))
    return
  const nodeId = layerMenuNodeId.value
  if (layerMenuElement()?.contains(event.target) || layerMenuTrigger(nodeId)?.contains(event.target))
    return
  closeLayerMenu()
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

watch(() => props.layers, (layers) => {
  if (layerMenuNodeId.value && !layers.some(layer => layer.id === layerMenuNodeId.value))
    closeLayerMenu()
})

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown))
onBeforeUnmount(() => {
  stopLayerMenuPositioning?.()
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
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
        <button type="button" tabindex="-1" class="designer-layer-select" :style="{ paddingLeft: `${10 + layer.depth * 16}px` }" @click="selectLayer(layer.id, $event)">
          <Layers3 :size="13" aria-hidden="true" />
          <span>{{ layer.label }}</span>
        </button>
        <div class="designer-layer-actions">
          <button
            :id="`${layerMenuId}-${index}-trigger`"
            type="button"
            class="designer-layer-menu-trigger"
            :data-layer-menu-trigger="layer.id"
            :tabindex="selectedIds.includes(layer.id) ? 0 : -1"
            :title="locale.t('workbench.moreActions', 'More actions')"
            :aria-label="locale.t('layer.arrange', 'Arrange {name}', { name: layer.label })"
            aria-haspopup="menu"
            :aria-controls="layerMenuId"
            :aria-expanded="layerMenuNodeId === layer.id"
            @click.stop="toggleLayerMenu(layer.id)"
          >
            <MoreHorizontal :size="14" aria-hidden="true" />
          </button>
          <div
            v-if="layerMenuNodeId === layer.id"
            :id="layerMenuId"
            class="designer-layer-menu"
            data-layer-action-menu
            role="menu"
            :style="layerMenuStyle"
            :aria-labelledby="`${layerMenuId}-${index}-trigger`"
            @keydown="handleLayerMenuKeydown"
          >
            <button type="button" role="menuitem" tabindex="-1" @click.stop="runLayerAction('moveBefore', layer.id)"><ChevronUp :size="14" aria-hidden="true" /><span>{{ locale.t('layer.moveUp', 'Move up') }}</span></button>
            <button type="button" role="menuitem" tabindex="-1" @click.stop="runLayerAction('moveAfter', layer.id)"><ChevronDown :size="14" aria-hidden="true" /><span>{{ locale.t('layer.moveDown', 'Move down') }}</span></button>
            <button type="button" role="menuitem" tabindex="-1" @click.stop="runLayerAction('indent', layer.id)"><IndentIncrease :size="14" aria-hidden="true" /><span>{{ locale.t('layer.indent', 'Indent') }}</span></button>
            <button type="button" role="menuitem" tabindex="-1" @click.stop="runLayerAction('outdent', layer.id)"><IndentDecrease :size="14" aria-hidden="true" /><span>{{ locale.t('layer.outdent', 'Outdent') }}</span></button>
          </div>
        </div>
      </div>
      <p v-if="layers.length === 0">{{ locale.t('layer.empty', 'No layers yet') }}</p>
    </div>

    <div v-else class="designer-pages-panel">
      <nav ref="pageList" class="designer-pages" role="listbox" :aria-label="locale.t('pages.project', 'Project pages')">
        <button
          v-for="pageId in project.pageOrder"
          :key="pageId"
          type="button"
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
        </button>
      </nav>
      <button type="button" class="manage-pages-button" @click="emit('managePages')">
        <Settings2 :size="14" aria-hidden="true" />
        {{ locale.t('pages.manage', 'Manage pages') }}
      </button>
    </div>
  </div>
</template>
