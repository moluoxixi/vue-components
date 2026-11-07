<script setup lang="ts">
import type { Component } from 'vue'
import type { SourceFileTreeNodeEmits, SourceFileTreeNodeProps } from '../../../types'
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileJson2,
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
  if (iconKind === 'data')
    return FileJson2
  if (iconKind === 'code')
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
    :tabindex="props.focusedId === props.node.id ? 0 : -1"
    :aria-expanded="props.node.kind === 'directory' ? expanded : undefined"
    :aria-selected="props.node.kind === 'file' ? props.selectedPath === props.node.path : undefined"
    :data-source-tree-id="props.node.id"
    @focus.self="emit('focusNode', props.node.id)"
  >
    <div
      class="config-form-source-viewer__tree-row"
      :title="props.node.path"
      @click.stop="emit('activate', props.node)"
    >
      <component
        :is="expanded ? ChevronDown : ChevronRight"
        v-if="props.node.kind === 'directory'"
        class="config-form-source-viewer__tree-chevron"
        :size="13"
        aria-hidden="true"
      />
      <span v-else class="config-form-source-viewer__tree-chevron" aria-hidden="true" />
      <component
        :is="nodeIcon"
        class="config-form-source-viewer__tree-icon"
        :data-language="props.node.kind === 'directory' ? 'directory' : props.node.file.kind === 'text' ? props.node.file.language : 'binary'"
        :size="15"
        aria-hidden="true"
      />
      <span class="config-form-source-viewer__tree-name">{{ props.node.name }}</span>
    </div>

    <div v-if="props.node.kind === 'directory' && expanded" role="group">
      <SourceFileTreeNode
        v-for="child in props.node.children"
        :key="child.id"
        :node="child"
        :expanded-ids="props.expandedIds"
        :focused-id="props.focusedId"
        :selected-path="props.selectedPath"
        @activate="emit('activate', $event)"
        @focus-node="emit('focusNode', $event)"
      />
    </div>
  </div>
</template>
