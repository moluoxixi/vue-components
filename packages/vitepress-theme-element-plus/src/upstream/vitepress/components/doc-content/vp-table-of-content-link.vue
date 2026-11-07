<script setup lang="ts">
import type { TocLinkItem } from '../../types'
import { ElAnchorLink } from 'element-plus'
import { provideDocsUi } from '../../../../runtime/provide-docs-ui'

defineOptions({ name: 'VPTableOfContentLink' })

const props = defineProps<{
  header: TocLinkItem
}>()

const removeTag = (value: string) => value.replace(/<span.*<\/span>/g, '')
provideDocsUi()
</script>

<template>
  <ElAnchorLink
    :href="props.header.link"
    :title="props.header.text"
  >
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div :title="removeTag(props.header.text)" v-html="props.header.text" />
    <template v-if="props.header.children?.length" #sub-link>
      <VPTableOfContentLink
        v-for="child in props.header.children"
        :key="child.link"
        :header="child"
      />
    </template>
  </ElAnchorLink>
</template>
