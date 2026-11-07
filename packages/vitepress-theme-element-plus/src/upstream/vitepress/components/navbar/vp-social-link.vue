<script setup lang="ts">
import type { Component } from 'vue'
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'

const props = defineProps<{
  icon?: Component
  link: string
  text: string
}>()
provideDocsUi()
</script>

<template>
  <a
    :href="props.link"
    :title="props.text"
    :aria-label="props.text"
    target="_blank"
    rel="noreferrer noopener"
    class="social-link"
  >
    <ElIcon v-if="props.icon" :size="20">
      <component :is="props.icon" />
    </ElIcon>
    <span v-else class="social-link-text">{{ props.text }}</span>
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
