<script setup lang="ts">
import type { StudioDesignRuntimeProps } from '../types/design-presentation'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import DesignRuntimeHostFrame from './DesignRuntimeHostFrame/index.vue'
import SurfacePresentationFrame from './SurfacePresentationFrame.vue'

const props = defineProps<StudioDesignRuntimeProps>()
const emit = defineEmits<{ error: [error: Error] }>()
const localeText = computed(() => createDesignerLocale({ locale: props.locale }))
</script>

<template>
  <SurfacePresentationFrame :surface="surface" :breakpoint="scope.breakpoint" :empty-hint="localeText.t('canvas.emptyGuide', 'Drag or click a component on the left to add a field')">
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
  </SurfacePresentationFrame>
</template>
