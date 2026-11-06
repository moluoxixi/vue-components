<script setup lang="ts">
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'
import { ElAnchor } from 'element-plus'
import type { TocLinkItem } from '../../types'
import VPTableOfContentLink from './vp-table-of-content-link.vue'

defineProps<{
  headers: TocLinkItem[]
}>()
provideDocsUi()
</script>

<template>
  <ElAnchor :offset="70" :bound="120">
    <VPTableOfContentLink
      v-for="header in headers"
      :key="header.link"
      :header="header"
    />
  </ElAnchor>
</template>

<style scoped>
:deep(.epd-anchor__link),
:deep(.epd-anchor__link > div) {
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}
</style>
