<script setup lang="ts">
import type { DesignerDropTarget } from '../history'
import type { DesignerFormSettings, DesignerNode } from '../document'
import type { ConfigFormBreakpoint } from '@moluoxixi/config-form/renderer'
import type { DesignerNodeAction } from './types'
import type { DesignerMaterialSlotDefinition, DesignerRegistry } from '../registry'
import type { StyleValue } from 'vue'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownLeft,
  CornerDownRight,
  GripVertical,
  Trash2,
} from '@lucide/vue'
import Sortable from 'sortablejs'
import { resolveConfigFormLayout } from '@moluoxixi/config-form/renderer'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDesignerLocale } from '../locale'
import { evaluateDesignerCondition } from '../condition'
import DesignerNodePreview from './DesignerNodePreview.vue'

defineOptions({ name: 'DesignerNodeList' })

const props = defineProps<{
  nodes: DesignerNode[]
  parentId: string | null
  slotName?: string
  registry: DesignerRegistry
  form?: DesignerFormSettings
  selectedId?: string
  readonly?: boolean
  breakpoint?: ConfigFormBreakpoint
  interactive?: boolean
  model?: Record<string, unknown>
}>()
const locale = useDesignerLocale()

const emit = defineEmits<{
  select: [nodeId: string]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
  updateField: [field: string, value: unknown]
}>()

const listRef = ref<HTMLElement>()
let sortable: Sortable | undefined

const resolvedLayout = computed(() => resolveConfigFormLayout(
  props.form?.columns,
  props.form?.fieldSpan,
  props.form?.responsive,
  props.breakpoint ?? 'desktop',
))
const formColumns = computed(() => resolvedLayout.value.columns)
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
  const configuredSpan = node.span ?? resolvedLayout.value.fieldSpan
  const span = Math.min(formColumns.value, Math.max(1, Math.floor(configuredSpan)))
  return { gridColumn: `span ${span} / span ${span}`, minWidth: 0 }
}

function isNodeVisible(node: DesignerNode): boolean {
  if (!props.interactive)
    return true
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

function targetFromElement(element: HTMLElement, index?: number): DesignerDropTarget | undefined {
  const parentId = element.dataset.parentId
  if (parentId === undefined)
    return undefined
  if (!parentId)
    return { parentId: null, index }
  const slot = element.dataset.slot
  return slot ? { parentId, slot, index } : undefined
}

function materialSlots(node: DesignerNode): DesignerMaterialSlotDefinition[] {
  const material = props.registry.getMaterial(node.material)
  return material?.kind === 'container' ? material.slots : []
}

function destroySortable(): void {
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
    animation: 120,
    draggable: '[data-designer-draggable]',
    forceFallback: true,
    group: {
      name: 'config-form-designer',
      pull: true,
      put: true,
    },
    dragoverBubble: false,
    handle: '[data-drag-handle]',
    onStart: () => setDragging(true),
    onAdd: ({ item, newIndex }) => {
      const materialKey = item.dataset.materialKey
      if (materialKey)
        emit('addMaterial', materialKey, localTarget(newIndex))
    },
    onEnd: ({ item, newIndex, to }) => {
      setDragging(false)
      const nodeId = item.dataset.nodeId
      const target = newIndex === undefined ? undefined : targetFromElement(to, newIndex)
      if (nodeId && target)
        emit('move', nodeId, target)
    },
  })
}

function handleKeydown(event: KeyboardEvent, nodeId: string): void {
  if (event.target !== event.currentTarget)
    return
  if (event.key === 'ArrowUp') {
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

watch(() => props.readonly, createSortable)
onMounted(createSortable)
onBeforeUnmount(destroySortable)
</script>

<template>
  <ol
    ref="listRef"
    class="mx-config-form-designer__node-list"
    :class="{ 'is-empty': nodes.length === 0, 'is-root': parentId === null }"
    :style="listStyle"
    :data-layout="parentId === null ? (form?.inline ? 'inline' : 'grid') : undefined"
    :data-parent-id="parentId ?? ''"
    :data-slot="slotName"
  >
    <li
      v-for="node in nodes"
      v-show="isNodeVisible(node)"
      :key="node.id"
      class="mx-config-form-designer__node"
      :class="{ 'is-selected': selectedId === node.id, 'is-container': node.kind === 'container' }"
      data-designer-draggable
      :data-node-id="node.id"
      :style="nodeStyle(node)"
    >
      <div
        class="mx-config-form-designer__node-header"
      >
        <span class="mx-config-form-designer__node-actions">
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
      </div>

      <div
        class="mx-config-form-designer__node-preview-shell"
        :class="{ 'is-container': node.kind === 'container' }"
        :data-focus-node-id="node.id"
        :aria-label="locale.t('node.select', 'Select {label}', { label: node.kind === 'field' ? (node.label || node.field) : (registry.getMaterial(node.material) ? locale.materialTitle(registry.getMaterial(node.material)!) : node.material) })"
        role="group"
        tabindex="0"
        @click.stop="emit('select', node.id)"
        @focus="emit('select', node.id)"
        @keydown="handleKeydown($event, node.id)"
      >
        <DesignerNodePreview
          :node="node"
          :registry="registry"
          :label-position="form?.labelPosition ?? 'left'"
          :readonly="form?.readonly"
          :interactive="interactive"
          :model="model"
          @update-field="forwardUpdateField"
        >
          <template v-for="slot in materialSlots(node)" #[slot.name]>
            <DesignerNodeList
              :nodes="node.kind === 'container' ? (node.slots[slot.name] ?? []) : []"
              :parent-id="node.id"
              :slot-name="slot.name"
              :registry="registry"
              :form="form"
              :selected-id="selectedId"
              :readonly="readonly"
              :breakpoint="breakpoint"
              :interactive="interactive"
              :model="model"
              @select="emit('select', $event)"
              @move="forwardMove"
              @add-material="forwardAddMaterial"
              @action="forwardAction"
              @update-field="forwardUpdateField"
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
    <li v-if="nodes.length === 0" class="mx-config-form-designer__empty-slot" aria-hidden="true">
      <span class="mx-config-form-designer__empty-slot-icon">+</span>
    </li>
  </ol>
</template>
