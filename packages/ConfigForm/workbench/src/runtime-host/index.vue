<script setup lang="ts">
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { useRuntimeHostDesignGeometry, useRuntimeHostProtocol } from './composables'

const protocol = useRuntimeHostProtocol()
const geometry = useRuntimeHostDesignGeometry({
  design: protocol.design,
  postMessage: protocol.postMessage,
  runtimeMode: protocol.runtimeMode,
})
protocol.setGeometryPort({ reset: geometry.reset, sync: geometry.sync })

const {
  active,
  design,
  fieldChange,
  modelValue,
  namespace,
  postRuntimeState,
  reactionProjection,
  renderer,
  runtimeError,
  runtimeEvent,
  runtimeMode,
  runtimeSessionKey,
  submitValues,
  updateModel,
} = protocol
const {
  designEditor,
  handleDesignPointerDown,
  postDesignPointer,
  stage,
  stageStyle,
} = geometry
</script>
<template>
  <main
    class="runtime-host-root"
    :data-mode="runtimeMode"
    :data-runtime-session="runtimeSessionKey"
    :data-variant="design?.variant"
    @pointerdown.capture="handleDesignPointerDown"
    @pointermove.capture="postDesignPointer('designPointerMove', $event)"
    @pointerup.capture="postDesignPointer('designPointerUp', $event)"
    @pointercancel.capture="postDesignPointer('designPointerCancel', $event)"
  >
    <div v-if="runtimeError" class="runtime-host-error" role="alert">
      <strong>Preview Runtime error</strong>
      <p>{{ runtimeError }}</p>
    </div>
    <div v-if="active" ref="stage" class="runtime-host-stage" :style="stageStyle">
      <ConfigFormRenderer
        :key="runtimeSessionKey"
        ref="renderer"
        :model-value="modelValue"
        :class="runtimeMode === 'design' ? 'page-design-form' : 'page-preview-form'"
        :mode="runtimeMode"
        :breakpoint="runtimeMode === 'design' ? design?.breakpoint : undefined"
        :editor="runtimeMode === 'design' ? designEditor : undefined"
        :aria-hidden="runtimeMode === 'design' ? 'true' : undefined"
        :inert="runtimeMode === 'design' ? true : undefined"
        :namespace="namespace"
        :reaction-projection="reactionProjection"
        v-bind="active.artifact.plan.renderer"
        @update:model-value="updateModel"
        @submit="submitValues"
        @field-change="fieldChange"
        @errors-change="postRuntimeState"
        @meta-change="postRuntimeState"
        @runtime-event="runtimeEvent"
      />
    </div>
  </main>
</template>
