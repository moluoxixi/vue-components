<script setup lang="ts">
const props = defineProps<{
  count: number
  doubled: number
}>()

defineEmits<{
  increment: []
}>()
</script>

<template>
  <button type="button" @click="$emit('increment')">
    count: {{ props.count }} / doubled: {{ props.doubled }}
  </button>
</template>
