<script setup lang="ts">
const props = defineProps<{
  show: boolean
}>()
</script>

<template>
  <Transition name="epd-fade-in">
    <div v-if="props.show" class="overlay" />
  </Transition>
</template>

<style scoped lang="scss">
.overlay {
  position: fixed;
  top: var(--ep-docs-header-height);
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.6);
  transition: opacity 0.5s;
  z-index: var(--ep-docs-overlay-z-index);
}
</style>
