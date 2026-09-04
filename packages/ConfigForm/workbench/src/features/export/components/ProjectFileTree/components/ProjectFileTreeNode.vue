<script setup lang="ts">
import type { ProjectFileTreeNodeEmits, ProjectFileTreeNodeProps } from '../types'
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
import { projectFileIconKind } from '../../../../../project'

defineOptions({ name: 'ProjectFileTreeNode' })

const props = defineProps<ProjectFileTreeNodeProps>()

const emit = defineEmits<ProjectFileTreeNodeEmits>()

const expanded = computed(() => props.node.kind === 'directory' && props.expandedIds.has(props.node.id))
const fileIcon = computed(() => {
  if (props.node.kind === 'directory')
    return expanded.value ? FolderOpen : Folder
  const kind = projectFileIconKind(props.node.path, props.node.file)
  if (kind === 'code' || kind === 'json')
    return FileCode2
  if (kind === 'text')
    return FileText
  return File
})
</script>

<template>
  <div
    class="project-file-tree__item"
    role="treeitem"
    :tabindex="focusedId === node.id ? 0 : -1"
    :aria-expanded="node.kind === 'directory' ? expanded : undefined"
    :aria-selected="node.kind === 'file' ? selectedPath === node.path : false"
    :data-project-tree-id="node.id"
    @focus.self="emit('focusNode', node.id)"
  >
    <div class="project-file-tree__row" :title="node.path" @click.stop="emit('activate', node)">
      <component
        :is="expanded ? ChevronDown : ChevronRight"
        v-if="node.kind === 'directory'"
        class="project-file-tree__chevron"
        :size="13"
        aria-hidden="true"
      />
      <span v-else class="project-file-tree__chevron" aria-hidden="true" />
      <component :is="fileIcon" class="project-file-tree__icon" :size="15" aria-hidden="true" />
      <span>{{ node.name }}</span>
    </div>
    <div v-if="node.kind === 'directory' && expanded" role="group">
      <ProjectFileTreeNode
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
