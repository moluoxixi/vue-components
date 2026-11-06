<script setup lang="ts">
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  link: string
  text: string
}>()
provideDocsUi()
</script>

<template>
  <a
    :href="link"
    :title="text"
    :aria-label="text"
    target="_blank"
    rel="noreferrer noopener"
    class="social-link"
  >
    <ElIcon v-if="icon" :size="20">
      <component :is="icon" />
    </ElIcon>
    <span v-else class="social-link-text">{{ text }}</span>
  </a>
</template>

<style scoped lang="scss">
.social-link {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--ep-docs-text-color-light);

  &:hover {
    background: var(--ep-docs-bg-color-mute);
    color: var(--ep-docs-brand-color);
  }
}

.social-link-text {
  font-size: 13px;
}
</style>
