<script setup lang="ts">
import { ref, useId } from 'vue'

defineProps<{ disabled: boolean, message: string }>()
const hintId = `rich-text-hint-${useId()}`
const open = ref(false)
</script>

<template>
  <span
    class="mx-rich-text-editor__control"
    :class="{ 'is-disabled': disabled }"
    :tabindex="disabled ? 0 : undefined"
    :aria-label="disabled ? message : undefined"
    :aria-describedby="disabled && open ? hintId : undefined"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="open = false"
    @keydown.esc.stop.prevent="open = false"
  >
    <slot />
    <span v-if="disabled && open" :id="hintId" class="mx-rich-text-editor__control-hint" role="tooltip">
      {{ message }}
    </span>
  </span>
</template>
