<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { StudioDesignRuntimeProps } from '../types/design-presentation'
import { X } from '@lucide/vue'
import { computed } from 'vue'
import DesignRuntimeHostFrame from './DesignRuntimeHostFrame/index.vue'

const props = defineProps<StudioDesignRuntimeProps>()
const emit = defineEmits<{ error: [error: Error] }>()
const overlay = computed(() => (props.surface?.kind !== 'page' ? props.surface : undefined))
const presentationStyle = computed<CSSProperties>(() => {
  const surface = overlay.value
  if (!surface)
    return {}
  const responsive = surface.kind === 'dialog' ? surface.presentation.width : surface.presentation.size
  const point = props.scope.breakpoint
  const length
    = point === 'mobile'
      ? (responsive.mobile ?? responsive.tablet ?? responsive.desktop)
      : point === 'tablet'
        ? (responsive.tablet ?? responsive.desktop)
        : responsive.desktop
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
        <strong>{{ overlay.presentation.title }}</strong><button v-if="overlay.presentation.close.button" type="button" disabled aria-hidden="true">
          <X :size="16" />
        </button>
      </header>
      <DesignRuntimeHostFrame
        :adapter="adapter"
        :breakpoint="scope.breakpoint"
        :camera-scale="scope.cameraScale"
        :candidate-id="scope.candidateId"
        :candidate-uses-fallback="scope.candidateUsesFallback"
        :command="scope.command"
        :locale="locale"
        :model-value="scope.model"
        :namespace="namespace"
        :resolve-compilation="resolveCompilation"
        :title="title"
        variant="canvas"
        @error="emit('error', $event)"
        @geometry="scope.bridge.updateGeometry"
        @context-menu="scope.bridge.contextMenu"
        @pointer-cancel="scope.bridge.pointerCancel"
        @pointer-down="scope.bridge.pointerDown"
        @pointer-move="scope.bridge.pointerMove"
        @pointer-up="scope.bridge.pointerUp"
      />
    </component>
  </div>
</template>
