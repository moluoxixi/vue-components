<script setup lang="ts">
import type { DesignerDropTarget } from '../history'
import type { DesignerNode } from '../document'
import type { DesignerNodeAction } from './types'
import type { DesignerMaterialSlotDefinition, DesignerRegistry } from '../registry'
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
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

defineOptions({ name: 'DesignerNodeList' })

const props = defineProps<{
  nodes: DesignerNode[]
  parentId: string | null
  slotName?: string
  registry: DesignerRegistry
  selectedId?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  move: [nodeId: string, target: DesignerDropTarget]
  addMaterial: [materialKey: string, target: DesignerDropTarget]
  action: [action: DesignerNodeAction, nodeId: string]
}>()

const listRef = ref<HTMLElement>()
let sortable: Sortable | undefined

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
    handle: '[data-drag-handle]',
    onAdd: ({ item, newIndex }) => {
      const materialKey = item.dataset.materialKey
      if (materialKey)
        emit('addMaterial', materialKey, localTarget(newIndex))
    },
    onEnd: ({ item, newIndex, to }) => {
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

watch(() => props.readonly, createSortable)
onMounted(createSortable)
onBeforeUnmount(destroySortable)
</script>

<template>
  <ol
    ref="listRef"
    class="mx-config-form-designer__node-list"
    :class="{ 'is-empty': nodes.length === 0 }"
    :data-parent-id="parentId ?? ''"
    :data-slot="slotName"
  >
    <li
      v-for="node in nodes"
      :key="node.id"
      class="mx-config-form-designer__node"
      :class="{ 'is-selected': selectedId === node.id, 'is-container': node.kind === 'container' }"
      data-designer-draggable
      :data-node-id="node.id"
    >
      <div
        class="mx-config-form-designer__node-header"
      >
        <button
          type="button"
          class="mx-config-form-designer__icon-button mx-config-form-designer__drag-handle"
          data-drag-handle
          :disabled="readonly"
          title="Move"
          aria-label="Move node"
        >
          <GripVertical :size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="mx-config-form-designer__node-select"
          :data-focus-node-id="node.id"
          :aria-pressed="selectedId === node.id"
          @click.stop="emit('select', node.id)"
          @focus="emit('select', node.id)"
          @keydown="handleKeydown($event, node.id)"
        >
          <span class="mx-config-form-designer__node-title">
            {{ node.kind === 'field' ? (node.label || node.field) : registry.getMaterial(node.material)?.title }}
          </span>
          <code v-if="node.kind === 'field'">{{ node.field }}</code>
        </button>
        <span class="mx-config-form-designer__node-actions">
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" title="Move up" aria-label="Move node up" @click.stop="emit('action', 'moveBefore', node.id)">
            <ChevronUp :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" title="Move down" aria-label="Move node down" @click.stop="emit('action', 'moveAfter', node.id)">
            <ChevronDown :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" title="Indent" aria-label="Move node into previous container" @click.stop="emit('action', 'indent', node.id)">
            <CornerDownRight :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" title="Outdent" aria-label="Move node out of container" @click.stop="emit('action', 'outdent', node.id)">
            <CornerDownLeft :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button" :disabled="readonly" title="Copy" aria-label="Copy node" @click.stop="emit('action', 'copy', node.id)">
            <Copy :size="15" aria-hidden="true" />
          </button>
          <button type="button" class="mx-config-form-designer__icon-button is-danger" :disabled="readonly" title="Delete" aria-label="Delete node" @click.stop="emit('action', 'remove', node.id)">
            <Trash2 :size="15" aria-hidden="true" />
          </button>
        </span>
      </div>

      <div v-if="node.kind === 'container'" class="mx-config-form-designer__container-slots">
        <section
          v-for="slot in materialSlots(node)"
          :key="slot.name"
          class="mx-config-form-designer__slot"
        >
          <h3>{{ slot.title }}</h3>
          <DesignerNodeList
            :nodes="node.slots[slot.name] ?? []"
            :parent-id="node.id"
            :slot-name="slot.name"
            :registry="registry"
            :selected-id="selectedId"
            :readonly="readonly"
            @select="emit('select', $event)"
            @move="forwardMove"
            @add-material="forwardAddMaterial"
            @action="forwardAction"
          />
        </section>
      </div>
    </li>
    <li v-if="nodes.length === 0" class="mx-config-form-designer__empty-slot" aria-hidden="true">Empty</li>
  </ol>
</template>
