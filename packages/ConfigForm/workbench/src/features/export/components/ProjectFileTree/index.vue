<script setup lang="ts">
import type { ProjectTreeNode } from '../../../../project'
import type { ProjectFileTreeEmits, ProjectFileTreeProps } from './types'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { flattenVisibleProjectTree } from '../../../../project'
import { ProjectFileTreeNode } from './components'

const props = defineProps<ProjectFileTreeProps>()

const emit = defineEmits<ProjectFileTreeEmits>()

const rootRef = useTemplateRef<HTMLElement>('root')
const locale = computed(() => createDesignerLocale(props.locale))
const focusedId = ref<string>()
const expandedSet = computed(() => new Set(props.expandedIds))
const visibleNodes = computed(() => flattenVisibleProjectTree(props.nodes, expandedSet.value))
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

watch([visibleNodes, () => props.selectedPath], ensureFocusedNode, { immediate: true })

function focusNode(id: string): void {
  focusedId.value = id
  void nextTick(() => [...(rootRef.value?.querySelectorAll<HTMLElement>('[data-project-tree-id]') ?? [])]
    .find(element => element.dataset.projectTreeId === id)
    ?.focus())
}

function toggleDirectory(id: string, expanded?: boolean): void {
  const next = new Set(props.expandedIds)
  const shouldExpand = expanded ?? !next.has(id)
  if (shouldExpand)
    next.add(id)
  else
    next.delete(id)
  emit('update:expandedIds', [...next])
}

function activateNode(node: ProjectTreeNode): void {
  focusNode(node.id)
  if (node.kind === 'directory')
    toggleDirectory(node.id)
  else
    emit('select', node.path)
}

function focusTypeaheadMatch(entries: typeof visibleNodes.value, index: number, key: string): boolean {
  typeaheadBuffer += key.toLocaleLowerCase()
  if (typeaheadTimer)
    clearTimeout(typeaheadTimer)
  typeaheadTimer = setTimeout(() => typeaheadBuffer = '', 700)

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
    ? event.target.closest<HTMLElement>('[data-project-tree-id]')
    : undefined
  const currentId = target?.dataset.projectTreeId ?? focusedId.value
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
    if (!expandedSet.value.has(current.node.id))
      toggleDirectory(current.node.id, true)
    else
      nextId = entries[index + 1]?.parentId === current.node.id ? entries[index + 1]?.node.id : undefined
  }
  else if (event.key === 'ArrowLeft') {
    if (current.node.kind === 'directory' && expandedSet.value.has(current.node.id))
      toggleDirectory(current.node.id, false)
    else
      nextId = current.parentId
  }
  else if (event.key === 'Enter' || event.key === ' ') {
    activateNode(current.node)
  }
  else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
    if (!focusTypeaheadMatch(entries, index, event.key))
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
  <nav
    ref="root"
    class="project-file-tree"
    role="tree"
    :aria-label="locale.t('fileTree.generatedSource', 'Generated source files')"
    @keydown="handleKeydown"
  >
    <ProjectFileTreeNode
      v-for="node in nodes"
      :key="node.id"
      :node="node"
      :expanded-ids="expandedSet"
      :focused-id="focusedId"
      :selected-path="selectedPath"
      @activate="activateNode"
      @focus-node="focusedId = $event"
    />
  </nav>
</template>

<style scoped>
.project-file-tree {
  min-width: 0;
  padding: 6px 4px;
  overflow: auto;
  color: var(--wb-muted);
  border-right: 1px solid var(--wb-separator);
  background: var(--wb-surface);
  font: 11px/1 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

.project-file-tree :deep(.project-file-tree__item) {
  min-width: 0;
  outline: none;
}

.project-file-tree :deep([role="group"]) {
  padding-left: 13px;
}

.project-file-tree :deep(.project-file-tree__row) {
  display: grid;
  height: 28px;
  min-width: 0;
  padding: 0 6px;
  grid-template-columns: 13px 15px minmax(0, 1fr);
  align-items: center;
  gap: 5px;
  border-radius: 3px;
  cursor: default;
}

.project-file-tree :deep(.project-file-tree__row > span:last-child) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-file-tree :deep(.project-file-tree__chevron) {
  width: 13px;
  color: var(--wb-muted);
}

.project-file-tree :deep(.project-file-tree__icon) {
  color: var(--wb-accent-line);
}

.project-file-tree :deep(.project-file-tree__item:hover > .project-file-tree__row),
.project-file-tree :deep(.project-file-tree__item:focus > .project-file-tree__row) {
  color: var(--wb-text-strong);
  background: var(--wb-hover);
}

.project-file-tree :deep(.project-file-tree__item[aria-selected="true"] > .project-file-tree__row) {
  color: var(--wb-text-strong);
  background: var(--wb-accent-soft);
  box-shadow: inset 2px 0 var(--wb-accent);
}
</style>
