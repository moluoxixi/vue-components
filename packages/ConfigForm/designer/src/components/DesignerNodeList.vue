<script setup lang="ts">
import type { DesignerDropTarget } from '../history'
import type { DesignerFormSettings, DesignerNode } from '../document'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerNodeAction } from './types'
import type { DesignerSelectionMode } from '../composables'
import type { DesignerMaterialSlotDefinition, DesignerRegistry } from '../registry'
import type { StyleValue } from 'vue'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownLeft,
  CornerDownRight,
  GripVertical,
  Plus,
  Trash2,
} from '@lucide/vue'
import Sortable from 'sortablejs'
import { resolveConfigFormLayout, resolveConfigFormNodeSpan } from '@moluoxixi/config-form/renderer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDesignerLocale } from '../locale'
import { evaluateDesignerCondition } from '../condition'
import DesignerNodePreview from './DesignerNodePreview.vue'

defineOptions({ name: 'DesignerNodeList' })

const props = defineProps<{
  nodes: DesignerNode[]
  parentId: string | null
  slotName?: string
  parentMaterial?: string
  registry: DesignerRegistry
  form?: DesignerFormSettings
  selectedId?: string
  selectedIds?: string[]
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
  interactive?: boolean
  model?: Record<string, unknown>
  reactionProps?: ConfigFormReactionProjection['props']
  reactionStates?: ConfigFormReactionProjection['states']
}>()
const locale = useDesignerLocale()

const emit = defineEmits<{
  select: [nodeId: string, mode?: DesignerSelectionMode]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
  updateField: [field: string, value: unknown]
  resize: [nodeId: string, span: number]
}>()

const listRef = ref<HTMLElement>()
const resizeDrafts = ref<Record<string, number>>({})
let sortable: Sortable | undefined
let resizeCleanup: (() => void) | undefined
let pendingPointerSelection: { nodeId: string, startedAt: number } | undefined

const designerDraggableSelector = '[data-designer-draggable]'
const sortableDraggableSelector = `> ${designerDraggableSelector}`
const designerDropTailSelector = '[data-designer-drop-tail]'

const resolvedLayout = computed(() => resolveConfigFormLayout(
  props.form?.columns,
  props.form?.fieldSpan,
  props.form?.responsive,
  props.breakpoint ?? 'desktop',
))
const formColumns = computed(() => resolvedLayout.value.columns)
const isRootGrid = computed(() => props.parentId === null && !props.form?.inline)
const listStyle = computed<StyleValue | undefined>(() => {
  if (props.parentId !== null)
    return undefined
  if (props.form?.inline) {
    return {
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: props.form.gap ?? '16px',
    }
  }
  return {
    display: 'grid',
    gap: props.form?.gap ?? '16px',
    gridTemplateColumns: `repeat(${formColumns.value}, minmax(0, 1fr))`,
  }
})

function nodeStyle(node: DesignerNode): StyleValue | undefined {
  if (props.parentId !== null)
    return undefined
  if (props.form?.inline)
    return { flex: '0 1 auto', minWidth: 0 }
  const span = resizeDrafts.value[node.id] ?? resolveConfigFormNodeSpan(node.span, resolvedLayout.value)
  return { gridColumn: `span ${span} / span ${span}`, minWidth: 0 }
}

function nodeSpan(node: DesignerNode): number | undefined {
  return isRootGrid.value
    ? resolveConfigFormNodeSpan(node.span, resolvedLayout.value)
    : undefined
}

function isNodeVisible(node: DesignerNode): boolean {
  if (node.kind === 'field' && props.reactionStates?.[node.field]?.visible !== undefined)
    return props.reactionStates[node.field]!.visible!
  const values = props.model ?? {}
  const visible = node.conditions?.visible
    ? evaluateDesignerCondition(node.conditions.visible, values)
    : true
  const hidden = node.conditions?.hidden
    ? evaluateDesignerCondition(node.conditions.hidden, values)
    : false
  return visible && !hidden
}

function localTarget(index?: number): DesignerDropTarget {
  return props.parentId === null
    ? { parentId: null, index }
    : { parentId: props.parentId, slot: props.slotName!, index }
}

function targetListFromElement(element: HTMLElement | null | undefined): HTMLElement | undefined {
  if (!element)
    return undefined
  return element.matches('[data-parent-id]')
    ? element
    : element.closest<HTMLElement>('[data-parent-id]') ?? undefined
}

function resolveListIndex(list: HTMLElement | null | undefined, item?: HTMLElement, fallback?: number): number | undefined {
  if (!list)
    return fallback

  const children = [...list.children]
  const isDraggable = (child: Element): boolean => child.matches(designerDraggableSelector)
  const itemIndex = item ? children.indexOf(item) : -1
  const tailIndex = children.findIndex(child => child.matches(designerDropTailSelector))
  if (itemIndex >= 0) {
    // Sortable's test/fallback events can report a newIndex before it has
    // physically reordered the item. Prefer that index only while the item
    // is still before the trailing sentinel; once it crossed the sentinel,
    // the number of real nodes before it is the append index we need.
    if (fallback !== undefined && (tailIndex < 0 || itemIndex < tailIndex) && fallback !== itemIndex) {
      const maxIndex = children.filter(isDraggable).length - (item && isDraggable(item) ? 1 : 0)
      return Math.min(Math.max(fallback, 0), maxIndex)
    }
    return children.slice(0, itemIndex).filter(isDraggable).length
  }

  if (tailIndex >= 0)
    return children.slice(0, tailIndex).filter(isDraggable).length

  const count = children.filter(isDraggable).length
  return fallback === undefined ? count : Math.min(Math.max(fallback, 0), count)
}

function targetFromElement(element: HTMLElement | null | undefined, item?: HTMLElement, index?: number): DesignerDropTarget | undefined {
  const targetList = targetListFromElement(element)
  if (!targetList)
    return undefined
  const parentId = targetList.dataset.parentId
  const resolvedIndex = resolveListIndex(targetList, item, index)
  if (parentId === undefined)
    return undefined
  if (!parentId)
    return { parentId: null, index: resolvedIndex }
  const slot = targetList.dataset.slot
  return slot ? { parentId, slot, index: resolvedIndex } : undefined
}

/**
 * Nested lists are rendered inside a container node. Sortable walks up from
 * the pointer target when resolving `draggable`, so a parent list can see a
 * child-list item while the pointer is over a deeply nested slot. Keep each
 * instance scoped to its direct children and reject parent-list dragovers
 * whose original target belongs to a descendant list.
 */
function isNestedDragOver(list: HTMLElement, originalTarget: EventTarget | null | undefined): boolean {
  if (!(originalTarget instanceof HTMLElement))
    return false
  const nestedList = originalTarget.closest<HTMLElement>('[data-parent-id]')
  return Boolean(nestedList && nestedList !== list && list.contains(nestedList))
}

function isDirectListTarget(list: HTMLElement, related: Element | null | undefined): boolean {
  if (!related)
    return true
  return related.parentElement === list || related.matches(designerDropTailSelector)
}

function materialSlots(node: DesignerNode): DesignerMaterialSlotDefinition[] {
  const material = props.registry.getMaterial(node.material)
  return material?.kind === 'container' ? material.slots : []
}

function destroySortable(): void {
  setDragging(false)
  sortable?.destroy()
  sortable = undefined
}

function setDragging(active: boolean): void {
  listRef.value?.closest<HTMLElement>('.mx-config-form-designer')?.classList.toggle('is-dragging', active)
}

async function createSortable(): Promise<void> {
  destroySortable()
  if (props.readonly)
    return
  await nextTick()
  if (!listRef.value || props.readonly)
    return
  sortable = Sortable.create(listRef.value, {
    animation: 180,
    // `>` is important here: nested DesignerNodeList instances live inside
    // the parent node's `<li>` and must not be treated as parent siblings.
    draggable: sortableDraggableSelector,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    forceFallback: true,
    group: {
      name: 'config-form-designer',
      pull: true,
      put: true,
    },
    dragoverBubble: false,
    handle: '[data-drag-handle]',
    onMove: (event) => {
      const list = listRef.value
      if (!list || event.to !== list)
        return false
      const originalEvent = (event as unknown as { originalEvent?: Event }).originalEvent
      if (isNestedDragOver(list, originalEvent?.target))
        return false
      return isDirectListTarget(list, event.related)
    },
    onStart: () => setDragging(true),
    onAdd: ({ item, newIndex }) => {
      const materialKey = item.dataset.materialKey
      if (materialKey) {
        const target = localTarget(resolveListIndex(listRef.value, item, newIndex))
        emit('addMaterial', materialKey, target)
      }
    },
    onEnd: ({ item, newIndex, to }) => {
      setDragging(false)
      const nodeId = item.dataset.nodeId
      const target = targetFromElement(to, item, newIndex)
      if (nodeId && target)
        emit('move', nodeId, target)
    },
  })
}

function handleKeydown(event: KeyboardEvent, nodeId: string): void {
  if (event.target !== event.currentTarget)
    return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('select', nodeId, event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'replace')
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

function handleSelect(event: MouseEvent, nodeId: string): void {
  if (pendingPointerSelection?.nodeId === nodeId)
    pendingPointerSelection = undefined
  emit('select', nodeId, event.shiftKey ? 'range' : (event.ctrlKey || event.metaKey) ? 'toggle' : 'replace')
}

function preparePointerSelection(nodeId: string): void {
  pendingPointerSelection = { nodeId, startedAt: performance.now() }
}

function handleFocus(nodeId: string): void {
  const pointerFocus = pendingPointerSelection?.nodeId === nodeId
    && performance.now() - pendingPointerSelection.startedAt < 500
  if (!pointerFocus)
    emit('select', nodeId, 'replace')
}

function beginResize(event: PointerEvent, node: DesignerNode): void {
  if (props.readonly || !isRootGrid.value)
    return
  event.preventDefault()
  event.stopPropagation()
  resizeCleanup?.()
  const startX = event.clientX
  const startSpan = resolveConfigFormNodeSpan(node.span, resolvedLayout.value)
  const width = listRef.value?.getBoundingClientRect().width ?? 1
  const columns = formColumns.value
  const pointerId = event.pointerId
  const move = (moveEvent: PointerEvent): void => {
    const delta = Math.round((moveEvent.clientX - startX) / width * columns)
    resizeDrafts.value = { ...resizeDrafts.value, [node.id]: Math.min(columns, Math.max(1, startSpan + delta)) }
  }
  const finish = (finishEvent: PointerEvent): void => {
    if (finishEvent.pointerId !== pointerId)
      return
    const span = resizeDrafts.value[node.id] ?? startSpan
    resizeCleanup?.()
    if (span !== startSpan)
      emit('resize', node.id, span)
  }
  const cancel = (): void => resizeCleanup?.()
  resizeCleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    const next = { ...resizeDrafts.value }
    delete next[node.id]
    resizeDrafts.value = next
    resizeCleanup = undefined
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
}

function forwardMove(nodeId: string, target: DesignerDropTarget): void {
  emit('move', nodeId, target)
}

function forwardAddMaterial(materialKey: string, target: DesignerDropTarget): void {
  emit('addMaterial', materialKey, target)
}

function forwardAction(action: DesignerNodeAction, nodeId: string): void {
  emit('action', action, nodeId)
}

function forwardUpdateField(field: string, value: unknown): void {
  emit('updateField', field, value)
}

function forwardSelect(nodeId: string, mode?: DesignerSelectionMode): void {
  emit('select', nodeId, mode)
}

function forwardResize(nodeId: string, span: number): void {
  emit('resize', nodeId, span)
}

watch(() => props.readonly, createSortable)
onMounted(createSortable)
onBeforeUnmount(() => {
  destroySortable()
  resizeCleanup?.()
})
</script>

<template>
  <ol
    ref="listRef"
    class="mx-config-form-designer__node-list"
    :class="[
      { 'is-empty': nodes.length === 0, 'is-nested': parentId !== null, 'is-root': parentId === null },
      parentId === null ? `${registry.rendererNamespace}__row` : undefined,
      parentId === null ? `${registry.rendererNamespace}__row--${form?.inline ? 'inline' : 'grid'}` : undefined,
    ]"
    :style="listStyle"
    :data-layout="parentId === null ? (form?.inline ? 'inline' : 'grid') : undefined"
    :data-parent-id="parentId ?? ''"
    :data-parent-material="parentMaterial"
    :data-slot="slotName"
  >
    <li
      v-for="node in nodes"
      v-show="isNodeVisible(node)"
      :key="node.id"
      class="mx-config-form-designer__node"
      :class="[
        {
          'is-selected': (selectedIds ?? (selectedId ? [selectedId] : [])).includes(node.id),
          'is-primary': selectedId === node.id,
          'is-container': node.kind === 'container',
        },
        isRootGrid ? `${registry.rendererNamespace}__cell` : undefined,
      ]"
      data-designer-draggable
      :data-designer-grid-cell="isRootGrid ? '' : undefined"
      :data-material="node.material"
      :data-node-kind="node.kind"
      :data-node-id="node.id"
      :data-designer-span="nodeSpan(node)"
      :style="nodeStyle(node)"
    >
      <span v-if="selectedId === node.id" class="mx-config-form-designer__node-actions">
          <button
            type="button"
            class="mx-config-form-designer__icon-button mx-config-form-designer__drag-handle"
            data-drag-handle
            :disabled="readonly"
            :title="locale.t('node.move', 'Move')"
            :aria-label="locale.t('node.moveNode', 'Move node')"
          >
            <GripVertical :size="16" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.moveUp', 'Move up')" :aria-label="locale.t('node.moveNodeUp', 'Move node up')" @click.stop="emit('action', 'moveBefore', node.id)">
            <ChevronUp :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.moveDown', 'Move down')" :aria-label="locale.t('node.moveNodeDown', 'Move node down')" @click.stop="emit('action', 'moveAfter', node.id)">
            <ChevronDown :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.indent', 'Indent')" :aria-label="locale.t('node.indentNode', 'Move node into previous container')" @click.stop="emit('action', 'indent', node.id)">
            <CornerDownRight :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.outdent', 'Outdent')" :aria-label="locale.t('node.outdentNode', 'Move node out of container')" @click.stop="emit('action', 'outdent', node.id)">
            <CornerDownLeft :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" :title="locale.t('node.copy', 'Copy')" :aria-label="locale.t('node.copyNode', 'Copy node')" @click.stop="emit('action', 'copy', node.id)">
            <Copy :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button is-danger" :disabled="readonly" :title="locale.t('node.delete', 'Delete')" :aria-label="locale.t('node.deleteNode', 'Delete node')" @click.stop="emit('action', 'remove', node.id)">
            <Trash2 :size="15" aria-hidden="true" />
          </button>
      </span>

      <button
        v-if="selectedId === node.id && isRootGrid && !readonly"
        type="button"
        class="mx-config-form-designer__resize-handle"
        :aria-label="locale.t('node.resize', 'Resize node')"
        :title="locale.t('node.resize', 'Resize node')"
        @pointerdown="beginResize($event, node)"
        @click.stop
      />

      <div
        class="mx-config-form-designer__node-preview-shell"
        :class="{ 'is-container': node.kind === 'container' }"
        :data-focus-node-id="node.id"
        :aria-label="locale.t('node.select', 'Select {label}', { label: node.kind === 'field' ? (node.label || node.field) : (registry.getMaterial(node.material) ? locale.materialTitle(registry.getMaterial(node.material)!) : node.material) })"
        role="group"
        tabindex="0"
        @pointerdown.capture="preparePointerSelection(node.id)"
        @click.stop="handleSelect($event, node.id)"
        @focus="handleFocus(node.id)"
        @keydown="handleKeydown($event, node.id)"
      >
        <DesignerNodePreview
          :node="node"
          :registry="registry"
          :label-position="form?.labelPosition ?? 'left'"
          :readonly="form?.readonly"
          :interactive="interactive"
          :model="model"
          :reaction-props="reactionProps"
          :reaction-states="reactionStates"
          @update-field="forwardUpdateField"
        >
          <template v-for="slot in materialSlots(node)" #[slot.name]>
            <DesignerNodeList
              :nodes="node.kind === 'container' ? (node.slots[slot.name] ?? []) : []"
              :parent-id="node.id"
              :parent-material="node.material"
              :slot-name="slot.name"
              :registry="registry"
              :form="form"
              :selected-id="selectedId"
              :selected-ids="selectedIds"
              :readonly="readonly"
              :breakpoint="breakpoint"
              :interactive="interactive"
              :model="model"
              :reaction-props="reactionProps"
              :reaction-states="reactionStates"
              @select="forwardSelect"
              @move="forwardMove"
              @add-material="forwardAddMaterial"
              @action="forwardAction"
              @update-field="forwardUpdateField"
              @resize="forwardResize"
            />
          </template>
        </DesignerNodePreview>
      </div>

      <div v-if="node.kind === 'container'" class="mx-config-form-designer__container-slots" aria-hidden="true">
        <template v-for="slot in materialSlots(node)" :key="slot.name">
          <span class="mx-config-form-designer__slot-marker" :title="locale.materialSlotTitle(registry.getMaterial(node.material)!, slot.name, slot.title)" />
        </template>
      </div>
    </li>
    <li v-if="nodes.length === 0" class="mx-config-form-designer__empty-slot">
      <span class="mx-config-form-designer__empty-slot-icon">
        <Plus :size="14" aria-hidden="true" />
      </span>

      <span class="mx-config-form-designer__empty-slot-label">
        {{ locale.t('canvas.dropHere', 'Drop a field here') }}
      </span>
    </li>
    <li
      v-else
      class="mx-config-form-designer__drop-tail"
      data-designer-drop-tail
      aria-hidden="true"
      role="presentation"
    />
  </ol>
</template>
