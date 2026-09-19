<script setup lang="ts">
import { ConfigFormRenderer } from '@moluoxixi/config-form'
import { PrototypeSurfaceHost } from '@moluoxixi/config-form-prototype-runtime/vue'
import { computed, markRaw } from 'vue'
import { ExperienceSurfaceRenderer } from './components'
import { useRuntimeHostDesignGeometry, useRuntimeHostProtocol } from './composables'

const protocol = useRuntimeHostProtocol()
const geometry = useRuntimeHostDesignGeometry({
  design: protocol.design,
  postMessage: protocol.postMessage,
  runtimeMode: protocol.runtimeMode,
  surfaceId: protocol.surfaceId,
})
protocol.setGeometryPort({ reset: geometry.reset, sync: geometry.sync })

const {
  active,
  design,
  experience,
  experienceArtifacts,
  experienceContext,
  experienceGeneration,
  fieldChange,
  modelValue,
  namespace,
  postExperienceInstanceState,
  prototypeHost,
  renderer,
  runtimeError,
  runtimeMode,
  runtimeSessionKey,
  updateModel,
} = protocol
const model = { read: () => modelValue.value, write: updateModel }
const prototypeArtifacts = computed(() => Object.fromEntries(
  Object.keys(experienceArtifacts.value).map(surfaceId => [surfaceId, {
    surfaceId,
    component: markRaw(ExperienceSurfaceRenderer),
  }]),
))
const {
  designEditor,
  handleDesignContextMenu,
  handleDesignPointerDown,
  postDesignPointer,
  stage,
  stageStyle,
} = geometry
</script>

<template>
  <div
    class="runtime-host-root"
    :data-mode="runtimeMode"
    :data-runtime-session="runtimeSessionKey"
    :data-variant="design?.variant"
    @pointerdown.capture="handleDesignPointerDown"
    @contextmenu.capture="handleDesignContextMenu"
    @pointermove.capture="postDesignPointer('design.pointerMove', $event)"
    @pointerup.capture="postDesignPointer('design.pointerUp', $event)"
    @pointercancel.capture="postDesignPointer('design.pointerCancel', $event)"
  >
    <div v-if="runtimeError" class="runtime-host-error" role="alert">
      <strong>Preview Runtime error</strong>
      <p>{{ runtimeError }}</p>
    </div>
    <div
      v-if="runtimeMode === 'design' && active"
      ref="stage"
      class="runtime-host-stage"
      :style="stageStyle"
    >
      <ConfigFormRenderer
        :key="runtimeSessionKey"
        ref="renderer"
        :model="model"
        class="surface-design-form"
        mode="design"
        :breakpoint="design?.breakpoint"
        :editor="designEditor"
        aria-hidden="true"
        :inert="true"
        :namespace="namespace"
        v-bind="active.artifact.renderer"
        @field-change="fieldChange"
        @errors-change="protocol.postRuntimeState()"
        @meta-change="protocol.postRuntimeState()"
      />
    </div>
    <div
      v-else-if="runtimeMode === 'experience' && experience && experienceContext"
      class="runtime-host-stage"
    >
      <PrototypeSurfaceHost
        ref="prototypeHost"
        :artifacts-by-surface-id="prototypeArtifacts"
        :context="experienceContext"
        :session="experience.session"
        @transition="protocol.handleExperienceTransition"
      >
        <template #surface="{ bindings }">
          <ExperienceSurfaceRenderer
            v-if="experienceArtifacts[bindings.instance.surfaceId]"
            :key="`${experienceGeneration}:${bindings.instance.instanceId}`"
            :artifact="experienceArtifacts[bindings.instance.surfaceId]!"
            :bindings="bindings"
            :namespace="namespace"
            @error="protocol.reportExperienceError"
            @state="postExperienceInstanceState"
          />
        </template>
      </PrototypeSurfaceHost>
    </div>
  </div>
</template>
