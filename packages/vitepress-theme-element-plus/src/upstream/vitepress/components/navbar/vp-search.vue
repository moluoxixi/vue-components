<script setup lang="ts">
import { VPNavBarSearch } from '../../../../runtime/vitepress-compat'
</script>

<template>
  <VPNavBarSearch />
</template>

<style scoped lang="scss">
:deep(.DocSearch-Button) {
  height: 36px;
  border-radius: 6px;
}

@media (max-width: 959px) {
  :deep(.DocSearch-Button) {
    width: 36px;
    padding: 0;
    justify-content: center;
    border: 0;
    background: transparent;
  }

  :deep(.DocSearch-Button:hover) {
    background: var(--ep-docs-bg-color-mute);
  }

  :deep(.DocSearch-Button-Placeholder),
  :deep(.DocSearch-Button-Keys) {
    display: none;
  }

  :deep(.DocSearch-Search-Icon) {
    top: 0;
    width: 18px;
    height: 18px;
    margin: 0;
  }
}
</style>
