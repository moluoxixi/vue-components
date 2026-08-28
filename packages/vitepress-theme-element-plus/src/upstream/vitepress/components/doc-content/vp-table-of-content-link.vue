<script setup lang="ts">
import { ElAnchorLink } from 'element-plus'
import type { TocLinkItem } from '../../types'

defineOptions({ name: 'VPTableOfContentLink' })

defineProps<{
  header: TocLinkItem
}>()

const removeTag = (value: string) => value.replace(/<span.*<\/span>/g, '')
</script>

<template>
  <ElAnchorLink
    :href="header.link"
    :title="header.text"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div :title="removeTag(header.text)" v-html="header.text" />
    <template v-if="header.children?.length" #sub-link>
      <VPTableOfContentLink
        v-for="child in header.children"
        :key="child.link"
        :header="child"
      />
    </template>
  </ElAnchorLink>
</template>
