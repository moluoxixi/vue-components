<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div v-bind="$attrs">{{ label }}</div>
</template>
