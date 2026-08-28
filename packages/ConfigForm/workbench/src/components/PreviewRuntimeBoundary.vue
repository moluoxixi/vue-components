<script setup lang="ts">
import { nextTick, onErrorCaptured, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  revision: string
}>()
const emit = defineEmits<{
  ready: [revision: string]
}>()

const runtimeError = ref('')

function scheduleReady(revision: string): void {
  void nextTick(() => {
    if (!runtimeError.value && revision === props.revision)
      emit('ready', revision)
  })
}

watch(() => props.revision, (revision) => {
  runtimeError.value = ''
  scheduleReady(revision)
})

onMounted(() => scheduleReady(props.revision))

onErrorCaptured((error, _instance, info) => {
  const message = error instanceof Error ? error.message : String(error)
  runtimeError.value = `${message} (${info})`
  return false
})
</script>

<template>
  <div class="preview-runtime-boundary">
    <div v-if="runtimeError" class="preview-errors" role="alert">
      <strong>Preview runtime error</strong>
      <p>{{ runtimeError }}</p>
    </div>
    <slot v-if="runtimeError" name="fallback" />
    <slot v-else />
  </div>
</template>
