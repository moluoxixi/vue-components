<script setup lang="ts">
import type { Component } from 'vue'
import type { SourceFileTreeNodeEmits, SourceFileTreeNodeProps } from '../../../types'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
} from '@lucide/vue'
import { computed } from 'vue'
import { sourceFileIconKind } from '../../../services'

defineOptions({ name: 'SourceFileTreeNode' })

const props = defineProps<SourceFileTreeNodeProps>()
const emit = defineEmits<SourceFileTreeNodeEmits>()

const expanded = computed(() => props.node.kind === 'directory' && props.expandedIds.has(props.node.id))
const nodeIcon = computed<Component>(() => {
  if (props.node.kind === 'directory')
    return expanded.value ? FolderOpen : Folder
  const iconKind = sourceFileIconKind(props.node.file)
  if (iconKind === 'code' || iconKind === 'data')
    return FileCode2
  if (iconKind === 'text')
    return FileText
  return File
})
</script>

<template>
  <div
    class="config-form-source-viewer__tree-item"
    role="treeitem"
    :tabindex="focusedId === node.id ? 0 : -1"
    :aria-expanded="node.kind === 'directory' ? expanded : undefined"
    :aria-selected="node.kind === 'file' ? selectedPath === node.path : undefined"
    :data-source-tree-id="node.id"
    @focus.self="emit('focusNode', node.id)"
  >
    <div
      class="config-form-source-viewer__tree-row"
      :title="node.path"
      @click.stop="emit('activate', node)"
    >
      <component
        :is="expanded ? ChevronDown : ChevronRight"
        v-if="node.kind === 'directory'"
        class="config-form-source-viewer__tree-chevron"
        :size="13"
        aria-hidden="true"
      />
      <span v-else class="config-form-source-viewer__tree-chevron" aria-hidden="true" />
      <component
        :is="nodeIcon"
        class="config-form-source-viewer__tree-icon"
        :size="15"
        aria-hidden="true"
      />
      <span class="config-form-source-viewer__tree-name">{{ node.name }}</span>
    </div>

    <div v-if="node.kind === 'directory' && expanded" role="group">
      <SourceFileTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :expanded-ids="expandedIds"
        :focused-id="focusedId"
        :selected-path="selectedPath"
        @activate="emit('activate', $event)"
        @focus-node="emit('focusNode', $event)"
      />
    </div>
  </div>
</template>
