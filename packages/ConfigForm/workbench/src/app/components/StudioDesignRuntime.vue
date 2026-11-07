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
  <SurfacePresentationFrame :surface="props.surface" :breakpoint="props.scope.breakpoint" :empty-hint="localeText.t('canvas.emptyGuide', 'Drag or click a component on the left to add a field')">
    <DesignRuntimeHostFrame
      :adapter="props.adapter"
      :breakpoint="props.scope.breakpoint"
      :camera-scale="props.scope.cameraScale"
      :candidate-id="props.scope.candidateId"
      :candidate-uses-fallback="props.scope.candidateUsesFallback"
      :command="props.scope.command"
      :locale="props.locale"
      :model-value="props.scope.model"
      :namespace="props.namespace"
      :resolve-compilation="props.resolveCompilation"
      :title="props.title"
      variant="canvas"
      @error="emit('error', $event)"
      @geometry="props.scope.bridge.updateGeometry"
      @context-menu="props.scope.bridge.contextMenu"
      @pointer-cancel="props.scope.bridge.pointerCancel"
      @pointer-down="props.scope.bridge.pointerDown"
      @pointer-move="props.scope.bridge.pointerMove"
      @pointer-up="props.scope.bridge.pointerUp"
    />
  </SurfacePresentationFrame>
</template>
