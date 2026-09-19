<script setup lang="ts">
import type { SourceFileTreeEmits, SourceFileTreeProps, SourceTreeNode } from '../../types'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  collectSourceDirectoryIds,
  directoryIdsForPath,
  flattenVisibleSourceTree,
} from '../../services'
import { SourceFileTreeNode } from './components'

const props = defineProps<SourceFileTreeProps>()
const emit = defineEmits<SourceFileTreeEmits>()

const rootRef = ref<HTMLElement>()
const expandedIds = ref<Set<string>>(new Set())
const knownDirectoryIds = ref<Set<string>>(new Set())
const focusedId = ref<string>()
const visibleNodes = computed(() => flattenVisibleSourceTree(props.nodes, expandedIds.value))
let typeaheadBuffer = ''
let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

function selectedNodeId(): string | undefined {
  return props.selectedPath ? `file:${props.selectedPath}` : undefined
}

function ensureFocusedNode(): void {
  const visibleIds = new Set(visibleNodes.value.map(entry => entry.node.id))
  if (focusedId.value && visibleIds.has(focusedId.value))
    return
  const selectedId = selectedNodeId()
  focusedId.value = selectedId && visibleIds.has(selectedId)
    ? selectedId
    : visibleNodes.value[0]?.node.id
}

watch(
  () => props.nodes,
  (nodes) => {
    const currentIds = new Set(collectSourceDirectoryIds(nodes))
    const nextExpanded = new Set(
      [...expandedIds.value].filter(id => currentIds.has(id)),
    )
    currentIds.forEach((id) => {
      if (!knownDirectoryIds.value.has(id))
        nextExpanded.add(id)
    })
    expandedIds.value = nextExpanded
    knownDirectoryIds.value = currentIds
  },
  { deep: false, immediate: true },
)

watch(
  () => props.selectedPath,
  (path) => {
    if (!path)
      return
    const next = new Set(expandedIds.value)
    directoryIdsForPath(path).forEach(id => next.add(id))
    expandedIds.value = next
  },
  { immediate: true },
)

watch([visibleNodes, () => props.selectedPath], ensureFocusedNode, { immediate: true })

function focusNode(id: string): void {
  focusedId.value = id
  void nextTick(() => {
    const elements = rootRef.value?.querySelectorAll<HTMLElement>('[data-source-tree-id]')
    Array.from(elements ?? []).find(element => element.dataset.sourceTreeId === id)?.focus()
  })
}

function toggleDirectory(id: string, expanded?: boolean): void {
  const next = new Set(expandedIds.value)
  const shouldExpand = expanded ?? !next.has(id)
  if (shouldExpand)
    next.add(id)
  else
    next.delete(id)
  expandedIds.value = next
}

function activateNode(node: SourceTreeNode): void {
  focusNode(node.id)
  if (node.kind === 'directory')
    toggleDirectory(node.id)
  else
    emit('select', node.path)
}

function focusTypeaheadMatch(index: number, key: string): boolean {
  typeaheadBuffer += key.toLocaleLowerCase()
  if (typeaheadTimer)
    clearTimeout(typeaheadTimer)
  typeaheadTimer = setTimeout(() => typeaheadBuffer = '', 700)

  const entries = visibleNodes.value
  const ordered = [...entries.slice(index + 1), ...entries.slice(0, index + 1)]
  let match = ordered.find(entry => entry.node.name.toLocaleLowerCase().startsWith(typeaheadBuffer))
  if (!match && typeaheadBuffer.length > 1) {
    typeaheadBuffer = key.toLocaleLowerCase()
    match = ordered.find(entry => entry.node.name.toLocaleLowerCase().startsWith(typeaheadBuffer))
  }
  if (!match)
    return false
  focusNode(match.node.id)
  return true
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target instanceof HTMLElement
    ? event.target.closest<HTMLElement>('[data-source-tree-id]')
    : undefined
  const currentId = target?.dataset.sourceTreeId ?? focusedId.value
  const entries = visibleNodes.value
  const index = entries.findIndex(entry => entry.node.id === currentId)
  if (index < 0)
    return

  const current = entries[index]!
  let nextId: string | undefined
  if (event.key === 'ArrowDown')
    nextId = entries[Math.min(entries.length - 1, index + 1)]?.node.id
  else if (event.key === 'ArrowUp')
    nextId = entries[Math.max(0, index - 1)]?.node.id
  else if (event.key === 'Home')
    nextId = entries[0]?.node.id
  else if (event.key === 'End')
    nextId = entries.at(-1)?.node.id
  else if (event.key === 'ArrowRight' && current.node.kind === 'directory') {
    if (!expandedIds.value.has(current.node.id))
      toggleDirectory(current.node.id, true)
    else if (entries[index + 1]?.parentId === current.node.id)
      nextId = entries[index + 1]?.node.id
  }
  else if (event.key === 'ArrowLeft') {
    if (current.node.kind === 'directory' && expandedIds.value.has(current.node.id))
      toggleDirectory(current.node.id, false)
    else
      nextId = current.parentId
  }
  else if (event.key === 'Enter' || event.key === ' ') {
    activateNode(current.node)
  }
  else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (!focusTypeaheadMatch(index, event.key))
      return
  }
  else {
    return
  }

  event.preventDefault()
  if (nextId)
    focusNode(nextId)
}

onBeforeUnmount(() => {
  if (typeaheadTimer)
    clearTimeout(typeaheadTimer)
})
</script>

<template>
  <div
    ref="rootRef"
    class="config-form-source-viewer__tree"
    role="tree"
    aria-label="Generated source files"
    @keydown="handleKeydown"
  >
    <SourceFileTreeNode
      v-for="node in nodes"
      :key="node.id"
      :node="node"
      :expanded-ids="expandedIds"
      :focused-id="focusedId"
      :selected-path="selectedPath"
      @activate="activateNode"
      @focus-node="focusedId = $event"
    />
  </div>
</template>
