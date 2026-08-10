<script setup lang="ts">
defineProps<{
  count: number
  doubled: number
}>()

defineEmits<{
  increment: []
}>()
</script>

<template>
  <button type="button" @click="$emit('increment')">
    count: {{ count }} / doubled: {{ doubled }}
  </button>
</template>
