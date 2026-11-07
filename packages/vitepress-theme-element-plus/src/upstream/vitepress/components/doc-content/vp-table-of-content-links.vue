<script setup lang="ts">
import type { TocLinkItem } from '../../types'
import { ElAnchor } from 'element-plus'
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'
import VPTableOfContentLink from './vp-table-of-content-link.vue'

const props = defineProps<{
  headers: TocLinkItem[]
}>()
provideDocsUi()
</script>

<template>
  <ElAnchor :offset="70" :bound="120">
    <VPTableOfContentLink
      v-for="header in props.headers"
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
