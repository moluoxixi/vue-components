<script setup lang="ts">
import { ElAnchor } from 'element-plus'
import type { TocLinkItem } from '../../types'
import VPTableOfContentLink from './vp-table-of-content-link.vue'

defineProps<{
  headers: TocLinkItem[]
}>()
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
:deep(.el-anchor__link),
:deep(.el-anchor__link > div) {
  overflow: visible;
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  word-break: break-word;
}
</style>
