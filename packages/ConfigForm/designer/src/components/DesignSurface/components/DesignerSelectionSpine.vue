<script setup lang="ts">
import type { DesignerRegistry } from '@designer/registry'
import type { SurfaceGraph } from '@moluoxixi/config-form-model'
import { findDesignNode } from '@designer/graph'
import { useDesignerLocale } from '@designer/locale'
import { ChevronRight, Layers3 } from '@lucide/vue'
import { computed } from 'vue'

const props = defineProps<{
  graph: SurfaceGraph
  registry: DesignerRegistry
  selectedIds: string[]
  surfaceName: string
  breakpoint: string
}>()
const emit = defineEmits<{ select: [nodeId?: string] }>()
const locale = useDesignerLocale()
const path = computed(() => {
  const entries: { id: string, label: string, slot?: string }[] = []
  let id: string | undefined = props.selectedIds[0]
  const seen = new Set<string>()
  while (id && !seen.has(id)) {
    seen.add(id)
    const location = findDesignNode(props.graph, id)
    if (!location)
      break
    const material = props.registry.getMaterial(location.node.component)
    entries.unshift({
      id,
      label:
        location.node.kind === 'field'
          ? location.node.label || location.node.field
          : material
            ? locale.materialTitle(material)
            : location.node.component,
      slot: location.slot,
    })
    id = location.parentId ?? undefined
  }
  return entries
})
</script>

<template>
  <nav class="mx-config-form-designer__selection-spine" :aria-label="locale.t('selection.path', 'Selection path')">
    <Layers3 :size="14" aria-hidden="true" />
    <button type="button" :title="surfaceName" @click="emit('select')">
      {{ surfaceName }}
    </button>
    <template v-for="entry in path" :key="entry.id">
      <ChevronRight :size="12" aria-hidden="true" /><button
        type="button"
        :title="`${entry.label} · ${entry.id}`"
        @click="emit('select', entry.id)"
      >
        {{ entry.label }}<small v-if="entry.slot">{{ entry.slot }}</small>
      </button>
    </template>
    <span v-if="selectedIds.length > 1" class="mx-config-form-designer__spine-count">+{{ selectedIds.length - 1 }}</span>
    <code>{{ breakpoint }}</code>
  </nav>
</template>
