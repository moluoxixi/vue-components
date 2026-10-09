<script setup lang="ts">
import type { ProjectSurface } from '@moluoxixi/config-form-model'
import type { CSSProperties } from 'vue'
import { X } from '@lucide/vue'
import { computed } from 'vue'

const props = defineProps<{ surface?: ProjectSurface, breakpoint: 'desktop' | 'tablet' | 'mobile', emptyHint?: string }>()
const overlay = computed(() => props.surface && props.surface.kind !== 'page' ? props.surface : undefined)
const presentationStyle = computed<CSSProperties>(() => {
  const surface = overlay.value
  if (!surface)
    return {}
  const responsive = surface.kind === 'dialog' ? surface.presentation.width : surface.presentation.size
  const length = props.breakpoint === 'mobile'
    ? responsive.mobile ?? responsive.tablet ?? responsive.desktop
    : props.breakpoint === 'tablet' ? responsive.tablet ?? responsive.desktop : responsive.desktop
  return { '--surface-presentation-size': `${length.value}${length.unit}` }
})
</script>

<template>
  <div
    class="surface-presentation-shell"
    :class="[`is-${surface?.kind ?? 'page'}`, surface?.kind === 'drawer' ? `is-${surface.presentation.placement}` : '']"
    :data-surface-presentation="surface?.kind"
    :style="presentationStyle"
  >
    <div v-if="overlay?.presentation.mask" class="surface-presentation-mask" aria-hidden="true" />
    <component
      :is="overlay ? 'section' : 'div'"
      :class="overlay ? 'surface-presentation-panel' : 'surface-presentation-content'"
      :aria-label="overlay?.presentation.title"
    >
      <header v-if="overlay" class="surface-presentation-header">
        <strong>{{ overlay.presentation.title }}</strong>
        <span v-if="overlay.presentation.close.button" aria-hidden="true"><X :size="16" /></span>
      </header>
      <slot />
      <div v-if="overlay && !overlay.graph.root.length && emptyHint" class="surface-presentation-empty">
        {{ emptyHint }}
      </div>
    </component>
  </div>
</template>
