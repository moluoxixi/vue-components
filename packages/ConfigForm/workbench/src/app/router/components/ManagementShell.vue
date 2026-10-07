<script setup lang="ts">
const props = defineProps<{
  palette: string
  theme: string
}>()
</script>

<template>
  <div class="management-shell" :data-palette="props.palette" :data-theme="props.theme">
    <slot />
  </div>
</template>
