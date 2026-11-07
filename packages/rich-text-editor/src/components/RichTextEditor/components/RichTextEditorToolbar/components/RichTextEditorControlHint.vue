<script setup lang="ts">
import { ref, useId } from 'vue'

const props = defineProps<{ disabled: boolean, message: string }>()
const hintId = `rich-text-hint-${useId()}`
const open = ref(false)
</script>

<template>
  <span
    class="mx-rich-text-editor__control"
    :class="{ 'is-disabled': props.disabled }"
    :tabindex="props.disabled ? 0 : undefined"
    :aria-label="props.disabled ? props.message : undefined"
    :aria-describedby="props.disabled && open ? hintId : undefined"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="open = false"
    @keydown.esc.stop.prevent="open = false"
  >
    <slot />
    <span v-if="props.disabled && open" :id="hintId" class="mx-rich-text-editor__control-hint" role="tooltip">
      {{ props.message }}
    </span>
  </span>
</template>
