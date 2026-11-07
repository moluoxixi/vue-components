<script setup lang="ts">
const props = defineProps<{ label: string }>()
</script>

<template>
  <div v-bind="$attrs">
    {{ props.label }}
  </div>
</template>
