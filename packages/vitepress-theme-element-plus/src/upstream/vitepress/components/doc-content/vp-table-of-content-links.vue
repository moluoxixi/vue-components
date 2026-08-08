<script setup lang="ts">
import { ElAnchor, ElAnchorLink } from 'element-plus'

export interface TocLinkItem {
  children?: TocLinkItem[]
  link: string
  text: string
}

defineProps<{
  headers: TocLinkItem[]
}>()

const removeTag = (value: string) => value.replace(/<span.*<\/span>/g, '')
</script>

<template>
  <ElAnchor :offset="70" :bound="120">
    <ElAnchorLink
      v-for="{ link, text, children } in headers"
      :key="link"
      :href="link"
      :title="text"
    >
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div :title="removeTag(text)" v-html="text" />
      <template v-if="children" #sub-link>
        <ElAnchorLink
          v-for="{ link: childLink, text: childText } in children"
          :key="childLink"
          :href="childLink"
          :title="childText"
        >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div :title="removeTag(childText)" v-html="childText" />
        </ElAnchorLink>
      </template>
    </ElAnchorLink>
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
